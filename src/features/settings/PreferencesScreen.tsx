import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { profileApi } from '../../services/platform';
import { useApi, useAuth } from '../../hooks/useApi';
import { Page, Section, Field, Input, Select, Segmented, SwitchRow, Button, KeyValue, Loading, ErrorView, Tag, Row, humanize, toast } from '../../ui';
import { TYPE } from '../../theme';

const LANGUAGES = [
  { label: 'English', value: 'en' }, { label: 'தமிழ் (Tamil)', value: 'ta' }, { label: 'हिन्दी (Hindi)', value: 'hi' },
  { label: 'తెలుగు (Telugu)', value: 'te' }, { label: 'ಕನ್ನಡ (Kannada)', value: 'kn' }, { label: 'മലയാളം (Malayalam)', value: 'ml' },
];
const TIMEZONES = ['Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Europe/London', 'UTC'].map(z => ({ label: z, value: z }));
const NOTIF_LABELS: Record<string, string> = {
  inApp: 'In-app notifications', push: 'Push notifications', whatsapp: 'WhatsApp messages from our team',
  announcements: 'Announcements', consultations: 'Consultation updates', quotations: 'Quotations', crmTasks: 'CRM tasks', reminders: 'Reminders',
};

/** Preferences + role-specific profile fields. Role and permissions are shown read-only and can't be changed here. */
export const PreferencesScreen = () => {
  const { role } = useAuth();
  const { data, setData, loading, error, reload } = useApi(() => profileApi.get(), []);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (data) setForm(data); }, [data]);

  if (loading) return <Loading />;
  if (error || !data) return <ErrorView message={error ?? 'Failed'} onRetry={reload} />;
  const set = (k: string) => (v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const prefs = form.notificationPrefs ?? {};

  const save = async () => {
    setSaving(true);
    const fields = ['language', 'timezone', 'location', 'notificationPrefs',
      ...(role === 'FARMER' ? ['farmLocation', 'farmingPreferences', 'preferredContactMethod'] : []),
      ...(role === 'STAFF' ? ['workPreferences'] : []),
      ...(role === 'EXPERT' ? ['qualifications', 'consultationPreferences', 'bio', 'isAvailable', 'experienceYears'] : [])];
    const body: any = {};
    fields.forEach(f => { if (form[f] !== undefined) body[f] = form[f]; });
    if (body.experienceYears !== undefined) body.experienceYears = Number(body.experienceYears) || 0;
    try {
      setData(await profileApi.update(body));
      toast('Preferences saved');
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page keyboard>
      <Section title="General">
        <Field label="Preferred language"><Select value={form.language ?? 'en'} options={LANGUAGES} onChange={set('language')} title="Language" /></Field>
        <Field label="Time zone"><Select value={form.timezone ?? 'Asia/Kolkata'} options={TIMEZONES} onChange={set('timezone')} title="Time zone" /></Field>
        <Field label="Location"><Input value={form.location ?? ''} onChangeText={set('location')} /></Field>
      </Section>

      {role === 'FARMER' && (
        <Section title="Farming">
          <Field label="Farm location"><Input value={form.farmLocation ?? ''} onChangeText={set('farmLocation')} /></Field>
          <Field label="Farming preferences" help="e.g. Organic only, drip irrigation"><Input value={form.farmingPreferences ?? ''} onChangeText={set('farmingPreferences')} multiline /></Field>
          <Field label="Preferred contact method">
            <Segmented value={form.preferredContactMethod ?? 'IN_APP'} onChange={set('preferredContactMethod')}
                       options={[{ label: 'In app', value: 'IN_APP' }, { label: 'Call', value: 'CALL' }, { label: 'WhatsApp', value: 'WHATSAPP' }]} />
          </Field>
        </Section>
      )}

      {role === 'STAFF' && (
        <Section title="Work">
          <KeyValue label="Department" value={data.department ?? '—'} />
          <KeyValue label="Job title" value={data.jobTitle ?? '—'} />
          <KeyValue label="Responsibilities" value={data.responsibilities ?? '—'} />
          <Field label="Work preferences"><Input value={form.workPreferences ?? ''} onChangeText={set('workPreferences')} multiline /></Field>
        </Section>
      )}

      {role === 'EXPERT' && (
        <Section title="Expert profile">
          <SwitchRow label="Available for new consultations" description="When off, new requests are routed to other experts"
                     value={form.isAvailable !== false} onChange={set('isAvailable')} />
          <Field label="Crop specializations" help="Managed by your administrator — used for automatic assignment">
            <Row gap={6} wrap>{(data.specializations ?? []).map((s: string) => <Tag key={s} text={s} color="green" />)}
              {!data.specializations?.length && <Text style={TYPE.secondary}>None set</Text>}</Row>
          </Field>
          <Field label="Qualifications"><Input value={form.qualifications ?? ''} onChangeText={set('qualifications')} /></Field>
          <Field label="Years of experience"><Input value={String(form.experienceYears ?? '')} onChangeText={set('experienceYears')} keyboardType="number-pad" /></Field>
          <Field label="Consultation preferences" help="e.g. Field visits on weekends only"><Input value={form.consultationPreferences ?? ''} onChangeText={set('consultationPreferences')} multiline /></Field>
          <Field label="Short bio"><Input value={form.bio ?? ''} onChangeText={set('bio')} multiline /></Field>
        </Section>
      )}

      {(role === 'ADMIN' || role === 'SUPER_ADMIN') && (
        <Section title="Administrative role">
          <KeyValue label="Role" value={humanize(role)} />
          <KeyValue label="Scope" value={role === 'SUPER_ADMIN' ? 'Entire platform' : 'Staff, experts, customers, CRM'} />
          <Text style={TYPE.caption}>{(data.permissions ?? []).length} permissions granted. Roles can only be changed by a Super Admin.</Text>
        </Section>
      )}

      <Section title="Notification preferences">
        {Object.keys(NOTIF_LABELS).filter(k => role !== 'FARMER' || k !== 'crmTasks').map(k => (
          <SwitchRow key={k} label={NOTIF_LABELS[k]} value={prefs[k] !== false}
                     description={k === 'push' ? (data.pushDevices ? `Registered on ${data.pushDevices} device(s)` : 'No device registered yet — allow notifications on your phone') : undefined}
                     onChange={v => set('notificationPrefs')({ ...prefs, [k]: v })} />
        ))}
      </Section>

      <Button title="Save preferences" type="primary" block loading={saving} onPress={save} />
    </Page>
  );
};
