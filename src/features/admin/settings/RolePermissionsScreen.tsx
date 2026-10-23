import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { adminApi } from '../../../services/platform';
import { useApi } from '../../../hooks/useApi';
import { Page, Section, Segmented, SwitchRow, Button, Alert, Loading, ErrorView, Tag, toast } from '../../../ui';
import { TYPE } from '../../../theme';

const EDITABLE_ROLES = [
  { label: 'Admin', value: 'ADMIN' }, { label: 'Staff', value: 'STAFF' }, { label: 'Expert', value: 'EXPERT' }, { label: 'Customer', value: 'FARMER' },
];

const LABELS: Record<string, string> = {
  'crm.view': 'Open the CRM', 'crm.view_all': 'See every lead', 'lead.create': 'Create leads', 'lead.edit': 'Edit leads & stages',
  'lead.assign': 'Assign lead owners / experts', 'lead.communicate': 'Call & WhatsApp customers',
  'consultation.create': 'Request expert consultations', 'consultation.assign': 'Assign consultations to experts',
  'consultation.recommend': 'Give recommendations', 'product.view': 'Browse the product catalogue', 'quotation.view': 'View quotations', 'quotation.create': 'Create quotations',
  'quotation.approve': 'Approve quotations', 'quotation.share': 'Share quotations', 'quotation.respond': 'Accept / reject quotations',
  'tasks.manage': 'Manage own tasks', 'tasks.assign_others': "Manage others' tasks", 'users.manage': 'Manage team users',
  'announcements.send': 'Send announcements', 'reports.team': 'Team reports', 'settings.assignment': 'Edit assignment rules',
  'settings.quotation': 'Edit quotation settings', 'settings.permissions': 'Edit role permissions',
  'ai.configure': 'Configure AI providers', 'ai.use': 'Use AI features', 'audit.view': 'View audit logs', 'profile.edit': 'Edit own profile',
};

/** Super Admin: grant/revoke permissions per role on top of the defaults. Customers can only hold customer permissions. */
export const RolePermissionsScreen = () => {
  const { data, loading, error, reload } = useApi(() => adminApi.permissions(), [], { focus: false });
  const [role, setRole] = useState('ADMIN');
  const [grants, setGrants] = useState<Record<string, string[]>>({});
  const [revokes, setRevokes] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    setGrants(data.overrides.grants ?? {});
    setRevokes(data.overrides.revokes ?? {});
  }, [data]);

  if (loading) return <Loading />;
  if (error || !data) return <ErrorView message={error ?? 'Failed'} onRetry={reload} />;

  const defaults: string[] = data.defaults[role] ?? [];
  const catalog: string[] = role === 'FARMER' ? data.customerAllowed : data.catalog;
  const effective = (p: string) => (defaults.includes(p) || (grants[role] ?? []).includes(p)) && !(revokes[role] ?? []).includes(p);
  const toggle = (p: string, on: boolean) => {
    const g = new Set(grants[role] ?? []);
    const r = new Set(revokes[role] ?? []);
    if (on) { r.delete(p); if (!defaults.includes(p)) g.add(p); } else { g.delete(p); if (defaults.includes(p)) r.add(p); }
    setGrants({ ...grants, [role]: [...g] });
    setRevokes({ ...revokes, [role]: [...r] });
  };

  const save = async () => {
    setSaving(true);
    try {
      await adminApi.saveSetting('permissions', { grants, revokes });
      toast('Permissions saved — users pick them up on next sign-in');
      reload();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page>
      <Alert type="warning" message="Changes apply on the server immediately. Super Admin always keeps every permission." />
      <Segmented value={role} options={EDITABLE_ROLES} onChange={setRole} />
      <Section title="Permissions">
        {catalog.map(p => (
          <SwitchRow key={p} label={LABELS[p] ?? p} value={effective(p)} onChange={v => toggle(p, v)}
                     description={`${p}${defaults.includes(p) ? ' · default' : ''}`}
                     disabled={role === 'ADMIN' && p === 'settings.permissions'} />
        ))}
        {role === 'FARMER' && <Text style={TYPE.caption}>Customers can never be given internal CRM or admin permissions.</Text>}
      </Section>
      <Section title="Overrides">
        {Object.entries(grants).flatMap(([r, ps]) => ps.map(p => <Tag key={`g${r}${p}`} text={`+ ${r}: ${p}`} color="green" />))}
        {Object.entries(revokes).flatMap(([r, ps]) => ps.map(p => <Tag key={`r${r}${p}`} text={`− ${r}: ${p}`} color="red" />))}
      </Section>
      <Button title="Save permissions" type="primary" block loading={saving} onPress={save} />
    </Page>
  );
};
