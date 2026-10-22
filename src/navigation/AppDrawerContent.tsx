import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import { LogOut } from 'lucide-react-native';
import { RootState, AppDispatch } from '../store';
import { signOut } from '../store/authActions';
import { navigationRef } from './navigationRef';
import { visibleSections, homeRoute } from './navConfig';
import { useAuth } from '../hooks/useApi';
import { COLORS, TOKENS } from '../theme';

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin', ADMIN: 'Admin', STAFF: 'Staff', EXPERT: 'Agricultural Expert', FARMER: 'Farmer',
};

/** Role-aware sectioned sidebar (replaces the flat Farmer/Admin drawer lists). */
export const AppDrawerContent = ({ onClose }: { onClose: () => void }) => {
  const { user, can } = useAuth();
  const unread = useSelector((s: RootState) => s.notification.unreadCount);
  const dispatch = useDispatch<AppDispatch>();
  const sections = useMemo(() => (user ? visibleSections({ role: user.role, can }) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.role, user?.permissions]);

  const go = (screen: string, params?: object) => {
    if (navigationRef.isReady() && user) {
      const target = screen === '__home__' ? homeRoute(user.role) : { screen, params };
      (navigationRef as any).navigate(target.screen, target.params);
    }
    onClose();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{(user?.name ?? '?').charAt(0).toUpperCase()}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>{user?.name}</Text>
          <View style={styles.roleBadge}><Text style={styles.roleText}>{ROLE_LABEL[user?.role ?? ''] ?? user?.role}</Text></View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
        {sections.map(section => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.items.map(item => (
              <TouchableOpacity key={`${section.title}-${item.label}`} onPress={() => go(item.screen, item.params)}
                                activeOpacity={0.6} style={styles.item} accessibilityRole="button">
                <View style={styles.itemIcon}><item.icon size={16} color={COLORS.primary} /></View>
                <Text style={styles.itemLabel} numberOfLines={1}>{item.label}</Text>
                {item.screen === 'Notifications' && unread > 0 && (
                  <View style={styles.badge}><Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text></View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </ScrollView>

      <TouchableOpacity style={styles.logout} onPress={() => dispatch(signOut() as any)} activeOpacity={0.6}>
        <LogOut size={18} color={COLORS.error} />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.surface, paddingHorizontal: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 18,
            borderBottomWidth: 1, borderBottomColor: COLORS.border, marginBottom: 4 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary + '14', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 17, fontWeight: '700', color: COLORS.primary },
  name: { fontSize: 15.5, fontWeight: '700', color: COLORS.text },
  roleBadge: { alignSelf: 'flex-start', marginTop: 3, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: COLORS.primary + '14' },
  roleText: { fontSize: 10.5, fontWeight: '700', color: COLORS.primary, letterSpacing: 0.3 },
  section: { paddingTop: 10 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: TOKENS.colorTextTertiary, letterSpacing: 0.8, textTransform: 'uppercase',
                  paddingHorizontal: 12, paddingBottom: 4 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44, paddingHorizontal: 12, borderRadius: 10 },
  itemIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.primary + '12', alignItems: 'center', justifyContent: 'center' },
  itemLabel: { flex: 1, fontSize: 14.5, fontWeight: '500', color: COLORS.text },
  badge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.error, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, marginBottom: 8,
            borderTopWidth: 1, borderTopColor: COLORS.border },
  logoutText: { fontSize: 14.5, fontWeight: '600', color: COLORS.error },
});
