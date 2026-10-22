import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { CheckCircle, ExternalLink, MapPin } from 'lucide-react-native';
import * as Location from 'expo-location';
import { taskApi, teamApi, Task, PRIORITIES } from '../../services/platform';
import { useApi, useAuth } from '../../hooks/useApi';
import {
  Page, Section, Field, Input, Select, Segmented, Button, DateTimeField, StatusTag, KeyValue, ConfirmDialog, Loading,
  formatDate, humanize, toast,
} from '../../ui';
import { TOKENS, TYPE } from '../../theme';

const KINDS = [{ label: 'Follow-up', value: 'FOLLOW_UP' }, { label: 'Appointment', value: 'APPOINTMENT' },
               { label: 'Field visit', value: 'FIELD_VISIT' }, { label: 'Task', value: 'TASK' }];
const FOLLOW_TYPES = ['CALL', 'WHATSAPP', 'VISIT', 'MEETING', 'OTHER'].map(v => ({ label: humanize(v), value: v }));
const METHODS = ['IN_PERSON', 'PHONE', 'VIDEO', 'FIELD_VISIT'].map(v => ({ label: humanize(v), value: v }));
const REMINDERS = [{ label: 'None', value: '-1' }, { label: '15 min', value: '15' }, { label: '1 hour', value: '60' }, { label: '1 day', value: '1440' }];

