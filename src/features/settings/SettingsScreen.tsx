import React from 'react';
import { Text, View } from 'react-native';
import {
  User, SlidersHorizontal, Lock, Bell, Megaphone, Sparkles, Users, ShieldCheck, Stethoscope, GitBranch, FileText,
  ScrollText, LogOut,
} from 'lucide-react-native';
import { useDispatch } from 'react-redux';
import { logout } from '../../store/authSlice';
import { useAuth } from '../../hooks/useApi';
import { Page, Section, ListRow, Avatar, Row, Tag, humanize } from '../../ui';
import { TOKENS, TYPE } from '../../theme';

const Icon = ({ icon: I, color = TOKENS.colorPrimary }: { icon: any; color?: string }) => (
  <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: color + '14', alignItems: 'center', justifyContent: 'center' }}>
    <I size={17} color={color} />
  </View>
);

/** Settings hub — every section is shown only to roles allowed to use it (the backend enforces the same). */
export const SettingsScreen = ({ navigation }: any) => {
  const { user, can, isSuper } = useAuth();
  const dispatch = useDispatch();
  const go = (screen: string, params?: object) => () => navigation.navigate(screen, params);
  const admin = can('users.manage') || can('settings.assignment') || can('announcements.send') || can('audit.view');

  return (
    <Page>
      <Section>
        <Row gap={12}>
          <Avatar name={user?.name} size={48} />
          <View style={{ flex: 1 }}>
            <Text style={TYPE.h2}>{user?.name}</Text>
            <Text style={TYPE.secondary}>{user?.phone}</Text>
          </View>
          <Tag text={humanize(user?.role)} color="green" />
        </Row>
      </Section>

      <Section title="My account" padded={false}>
        <View style={{ paddingHorizontal: 16 }}>
          <ListRow left={<Icon icon={User} />} title="Personal information" subtitle="Name, email, location" onPress={go('Profile')} />
          <ListRow left={<Icon icon={SlidersHorizontal} />} title="Profile preferences" subtitle="Language, role details, availability" onPress={go('Preferences')} />
          <ListRow left={<Icon icon={Lock} />} title="Security" subtitle="Change password" onPress={go('Profile', { section: 'security' })} />
        </View>
      </Section>

      <Section title="Notifications" padded={false}>
        <View style={{ paddingHorizontal: 16 }}>
          <ListRow left={<Icon icon={SlidersHorizontal} />} title="Notification preferences" onPress={go('Preferences', { focus: 'notifications' })} />
          <ListRow left={<Icon icon={Bell} />} title="Notification center" onPress={go('Notifications')} />
          {can('announcements.send') && <ListRow left={<Icon icon={Megaphone} />} title="Announcements" subtitle="Send and track announcements" onPress={go('Announcements')} />}
        </View>
      </Section>

      {can('ai.configure') && (
        <Section title="AI configuration" padded={false}>
          <View style={{ paddingHorizontal: 16 }}>
            <ListRow left={<Icon icon={Sparkles} color={TOKENS.colorInfo} />} title="AI providers & features"
                     subtitle="Global switch, OpenAI, Gemini, feature toggles, connection tests" onPress={go('AiConfig')} />
          </View>
        </Section>
      )}

      {admin && (
        <Section title="Administration" padded={false}>
          <View style={{ paddingHorizontal: 16 }}>
            {can('users.manage') && <ListRow left={<Icon icon={Users} />} title="User management" subtitle="Staff, experts, admins" onPress={go('UserManagement')} />}
            {can('settings.permissions') && <ListRow left={<Icon icon={ShieldCheck} />} title="Roles & permissions" onPress={go('RolePermissions')} />}
            {can('consultation.assign') && <ListRow left={<Icon icon={Stethoscope} />} title="Expert specializations & workload" onPress={go('ExpertCoverage')} />}
            {(can('settings.assignment') || can('users.manage')) && <ListRow left={<Icon icon={GitBranch} />} title="Assignment rules" onPress={go('AssignmentRules')} />}
            {(can('settings.quotation') || can('users.manage')) && <ListRow left={<Icon icon={FileText} />} title="Quotation settings" subtitle="Tax, discounts, approval, terms" onPress={go('QuotationSettings')} />}
            {can('audit.view') && <ListRow left={<Icon icon={ScrollText} />} title="Audit logs" onPress={go('AuditLog')} />}
          </View>
        </Section>
      )}

      <Section padded={false}>
        <View style={{ paddingHorizontal: 16 }}>
          <ListRow left={<Icon icon={LogOut} color={TOKENS.colorError} />} title={<Text style={[TYPE.h3, { color: TOKENS.colorError }]}>Log out</Text>}
                   onPress={() => dispatch(logout())} chevron={false} />
        </View>
      </Section>
      {isSuper && <Text style={[TYPE.caption, { textAlign: 'center' }]}>Signed in as Super Admin</Text>}
    </Page>
  );
};
