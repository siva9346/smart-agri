import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { teamApi, TeamUser } from '../../../services/platform';
import { useAuth } from '../../../hooks/useApi';
import { Page, Section, Field, Input, Segmented, SwitchRow, Button, Row, Tag, ConfirmDialog, Loading, humanize, toast } from '../../../ui';
import { TYPE } from '../../../theme';

const SUGGESTED_SPECS = ['general', 'tomato', 'paddy', 'banana', 'coconut', 'vegetables', 'fruits', 'horticulture',
  'field crops', 'cereals', 'oilseeds', 'plant pathology', 'entomology', 'soil science', 'agronomy', 'water management'];

/** Create or edit a staff / expert / admin account. */
export const UserFormScreen = ({ navigation, route }: any) => {
  const { userId } = route.params ?? {};
  const { isSuper } = useAuth();
  const [user, setUser] = useState<TeamUser | null>(null);
  const [loading, setLoading] = useState(!!userId);
  const [form, setForm] = useState<any>({
    role: route.params?.role ?? 'STAFF', name: '', phone: '', email: '', password: '', department: '', jobTitle: '',
    responsibilities: '', qualifications: '', experienceYears: '', maxActiveConsultations: '', specializations: [] as string[],
    isAvailable: true, isActive: true,
  });
  const [spec, setSpec] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);

  useEffect(() => {
    if (!userId) return;
    teamApi.get(userId).then(u => {
      setUser(u);
      setForm((f: any) => ({ ...f, ...u, experienceYears: u.experienceYears != null ? String(u.experienceYears) : '',
                             maxActiveConsultations: u.maxActiveConsultations != null ? String(u.maxActiveConsultations) : '',
                             specializations: u.specializations ?? [] }));
      navigation.setOptions({ title: u.name });
    }).catch(e => toast(e.message, 'error')).finally(() => setLoading(false));
  }, [userId, navigation]);

  const set = (k: string) => (v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const addSpec = (s: string) => {
    const v = s.trim().toLowerCase();
    if (v && !form.specializations.includes(v)) set('specializations')([...form.specializations, v]);
    setSpec('');
  };

  const save = async (overrides: object = {}) => {
    setSaving(true);
    const isExpert = form.role === 'EXPERT';
    const body: any = {
      name: form.name, email: form.email, role: form.role, department: form.department, jobTitle: form.jobTitle,
      responsibilities: form.responsibilities, qualifications: form.qualifications,
      ...(isExpert ? {
        specializations: form.specializations, isAvailable: form.isAvailable,
        maxActiveConsultations: form.maxActiveConsultations ? Number(form.maxActiveConsultations) : undefined,
        experienceYears: form.experienceYears ? Number(form.experienceYears) : undefined,
      } : {}),
      ...overrides,
    };
    try {
      if (user) {
        setUser(await teamApi.update(user.userId, body));
        toast('Saved');
      } else {
        await teamApi.create({ ...body, phone: form.phone, password: form.password });
        toast(`${humanize(form.role)} account created`);
        navigation.goBack();
      }
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading />;
  const roleOptions = [{ label: 'Staff', value: 'STAFF' }, { label: 'Expert', value: 'EXPERT' }, ...(isSuper ? [{ label: 'Admin', value: 'ADMIN' }] : [])];

  return (
    <Page keyboard>
      <Section title="Account">
        <Field label="Role"><Segmented value={form.role} options={roleOptions} onChange={set('role')} /></Field>
        <Field label="Full name" required><Input value={form.name} onChangeText={set('name')} /></Field>
        <Field label="Phone" required help={user ? 'Login phone cannot be changed' : 'Used to log in'}>
          <Input value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" editable={!user} />
        </Field>
        <Field label="Email" required><Input value={form.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" /></Field>
        {!user && <Field label="Temporary password" required help="At least 6 characters; ask them to change it after first login">
          <Input value={form.password} onChangeText={set('password')} secureTextEntry />
        </Field>}
      </Section>

      <Section title="Responsibilities">
        <Row gap={10} style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}><Field label="Department"><Input value={form.department ?? ''} onChangeText={set('department')} /></Field></View>
          <View style={{ flex: 1 }}><Field label="Job title"><Input value={form.jobTitle ?? ''} onChangeText={set('jobTitle')} /></Field></View>
        </Row>
        <Field label="Responsibilities"><Input value={form.responsibilities ?? ''} onChangeText={set('responsibilities')} multiline /></Field>
      </Section>

      {form.role === 'EXPERT' && (
        <Section title="Expert settings">
          <Field label="Crop specializations" help="Exact crops (e.g. tomato), categories (vegetables), or 'general'. Drives automatic assignment.">
            <Row gap={6} wrap>
              {form.specializations.map((s: string) => (
                <TouchableOpacity key={s} onPress={() => set('specializations')(form.specializations.filter((x: string) => x !== s))} accessibilityLabel={`Remove ${s}`}>
                  <Tag text={`${s}  ✕`} color="green" />
                </TouchableOpacity>
              ))}
            </Row>
            <Input value={spec} onChangeText={setSpec} placeholder="Type and press enter" onSubmitEditing={() => addSpec(spec)} returnKeyType="done" />
            <Row gap={6} wrap>
              {SUGGESTED_SPECS.filter(s => !form.specializations.includes(s)).map(s => (
                <TouchableOpacity key={s} onPress={() => addSpec(s)}><Tag text={`+ ${s}`} /></TouchableOpacity>
              ))}
            </Row>
          </Field>
          <Row gap={10} style={{ alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}><Field label="Max active consultations"><Input value={form.maxActiveConsultations} onChangeText={set('maxActiveConsultations')} keyboardType="number-pad" placeholder="Default" /></Field></View>
            <View style={{ flex: 1 }}><Field label="Experience (years)"><Input value={form.experienceYears} onChangeText={set('experienceYears')} keyboardType="number-pad" /></Field></View>
          </Row>
          <Field label="Qualifications"><Input value={form.qualifications ?? ''} onChangeText={set('qualifications')} /></Field>
          <SwitchRow label="Available for new assignments" value={form.isAvailable !== false} onChange={set('isAvailable')} />
          {user && <Text style={TYPE.caption}>Currently handling {user.activeConsultationCount ?? 0} consultation(s).</Text>}
        </Section>
      )}

      <Button title={user ? 'Save changes' : 'Create account'} type="primary" block loading={saving} onPress={() => save()} />
      {user && (
        user.isActive
          ? <Button title="Deactivate account" type="danger" block onPress={() => setConfirmDeactivate(true)} />
          : <Button title="Reactivate account" block onPress={() => save({ isActive: true })} />
      )}
      <ConfirmDialog visible={confirmDeactivate} title="Deactivate this account?" danger confirmText="Deactivate"
                     message="They will be signed out of every action immediately. Experts stop receiving new assignments; reassign their open consultations."
                     onCancel={() => setConfirmDeactivate(false)}
                     onConfirm={() => { setConfirmDeactivate(false); save({ isActive: false }); }} />
    </Page>
  );
};
