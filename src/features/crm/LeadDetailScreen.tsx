import React, { useMemo, useState } from 'react';
import { View, Text, Linking, TouchableOpacity } from 'react-native';
import {
  Phone, MessageCircle, FileText, PackagePlus, UserCheck, CalendarClock, CalendarPlus, GitBranch, StickyNote,
  Pencil, Hand, Users, User,
} from 'lucide-react-native';
import { crmApi, teamApi, LeadDetail, LEAD_STAGES, Activity } from '../../services/platform';
import { useApi, useAuth } from '../../hooks/useApi';
import { AiAssistPanel } from '../ai/AiAssistPanel';
import { useWhatsAppEnabled } from '../../hooks/useWhatsApp';
import {
  Page, Section, KeyValue, StatusTag, Tag, Button, Row, ActionTile, ListRow, Sheet, Field, Input, Select, Segmented,
  DateTimeField, SwitchRow, Loading, ErrorView, Empty, formatDate, formatMoney, humanize, timeAgo, toast,
} from '../../ui';
import { TOKENS, TYPE } from '../../theme';

const CALL_OUTCOMES = ['CONNECTED', 'NO_ANSWER', 'BUSY', 'SWITCHED_OFF', 'WRONG_NUMBER', 'CALLBACK_REQUESTED', 'NOT_INTERESTED'];
const WA_KINDS = [
  { label: 'Greeting', value: 'GREETING', description: 'Introduce yourself and the enquiry' },
  { label: 'Follow-up', value: 'FOLLOW_UP', description: 'Check in on their requirement' },
  { label: 'Consultation summary', value: 'CONSULTATION_SUMMARY', description: "Share the expert's recommendation" },
  { label: 'Custom message', value: 'CUSTOM', description: 'Write your own' },
];
const ACTIVITY_FILTERS = [
  { label: 'All', value: '' }, { label: 'Calls', value: 'CALL' }, { label: 'WhatsApp', value: 'WHATSAPP' },
  { label: 'Notes', value: 'NOTE' }, { label: 'Stage', value: 'STAGE_CHANGE' }, { label: 'Quotes', value: 'QUOTATION' },
];

type SheetKind = 'call' | 'whatsapp' | 'stage' | 'note' | 'owner' | 'expert' | null;

