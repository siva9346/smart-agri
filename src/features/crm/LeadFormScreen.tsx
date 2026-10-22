import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { crmApi, teamApi, Lead, LEAD_SOURCES, PRIORITIES } from '../../services/platform';
import { useApi, useAuth } from '../../hooks/useApi';
import { Page, Section, Field, Input, Select, Segmented, Button, Alert, DateTimeField, Row, ListRow, Sheet, Loading, humanize, toast } from '../../ui';
import { TYPE } from '../../theme';

const EMPTY = {
  customerName: '', phone: '', location: '', source: 'PHONE_CALL', requirement: '', priority: 'MEDIUM', ownerId: '',
  email: '', cropName: '', farmSize: '', budget: '', productInterest: '', expertId: '', notes: '',
};

/** Manual lead creation (and editing of an existing lead's details). */
export const LeadFormScreen = ({ navigation, route }: any) => {
  const editId: string | undefined = route.params?.id;
  const { can, user } = useAuth();
  const [form, setForm] = useState({ ...EMPTY });
  const [followUp, setFollowUp] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [dups, setDups] = useState<Lead[] | null>(null);
  const [loadingLead, setLoadingLead] = useState(!!editId);
  const staff = useApi(() => (can('lead.assign') ? teamApi.assignable('STAFF') : Promise.resolve({ items: [] })), [], { focus: false });
  const experts = useApi(() => teamApi.assignable('EXPERT'), [], { focus: false });

  useEffect(() => {
    if (!editId) return;
    crmApi.get(editId).then(l => {
      setForm({
        ...EMPTY, customerName: l.customerName, phone: l.phone, location: l.location, source: l.source,
        requirement: l.requirement, priority: l.priority, email: l.email ?? '', cropName: l.cropName ?? '',
        farmSize: l.farmSize ?? '', budget: l.budget != null ? String(l.budget) : '', productInterest: l.productInterest ?? '',
        notes: l.notes ?? '',
      });
      navigation.setOptions({ title: 'Edit lead' });
    }).catch(e => toast(e.message, 'error')).finally(() => setLoadingLead(false));
  }, [editId, navigation]);

  const set = (k: keyof typeof EMPTY) => (v: string) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: '' })); };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.customerName.trim()) e.customerName = 'Required';
    if (!/^\+?[0-9\s\-()]{8,18}$/.test(form.phone.trim())) e.phone = 'Enter a valid phone number';
    if (!form.location.trim()) e.location = 'Required';
    if (!form.requirement.trim()) e.requirement = 'What does the customer need?';
    if (form.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) e.email = 'Invalid email';
    if (form.budget && isNaN(Number(form.budget))) e.budget = 'Numbers only';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const payload = (force = false) => ({
    ...form, force, nextFollowUpAt: followUp,
    ownerId: form.ownerId || undefined, expertId: form.expertId || undefined,
    budget: form.budget ? Number(form.budget) : undefined,
  });

  const save = async (force = false) => {
    if (!validate()) return;
    setSaving(true);
    try {
      if (editId) {
        const { customerName, location, requirement, priority, email, cropName, farmSize, productInterest, notes } = form;
        await crmApi.update(editId, { customerName, location, requirement, priority, email, cropName, farmSize, productInterest, notes,
                                      budget: form.budget ? Number(form.budget) : null });
        toast('Lead updated');
        navigation.goBack();
      } else {
        const lead = await crmApi.create(payload(force));
        toast('Lead created');
        navigation.replace('LeadDetail', { id: lead.leadId });
      }
    } catch (e: any) {
      const res = e?.status === 409 ? await crmApi.duplicates(form.phone.replace(/[\s\-()]/g, '')).catch(() => null) : null;
      if (res?.items?.length) setDups(res.items);
      else toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loadingLead) return <Loading />;
  const sourceOptions = LEAD_SOURCES.filter(s => s !== 'EXPERT_CONSULTATION').map(s => ({ label: humanize(s), value: s }));

  return (
    <Page keyboard>
      <Section title="Customer">
        <Field label="Customer name" required error={errors.customerName}>
          <Input value={form.customerName} onChangeText={set('customerName')} error={!!errors.customerName} />
        </Field>
        <Field label="Phone" required error={errors.phone} help={editId ? 'Phone cannot be changed' : undefined}>
          <Input value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" editable={!editId} error={!!errors.phone} />
        </Field>
        <Field label="Location" required error={errors.location}>
          <Input value={form.location} onChangeText={set('location')} placeholder="Village, district" error={!!errors.location} />
        </Field>
        <Field label="Email" error={errors.email}>
          <Input value={form.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" />
        </Field>
      </Section>

      <Section title="Requirement">
        {!editId && (
          <Field label="Lead source" required>
            <Select value={form.source} options={sourceOptions} onChange={set('source')} title="Lead source" />
          </Field>
        )}
        <Field label="Customer requirement" required error={errors.requirement}>
          <Input value={form.requirement} onChangeText={set('requirement')} multiline error={!!errors.requirement}
                 placeholder="e.g. Needs drip irrigation for 2 acres of banana" />
        </Field>
        <Field label="Priority" required>
          <Segmented value={form.priority} options={PRIORITIES.map(p => ({ label: humanize(p), value: p }))} onChange={set('priority')} />
        </Field>
        <Row gap={10} style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}><Field label="Crop"><Input value={form.cropName} onChangeText={set('cropName')} /></Field></View>
          <View style={{ flex: 1 }}><Field label="Farm size"><Input value={form.farmSize} onChangeText={set('farmSize')} placeholder="e.g. 3 acres" /></Field></View>
        </Row>
        <Field label="Budget (₹)" error={errors.budget}><Input value={form.budget} onChangeText={set('budget')} keyboardType="numeric" /></Field>
        <Field label="Product interest"><Input value={form.productInterest} onChangeText={set('productInterest')} /></Field>
        <Field label="Notes"><Input value={form.notes} onChangeText={set('notes')} multiline /></Field>
      </Section>

      {!editId && (
        <Section title="Assignment & follow-up">
          {can('lead.assign') ? (
            <Field label="Owner" help="Leave empty to put the lead in the shared pool">
              <Select value={form.ownerId} onChange={set('ownerId')} title="Owner"
                      options={[{ label: 'Shared pool (unassigned)', value: '' }, { label: `Me (${user?.name})`, value: user?.userId ?? '' },
                                ...(staff.data?.items ?? []).filter(s => s.userId !== user?.userId).map(s => ({ label: s.name, value: s.userId }))]} />
            </Field>
          ) : <Text style={TYPE.secondary}>This lead will be assigned to you.</Text>}
          <Field label="Expert (optional)">
            <Select value={form.expertId} onChange={set('expertId')} title="Expert"
                    options={[{ label: 'None', value: '' }, ...(experts.data?.items ?? []).map(e => ({
                      label: e.name, value: e.userId, description: (e.specializations ?? []).join(', '),
                    }))]} />
          </Field>
          <Field label="Next follow-up">
            <DateTimeField value={followUp} onChange={setFollowUp} />
          </Field>
        </Section>
      )}

      {Object.values(errors).some(Boolean) && <Alert type="error" message="Please fix the highlighted fields." />}
      <Button title={editId ? 'Save changes' : 'Create lead'} type="primary" block loading={saving} onPress={() => save(false)} />

      <Sheet visible={!!dups} onClose={() => setDups(null)} title="Possible duplicate"
             footer={<Button title="Create a new lead anyway" onPress={() => { setDups(null); save(true); }} />}>
        <Text style={[TYPE.secondary, { marginBottom: 8 }]}>
          Open leads already use this phone number. Continue with an existing lead to keep the customer's history together.
        </Text>
        {(dups ?? []).map(d => <ListRow key={d.leadId} title={d.customerName} subtitle={d.requirement}
                                        meta={`${humanize(d.stage)}${d.ownerName ? ' · ' + d.ownerName : ''}`}
                                        onPress={() => { setDups(null); navigation.replace('LeadDetail', { id: d.leadId }); }} />)}
      </Sheet>
    </Page>
  );
};
