import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Bell, Send } from 'lucide-react-native';
import { announcementApi, teamApi } from '../../../services/platform';
import { api } from '../../../services/api';
import { useApi, useAuth } from '../../../hooks/useApi';
import {
  Page, Section, Field, Input, Select, Segmented, SwitchRow, Button, Row, Tag, Alert, DateTimeField, ConfirmDialog,
  formatDate, humanize, toast,
} from '../../../ui';
import { TOKENS, TYPE } from '../../../theme';

const TYPES = [
  { label: 'General announcement', value: 'GENERAL' }, { label: 'Important update', value: 'IMPORTANT' },
  { label: 'Consultation update', value: 'CONSULTATION' }, { label: 'CRM task reminder', value: 'CRM_TASK' },
  { label: 'Product or service update', value: 'PRODUCT' }, { label: 'System maintenance notice', value: 'MAINTENANCE' },
];
const ROLE_OPTIONS = ['FARMER', 'STAFF', 'EXPERT', 'ADMIN', 'SUPER_ADMIN'];

export const AnnouncementComposerScreen = ({ navigation }: any) => {
  const { isSuper } = useAuth();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState('GENERAL');
  const [priority, setPriority] = useState('NORMAL');
  const [audience, setAudience] = useState('ALL');
  const [roles, setRoles] = useState<string[]>([]);
  const [userIds, setUserIds] = useState<string[]>([]);
  const [actionLink, setActionLink] = useState('');
  const [startsAt, setStartsAt] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [push, setPush] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [sending, setSending] = useState(false);

  const people = useApi(async () => {
    if (audience !== 'USERS') return [];
    const [staff, experts, farmers] = await Promise.all([
      teamApi.assignable('STAFF'), teamApi.assignable('EXPERT'),
      api.get<{ items: any[] }>('/farmers').catch(() => ({ items: [] })),
    ]);
    return [
      ...farmers.items.map(f => ({ label: f.name, value: f.userId, description: `Customer · ${f.phone ?? ''}` })),
      ...staff.items.map(u => ({ label: u.name, value: u.userId, description: 'Staff' })),
      ...experts.items.map(u => ({ label: u.name, value: u.userId, description: 'Expert' })),
    ];
  }, [audience], { focus: false });

  const audiences = [
    { label: isSuper ? 'Everyone' : 'All users (non-admin)', value: 'ALL' }, { label: 'Customers', value: 'CUSTOMERS' },
    { label: 'Staff', value: 'STAFF' }, { label: 'Experts', value: 'EXPERTS' },
    ...(isSuper ? [{ label: 'Admins', value: 'ADMINS' }] : []),
    { label: 'Roles…', value: 'ROLES' }, { label: 'Selected users…', value: 'USERS' },
  ];
  const roleChoices = ROLE_OPTIONS.filter(r => isSuper || !['ADMIN', 'SUPER_ADMIN'].includes(r));
  const errors = useMemo(() => {
    const e: string[] = [];
    if (!title.trim()) e.push('Title is required');
    if (!message.trim()) e.push('Message is required');
    if (audience === 'ROLES' && !roles.length) e.push('Choose at least one role');
    if (audience === 'USERS' && !userIds.length) e.push('Choose at least one user');
    if (startsAt && expiresAt && expiresAt <= startsAt) e.push('Expiry must be after the start time');
    return e;
  }, [title, message, audience, roles, userIds, startsAt, expiresAt]);

  const send = async () => {
    setSending(true);
    try {
      const n = await announcementApi.create({
        title: title.trim(), message: message.trim(), type, priority, audience,
        roles: audience === 'ROLES' ? roles : undefined, userIds: audience === 'USERS' ? userIds : undefined,
        actionLink: actionLink.trim() || undefined, startsAt, expiresAt,
        channels: push ? ['IN_APP', 'PUSH'] : ['IN_APP'],
      });
      toast(n.startsAt && n.startsAt > new Date().toISOString() ? 'Announcement scheduled' : 'Announcement sent');
      navigation.goBack();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setSending(false);
    }
  };

  const audienceLabel = audience === 'ROLES' ? roles.map(humanize).join(', ') : audience === 'USERS' ? `${userIds.length} selected user(s)`
    : audiences.find(a => a.value === audience)?.label;

  return (
    <Page keyboard>
      <Section title="Message">
        <Field label="Title" required><Input value={title} onChangeText={setTitle} maxLength={120} /></Field>
        <Field label="Message" required help={`${message.length}/2000`}>
          <Input value={message} onChangeText={setMessage} multiline maxLength={2000} style={{ minHeight: 120 }} />
        </Field>
        <Field label="Type"><Select value={type} options={TYPES} onChange={setType} title="Type" /></Field>
        <Field label="Priority">
          <Segmented value={priority} onChange={setPriority}
                     options={[{ label: 'Low', value: 'LOW' }, { label: 'Normal', value: 'NORMAL' }, { label: 'High', value: 'HIGH' }]} />
        </Field>
      </Section>

      <Section title="Audience">
        <Select value={audience} options={audiences} onChange={setAudience} title="Audience" />
        {audience === 'ROLES' && (
          <Row gap={6} wrap>
            {roleChoices.map(r => (
              <TouchableOpacity key={r} onPress={() => setRoles(rs => rs.includes(r) ? rs.filter(x => x !== r) : [...rs, r])}>
                <Tag text={humanize(r === 'FARMER' ? 'CUSTOMER' : r)} color={roles.includes(r) ? 'green' : 'default'} />
              </TouchableOpacity>
            ))}
          </Row>
        )}
        {audience === 'USERS' && (
          <>
            <Select value={null as any} options={(people.data ?? []).filter(p => !userIds.includes(p.value))} title="Add user"
                    placeholder={people.loading ? 'Loading…' : 'Add a user'} onChange={v => setUserIds(ids => [...ids, v])} />
            <Row gap={6} wrap>
              {userIds.map(id => (
                <TouchableOpacity key={id} onPress={() => setUserIds(ids => ids.filter(x => x !== id))}>
                  <Tag text={`${people.data?.find(p => p.value === id)?.label ?? id}  ✕`} color="green" />
                </TouchableOpacity>
              ))}
            </Row>
          </>
        )}
        {!isSuper && <Text style={TYPE.caption}>Administrator groups can only be messaged by a Super Admin.</Text>}
      </Section>

      <Section title="Schedule & delivery">
        <Field label="Start (optional)" help="Leave empty to send now"><DateTimeField value={startsAt} onChange={setStartsAt} /></Field>
        <Field label="Expires (optional)" help="After this the banner stops showing; it stays in history"><DateTimeField value={expiresAt} onChange={setExpiresAt} /></Field>
        <Field label="Action link (optional)" help="e.g. consultation/<id> or quotation/<id>">
          <Input value={actionLink} onChangeText={setActionLink} autoCapitalize="none" />
        </Field>
        <SwitchRow label="In-app notification" description="Always on" value onChange={() => {}} disabled />
        <SwitchRow label="Push notification" description="Sent via Expo push to users with the app installed and push enabled. Delivery status appears in Delivery stats." value={push} onChange={setPush} />
      </Section>

      <Section title="Preview">
        <View style={styles.preview}>
          <Bell size={18} color={priority === 'HIGH' || type === 'IMPORTANT' || type === 'MAINTENANCE' ? TOKENS.colorWarning : TOKENS.colorPrimary} />
          <View style={{ flex: 1 }}>
            <Text style={TYPE.h3} numberOfLines={1}>{title || 'Title'}</Text>
            <Text style={TYPE.secondary} numberOfLines={2}>{message || 'Your message'}</Text>
          </View>
        </View>
        <Text style={TYPE.caption}>To: {audienceLabel}{startsAt ? ` · from ${formatDate(startsAt)}` : ''}{expiresAt ? ` · until ${formatDate(expiresAt)}` : ''}</Text>
      </Section>

      {!!errors.length && !!title && <Alert type="warning" message={errors.join(' · ')} />}
      <Button title={startsAt ? 'Schedule announcement' : 'Send announcement'} type="primary" icon={Send} block
              disabled={!!errors.length} onPress={() => setConfirm(true)} />
      <ConfirmDialog visible={confirm} title="Send this announcement?" message={`To: ${audienceLabel}`} confirmText="Send" loading={sending}
                     onCancel={() => setConfirm(false)} onConfirm={() => { setConfirm(false); send(); }} />
    </Page>
  );
};

const styles = StyleSheet.create({
  preview: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: TOKENS.radius, borderWidth: 1,
             borderColor: TOKENS.colorPrimaryBorder, borderLeftWidth: 4, borderLeftColor: TOKENS.colorPrimary, backgroundColor: '#FFF' },
});