export const LeadDetailScreen = ({ navigation, route }: any) => {
  const id: string = route.params.id;
  const { user, can } = useAuth();
  const { data: lead, loading, error, reload, refreshing, refresh } = useApi(() => crmApi.get(id), [id]);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [actFilter, setActFilter] = useState('');

  const activities = useMemo(
    () => (lead?.activities ?? []).filter(a => !actFilter || a.type === actFilter),
    [lead, actFilter],
  );

  if (loading) return <Loading />;
  if (error || !lead) return <ErrorView message={error ?? 'Lead not found'} onRetry={reload} />;
  const p = lead.permissions;
  const closed = lead.stage === 'WON' || lead.stage === 'LOST';

  const startCall = async () => {
    try {
      await Linking.openURL(`tel:${lead.phone}`);
      await crmApi.call(id, { outcome: 'DIALER_OPENED' });
    } catch {
      toast('Could not open the phone dialer on this device', 'error');
    }
    setSheet('call');
  };

  const claim = async () => {
    try {
      await crmApi.owner(id, user!.userId);
      toast('Lead is now yours');
      reload();
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  const toggleOptOut = async (v: boolean) => {
    try {
      await crmApi.update(id, { whatsappOptOut: v });
      toast(v ? 'Customer opted out of WhatsApp' : 'WhatsApp consent restored', 'info');
      reload();
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  return (
    <>
      <Page refreshing={refreshing} onRefresh={refresh}>
        <Section>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={[TYPE.h2, { flex: 1 }]} numberOfLines={2}>{lead.customerName}</Text>
            <StatusTag status={lead.stage} />
          </Row>
          <Row gap={6} wrap>
            <Tag text={humanize(lead.source)} color="green" />
            <StatusTag status={lead.priority} />
            {lead.ownerId === 'UNASSIGNED' && <Tag text="Shared pool" color="orange" />}
            {lead.whatsappOptOut && <Tag text="WhatsApp opt-out" color="red" />}
          </Row>
          <KeyValue label="Phone" value={lead.phone} />
          <KeyValue label="Location" value={lead.location} />
          <KeyValue label="Owner" value={lead.ownerName ?? (lead.ownerId === 'UNASSIGNED' ? 'Unassigned' : undefined)} />
          <KeyValue label="Expert" value={lead.expertName ?? 'None'} />
          <KeyValue label="Last contacted" value={lead.lastContactedAt ? timeAgo(lead.lastContactedAt) : 'Never'} />
          {lead.stage === 'LOST' && <KeyValue label="Lost reason" value={lead.lostReason} />}
          {p.claim && <Button title="Claim this lead" type="primary" icon={Hand} onPress={claim} />}
        </Section>

        <Section title="Quick actions">
          <Row wrap gap={4} style={{ justifyContent: 'flex-start' }}>
            {p.communicate && <ActionTile label="Call" icon={Phone} onPress={startCall} />}
            {p.communicate && <ActionTile label="WhatsApp" icon={MessageCircle} tone="#25A244" disabled={lead.whatsappOptOut}
                                          onPress={() => setSheet('whatsapp')} />}
            {p.quote && <ActionTile label="Create quotation" icon={FileText} disabled={closed}
                                    onPress={() => navigation.navigate('QuotationBuilder', { leadId: id })} />}
            {p.quote && <ActionTile label="Add product" icon={PackagePlus} disabled={closed}
                                    onPress={() => navigation.navigate('QuotationBuilder', { leadId: id, openPicker: true })} />}
            {p.assign && <ActionTile label="Assign expert" icon={UserCheck} onPress={() => setSheet('expert')} />}
            {p.assign && <ActionTile label="Assign owner" icon={Users} onPress={() => setSheet('owner')} />}
            <ActionTile label="Follow-up" icon={CalendarClock}
                        onPress={() => navigation.navigate('TaskForm', { kind: 'FOLLOW_UP', leadId: id, customerName: lead.customerName })} />
            <ActionTile label="Appointment" icon={CalendarPlus}
                        onPress={() => navigation.navigate('TaskForm', { kind: 'APPOINTMENT', leadId: id, customerName: lead.customerName })} />
            {p.edit && <ActionTile label="Update stage" icon={GitBranch} onPress={() => setSheet('stage')} />}
            <ActionTile label="Add note" icon={StickyNote} onPress={() => setSheet('note')} />
            {p.edit && <ActionTile label="Edit details" icon={Pencil} onPress={() => navigation.navigate('LeadForm', { id })} />}
            {!!lead.customerId && <ActionTile label="Customer profile" icon={User}
                                              onPress={() => navigation.navigate('CustomerProfile', { customerId: lead.customerId })} />}
          </Row>
        </Section>

        <AiAssistPanel feature="LEAD_SUMMARY" context={{ leadId: id }}
                       modes={[{ label: 'Summarise', mode: 'summary' }, { label: 'Next actions', mode: 'next_actions' },
                               { label: 'Requirements', mode: 'requirements' }, { label: 'Draft message', mode: 'draft_message' }]} />

        <Section title="Requirement">
          <Text style={TYPE.body}>{lead.requirement}</Text>
          <KeyValue label="Crop" value={lead.cropName} />
          <KeyValue label="Farm size" value={lead.farmSize} />
          <KeyValue label="Budget" value={lead.budget != null ? formatMoney(lead.budget) : undefined} />
          <KeyValue label="Product interest" value={lead.productInterest} />
          <KeyValue label="Notes" value={lead.notes} />
          <KeyValue label="Email" value={lead.email} />
          <KeyValue label="Created" value={formatDate(lead.createdAt)} />
        </Section>

        {!!lead.consultations.length && (
          <Section title="Consultations">
            {lead.consultations.map(c => (
              <ListRow key={c.consultationId} title={`${c.cropName} · ${humanize(c.severity)}`}
                       subtitle={c.expertName ? `Expert: ${c.expertName}` : 'Awaiting expert'} meta={formatDate(c.createdAt, false)}
                       right={<StatusTag status={c.status} small />}
                       onPress={() => navigation.navigate('ConsultationDetail', { id: c.consultationId })} />
            ))}
          </Section>
        )}

        {can('quotation.view') && (
          <Section title="Quotations" extra={p.quote && !closed ? (
            <Button title="New" size="sm" type="text" onPress={() => navigation.navigate('QuotationBuilder', { leadId: id })} />) : undefined}>
            {!lead.quotations.length && <Text style={TYPE.secondary}>No quotations yet.</Text>}
            {lead.quotations.map(q => (
              <ListRow key={q.quotationId} title={q.quotationNumber} subtitle={formatMoney(q.grandTotal)}
                       meta={`Valid until ${q.validUntil}`} right={<StatusTag status={q.status} small />}
                       onPress={() => navigation.navigate('QuotationDetail', { id: q.quotationId })} />
            ))}
          </Section>
        )}

        <Section title="Follow-ups & appointments">
          {!lead.tasks.length && <Text style={TYPE.secondary}>Nothing scheduled.</Text>}
          {lead.tasks.map(t => (
            <ListRow key={t.taskId} title={t.title} subtitle={`${humanize(t.kind)} · ${t.assigneeName}`}
                     meta={<Text style={[TYPE.caption, t.isOverdue && { color: TOKENS.colorError, fontWeight: '600' }]}>
                       {t.isOverdue ? 'Overdue · ' : ''}{formatDate(t.dueAt)}</Text>}
                     right={<StatusTag status={t.status} small />}
                     onPress={() => navigation.navigate('TaskForm', { taskId: t.taskId })} />
          ))}
        </Section>

        {p.communicate && (
          <Section title="Communication consent">
            <SwitchRow label="Customer opted out of WhatsApp" description="Blocks WhatsApp sharing from the app for this lead"
                       value={!!lead.whatsappOptOut} onChange={toggleOptOut} disabled={!p.edit} />
          </Section>
        )}

        <Section title="Activity">
          <Segmented value={actFilter} options={ACTIVITY_FILTERS} onChange={setActFilter} />
          {!activities.length && <Empty title="No activity" />}
          {activities.map(a => <ActivityRow key={a.activityId} a={a} />)}
        </Section>
      </Page>

      <CallSheet visible={sheet === 'call'} leadId={id} onClose={() => setSheet(null)} onSaved={() => { setSheet(null); reload(); }} />
      <WhatsAppSheet visible={sheet === 'whatsapp'} lead={lead} onClose={() => setSheet(null)} onSent={() => { setSheet(null); reload(); }} />
      <StageSheet key={lead.stage} visible={sheet === 'stage'} lead={lead} onClose={() => setSheet(null)} onSaved={() => { setSheet(null); reload(); }} />
      <NoteSheet visible={sheet === 'note'} leadId={id} onClose={() => setSheet(null)} onSaved={() => { setSheet(null); reload(); }} />
      <PersonSheet visible={sheet === 'owner' || sheet === 'expert'} kind={sheet === 'expert' ? 'EXPERT' : 'STAFF'} lead={lead}
                   onClose={() => setSheet(null)} onSaved={() => { setSheet(null); reload(); }} />
    </>
  );
};

const ACTIVITY_COLOR: Record<string, string> = {
  CALL: 'blue', WHATSAPP: 'green', NOTE: 'gold', STAGE_CHANGE: 'purple', QUOTATION: 'cyan', CONSULTATION: 'green', ASSIGNMENT: 'orange',
};

const ActivityRow = ({ a }: { a: Activity }) => (
  <View style={{ flexDirection: 'row', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: TOKENS.colorSplit }}>
    <View style={{ width: 4, borderRadius: 2, backgroundColor: TOKENS.colorPrimaryBorder }} />
    <View style={{ flex: 1, gap: 3 }}>
      <Row gap={6}>
        <Tag text={humanize(a.type)} color={ACTIVITY_COLOR[a.type] ?? 'default'} small />
        <Text style={TYPE.caption}>{a.actorName} · {timeAgo(a.createdAt)}</Text>
      </Row>
      <Text style={TYPE.body}>{a.text}</Text>
      {a.type === 'CALL' && a.data?.outcome && a.data.outcome !== 'DIALER_OPENED' && (
        <Text style={TYPE.caption}>Outcome reported by user{a.data.durationSec ? ` · ${Math.round(a.data.durationSec / 60)} min` : ''}</Text>
      )}
      {a.type === 'WHATSAPP' && a.data?.direction !== 'INBOUND' && (a.data?.channel === 'CLOUD_API'
        ? <Text style={[TYPE.caption, a.data?.deliveryStatus === 'FAILED' && { color: TOKENS.colorError }]}>
            WhatsApp Business · {humanize(a.data?.deliveryStatus ?? 'ACCEPTED')}{a.data?.error ? ` — ${a.data.error}` : ''}</Text>
        : <Text style={TYPE.caption}>Delivery not tracked (opened WhatsApp click-to-chat)</Text>)}
      {a.data?.direction === 'INBOUND' && <Text style={TYPE.caption}>Received on WhatsApp Business</Text>}
    </View>
  </View>
);

const CallSheet = ({ visible, leadId, onClose, onSaved }: { visible: boolean; leadId: string; onClose: () => void; onSaved: () => void }) => {
  const [outcome, setOutcome] = useState('');
  const [notes, setNotes] = useState('');
  const [minutes, setMinutes] = useState('');
  const [next, setNext] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await crmApi.call(leadId, { outcome, notes: notes || undefined, nextFollowUpAt: next,
                                  durationSec: minutes ? Math.round(Number(minutes) * 60) : undefined });
      toast('Call recorded');
      setOutcome(''); setNotes(''); setMinutes(''); setNext(null);
      onSaved();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };
  return (
    <Sheet visible={visible} onClose={onClose} title="How did the call go?"
           footer={<Button title="Save call outcome" type="primary" block disabled={!outcome} loading={saving} onPress={save} />}>
      <View style={{ gap: 12 }}>
        <Text style={TYPE.secondary}>Opening the dialer was logged. Record what actually happened — the app cannot detect it.</Text>
        <Field label="Outcome" required>
          <Select value={outcome} onChange={setOutcome} title="Call outcome" options={CALL_OUTCOMES.map(o => ({ label: humanize(o), value: o }))} />
        </Field>
        {outcome === 'CONNECTED' && (
          <Field label="Duration (minutes)"><Input value={minutes} onChangeText={setMinutes} keyboardType="numeric" /></Field>
        )}
        <Field label="Notes"><Input value={notes} onChangeText={setNotes} multiline placeholder="What did the customer say?" /></Field>
        <Field label="Schedule next follow-up"><DateTimeField value={next} onChange={setNext} /></Field>
      </View>
    </Sheet>
  );
};

const WhatsAppSheet = ({ visible, lead, onClose, onSent }: { visible: boolean; lead: LeadDetail; onClose: () => void; onSent: () => void }) => {
  const [kind, setKind] = useState('GREETING');
  const [text, setText] = useState('');
  const [sending, setSending] = useState<string | null>(null);
  const apiEnabled = useWhatsAppEnabled();
  const kinds = WA_KINDS.filter(k => k.value !== 'CONSULTATION_SUMMARY' || lead.consultationId);
  const send = async (viaApi = false) => {
    setSending(viaApi ? 'api' : 'link');
    try {
      const res = await crmApi.whatsapp(lead.leadId, kind, kind === 'CUSTOM' ? text : undefined, viaApi);
      if (viaApi) toast('Sent via WhatsApp Business — delivery status will update on the lead');
      else if (res.url) await Linking.openURL(res.url);
      onSent();
    } catch (e: any) {
      toast(e.message ?? 'Could not open WhatsApp', 'error');
    } finally {
      setSending(null);
    }
  };
  const blocked = kind === 'CUSTOM' && !text.trim();
  return (
    <Sheet visible={visible} onClose={onClose} title={`WhatsApp ${lead.customerName}`}
           footer={<View style={{ gap: 8 }}>
             {apiEnabled && <Button title="Send via WhatsApp Business" type="primary" block icon={MessageCircle} loading={sending === 'api'}
                                    disabled={blocked || !!sending} onPress={() => send(true)} />}
             <Button title="Open WhatsApp" type={apiEnabled ? 'default' : 'primary'} block icon={MessageCircle} loading={sending === 'link'}
                     disabled={blocked || !!sending} onPress={() => send(false)} />
           </View>}>
      <View style={{ gap: 12 }}>
        <Field label="Message">
          <Select value={kind} onChange={setKind} options={kinds} title="Message type" />
        </Field>
        {kind === 'CUSTOM' && <Input value={text} onChangeText={setText} multiline placeholder="Type your message" />}
        <Text style={TYPE.caption}>{apiEnabled
          ? 'Business API: sent directly with delivery/read tracking (needs an approved template if the customer has not messaged in 24h). Open WhatsApp: you send it yourself, not tracked.'
          : "The message is prepared from this lead's real data and opens in WhatsApp for you to send. Delivery is not tracked."}</Text>
      </View>
    </Sheet>
  );
};

const StageSheet = ({ visible, lead, onClose, onSaved }: { visible: boolean; lead: LeadDetail; onClose: () => void; onSaved: () => void }) => {
  const [stage, setStage] = useState(lead.stage);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await crmApi.stage(lead.leadId, stage, reason || undefined);
      toast(`Moved to ${humanize(stage)}`);
      onSaved();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };
  return (
    <Sheet visible={visible} onClose={onClose} title="Update stage"
           footer={<Button title="Save" type="primary" block loading={saving} disabled={stage === lead.stage || (stage === 'LOST' && !reason.trim())} onPress={save} />}>
      <View style={{ gap: 6 }}>
        {LEAD_STAGES.map(s => (
          <TouchableOpacity key={s} onPress={() => setStage(s)} accessibilityRole="radio" accessibilityState={{ checked: s === stage }}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 }}>
            <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: s === stage ? TOKENS.colorPrimary : TOKENS.colorBorder,
                           alignItems: 'center', justifyContent: 'center' }}>
              {s === stage && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: TOKENS.colorPrimary }} />}
            </View>
            <Text style={TYPE.body}>{humanize(s)}</Text>
            {s === lead.stage && <Tag text="current" small />}
          </TouchableOpacity>
        ))}
        {stage === 'LOST' && (
          <Field label="Why was it lost?" required>
            <Input value={reason} onChangeText={setReason} placeholder="e.g. Price too high, bought elsewhere" multiline />
          </Field>
        )}
        {stage !== 'LOST' && stage !== lead.stage && (
          <Field label="Note (optional)"><Input value={reason} onChangeText={setReason} /></Field>
        )}
      </View>
    </Sheet>
  );
};