/** Create, edit, reschedule or complete a follow-up / appointment / task. */
export const TaskFormScreen = ({ navigation, route }: any) => {
  const { taskId, leadId, customerName, consultationId } = route.params ?? {};
  const { user, can } = useAuth();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(!!taskId);
  const [form, setForm] = useState({
    kind: route.params?.kind ?? 'FOLLOW_UP', title: customerName ? `Follow up with ${customerName}` : '', description: '',
    priority: 'MEDIUM', followUpType: 'CALL', meetingMethod: 'IN_PERSON', consultationType: '', location: '', notes: '',
    assigneeId: '', reminderMinutes: '60', purpose: '', visitReport: '',
  });
  const [checkingIn, setCheckingIn] = useState(false);
  const [dueAt, setDueAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState<'COMPLETED' | 'NO_SHOW' | 'CANCELLED' | null>(null);
  const team = useApi(() => (can('tasks.assign_others') ? teamApi.assignable('STAFF') : Promise.resolve({ items: [] })), [], { focus: false });
  const experts = useApi(() => (can('tasks.assign_others') ? teamApi.assignable('EXPERT') : Promise.resolve({ items: [] })), [], { focus: false });

  useEffect(() => {
    if (!taskId) return;
    taskApi.get(taskId).then(t => {
      setTask(t);
      setForm(f => ({ ...f, kind: t.kind, title: t.title, description: t.description ?? '', priority: t.priority,
                      followUpType: t.followUpType ?? 'CALL', meetingMethod: t.meetingMethod ?? 'IN_PERSON',
                      location: t.location ?? '', notes: t.notes ?? '', purpose: t.purpose ?? '', visitReport: t.visitReport ?? '' }));
      setDueAt(t.dueAt);
      navigation.setOptions({ title: humanize(t.kind) });
    }).catch(e => toast(e.message, 'error')).finally(() => setLoading(false));
  }, [taskId, navigation]);

  useEffect(() => {
    if (!taskId) navigation.setOptions({ title: `New ${humanize(form.kind).toLowerCase()}` });
    if (!taskId && customerName) {
      setForm(f => ({ ...f, title: f.kind === 'APPOINTMENT' ? `Meeting with ${customerName}` : f.kind === 'FOLLOW_UP' ? `Follow up with ${customerName}` : f.title }));
    }
  }, [form.kind, taskId, customerName, navigation]);

  const set = (k: keyof typeof form) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.title.trim() || !dueAt) return toast('Title and date are required', 'error');
    setSaving(true);
    try {
      if (task) {
        const updated = await taskApi.update(task.taskId, {
          title: form.title, description: form.description, priority: form.priority, notes: form.notes, location: form.location,
          ...(task.kind === 'FIELD_VISIT' ? { visitReport: form.visitReport } : {}),
          dueAt: dueAt !== task.dueAt ? dueAt : undefined,
          assigneeId: form.assigneeId && form.assigneeId !== task.assigneeId ? form.assigneeId : undefined,
        });
        setTask(updated);
        toast('Saved');
      } else {
        await taskApi.create({ ...form, dueAt, leadId, consultationId, customerName,
                               assigneeId: form.assigneeId || undefined, reminderMinutes: Number(form.reminderMinutes) });
        toast(`${humanize(form.kind)} scheduled`);
        navigation.goBack();
      }
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const finish = async (status: string, outcome: string) => {
    if (!task) return;
    try {
      setTask(await taskApi.update(task.taskId, { status, outcome }));
      toast(`Marked ${humanize(status).toLowerCase()}`);
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  const checkIn = async () => {
    if (!task) return;
    setCheckingIn(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') throw new Error('Location permission is needed to check in');
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setTask(await taskApi.update(task.taskId, { checkIn: { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy } }));
      toast('Checked in at the farm');
    } catch (e: any) {
      toast(e.message ?? 'Could not get your location', 'error');
    } finally {
      setCheckingIn(false);
    }
  };

  if (loading) return <Loading />;
  const readOnly = !!task && task.status !== 'OPEN';
  const assignees = [
    { label: `Me (${user?.name})`, value: '' },
    ...[...(team.data?.items ?? []), ...(experts.data?.items ?? [])]
      .filter(u => u.userId !== user?.userId)
      .map(u => ({ label: u.name, value: u.userId, description: humanize(u.role) })),
  ];

  return (
    <Page keyboard>
      {task && (
        <Section>
          <KeyValue label="Status" value={<StatusTag status={task.status} />} />
          <KeyValue label="Assigned to" value={task.assigneeName} />
          {task.isOverdue && <Text style={[TYPE.h3, { color: TOKENS.colorError }]}>Overdue since {formatDate(task.dueAt)}</Text>}
          {!!task.outcome && <KeyValue label="Outcome" value={task.outcome} />}
          {!!task.leadId && <Button title="Open lead" type="text" size="sm" icon={ExternalLink}
                                    onPress={() => navigation.navigate('LeadDetail', { id: task.leadId })} />}
        </Section>
      )}

      <Section>
        {!task && <Field label="Type"><Segmented value={form.kind} options={KINDS} onChange={set('kind')} /></Field>}
        <Field label="Title" required><Input value={form.title} onChangeText={set('title')} editable={!readOnly} /></Field>
        <Field label="When" required>
          {readOnly ? <Text style={TYPE.body}>{formatDate(dueAt)}</Text> : <DateTimeField value={dueAt} onChange={setDueAt} />}
        </Field>
        {form.kind === 'FOLLOW_UP' && !task && (
          <Field label="Follow-up by"><Segmented value={form.followUpType} options={FOLLOW_TYPES} onChange={set('followUpType')} /></Field>
        )}
        {form.kind === 'FIELD_VISIT' && (
          <>
            <Field label="Farm / location"><Input value={form.location} onChangeText={set('location')} editable={!readOnly} placeholder="Village, field name" /></Field>
            {!task && <Field label="Purpose"><Input value={form.purpose} onChangeText={set('purpose')} placeholder="e.g. Soil sampling, pest inspection" /></Field>}
            {!!task?.purpose && <KeyValue label="Purpose" value={task.purpose} />}
          </>
        )}
        {form.kind === 'APPOINTMENT' && (
          <>
            {!task && <Field label="Meeting method"><Segmented value={form.meetingMethod} options={METHODS} onChange={set('meetingMethod')} /></Field>}
            {!task && <Field label="Consultation type"><Input value={form.consultationType} onChangeText={set('consultationType')} placeholder="e.g. Field inspection" /></Field>}
            <Field label="Location / meeting link"><Input value={form.location} onChangeText={set('location')} editable={!readOnly} /></Field>
          </>
        )}
        <Field label="Priority">
          <Segmented value={form.priority} options={PRIORITIES.map(p => ({ label: humanize(p), value: p }))} onChange={readOnly ? () => {} : set('priority')} />
        </Field>
        <Field label="Description"><Input value={form.description} onChangeText={set('description')} multiline editable={!readOnly} /></Field>
        <Field label="Notes"><Input value={form.notes} onChangeText={set('notes')} multiline editable={!readOnly} /></Field>
        {!task && <Field label="Reminder"><Segmented value={form.reminderMinutes} options={REMINDERS} onChange={set('reminderMinutes')} /></Field>}
        {can('tasks.assign_others') && !readOnly && (
          <Field label="Assign to"><Select value={form.assigneeId} options={assignees} onChange={set('assigneeId')} title="Assign to" /></Field>
        )}
      </Section>

      {task?.kind === 'FIELD_VISIT' && (
        <Section title="Field visit">
          {(task.checkIns ?? []).map((c, i) => (
            <KeyValue key={i} label={i ? 'Check-in' : 'Checked in'}
                      value={`${formatDate(c.at)} · ${Number(c.lat).toFixed(5)}, ${Number(c.lng).toFixed(5)}${c.accuracyM ? ` (±${Math.round(c.accuracyM)} m)` : ''}`} />
          ))}
          {!readOnly && <Button title={task.checkIns?.length ? 'Check in again' : 'Check in at the farm'} icon={MapPin} loading={checkingIn} onPress={checkIn} />}
          <Field label="Visit report" help="Observations, samples taken, advice given">
            <Input value={form.visitReport} onChangeText={set('visitReport')} multiline editable={!readOnly} style={{ minHeight: 110 }} />
          </Field>
        </Section>
      )}
      {!readOnly && <Button title={task ? 'Save changes' : 'Schedule'} type="primary" block loading={saving} onPress={save} />}
      {task?.status === 'OPEN' && (
        <View style={{ gap: 8 }}>
          <Button title="Mark complete" icon={CheckCircle} block onPress={() => setCompleting('COMPLETED')} />
          {task.kind === 'APPOINTMENT' && <Button title="Customer didn't show" block onPress={() => setCompleting('NO_SHOW')} />}
          <Button title="Cancel" type="danger" block onPress={() => setCompleting('CANCELLED')} />
        </View>
      )}
      {!!task?.history?.length && (
        <Section title="History">
          {task.history.map((h, i) => <Text key={i} style={TYPE.caption}>{formatDate(h.at)} · {h.event}</Text>)}
        </Section>
      )}

      <ConfirmDialog visible={!!completing} title={completing === 'COMPLETED' ? 'Complete' : humanize(completing ?? '')}
                     input={{ placeholder: completing === 'COMPLETED' ? 'Outcome — what happened?' : 'Reason (optional)', required: completing === 'COMPLETED' }}
                     danger={completing === 'CANCELLED'} confirmText="Save" onCancel={() => setCompleting(null)}
                     onConfirm={t => { const s = completing!; setCompleting(null); finish(s, t); }} />
    </Page>
  );
};