const NoteSheet = ({ visible, leadId, onClose, onSaved }: { visible: boolean; leadId: string; onClose: () => void; onSaved: () => void }) => {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await crmApi.note(leadId, text.trim());
      setText('');
      toast('Note added');
      onSaved();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };
  return (
    <Sheet visible={visible} onClose={onClose} title="Internal note"
           footer={<Button title="Add note" type="primary" block disabled={!text.trim()} loading={saving} onPress={save} />}>
      <Input value={text} onChangeText={setText} multiline placeholder="Customer requirements, observations, next steps…" style={{ minHeight: 120 }} />
    </Sheet>
  );
};

const PersonSheet = ({ visible, kind, lead, onClose, onSaved }: {
  visible: boolean; kind: 'STAFF' | 'EXPERT'; lead: LeadDetail; onClose: () => void; onSaved: () => void;
}) => {
  const people = useApi(() => (visible ? teamApi.assignable(kind) : Promise.resolve({ items: [] })), [visible, kind], { focus: false });
  const [selected, setSelected] = useState('');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      if (kind === 'EXPERT') await crmApi.expert(lead.leadId, selected);
      else await crmApi.owner(lead.leadId, selected);
      toast('Updated');
      onSaved();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };
  const options = [
    ...(kind === 'STAFF' ? [{ label: 'Shared pool (unassigned)', value: 'UNASSIGNED' }] : []),
    ...(people.data?.items ?? []).map(u => ({
      label: u.name, value: u.userId,
      description: kind === 'EXPERT' ? `${(u.specializations ?? []).join(', ')} · ${u.activeConsultationCount ?? 0} active` : undefined,
    })),
  ];
  return (
    <Sheet visible={visible} onClose={onClose} title={kind === 'EXPERT' ? 'Assign expert' : 'Assign owner'}
           footer={<Button title="Assign" type="primary" block disabled={!selected} loading={saving} onPress={save} />}>
      <Select value={selected} onChange={setSelected} options={options} title={kind === 'EXPERT' ? 'Expert' : 'Owner'}
              placeholder={people.loading ? 'Loading…' : 'Choose'} />
    </Sheet>
  );
};
