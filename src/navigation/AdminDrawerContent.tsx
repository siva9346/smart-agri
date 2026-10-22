import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import {
  Home, Package, Users, MessageSquare, AlertTriangle, Bell,
  TrendingUp, CloudRain, Thermometer, BookOpen, UserPlus, User, LogOut,
} from 'lucide-react-native';
import { RootState, AppDispatch } from '../store';
import { logout } from '../store/authSlice';
import { navigationRef } from './navigationRef';
import { COLORS } from '../theme';

const ADMIN_ACCENT = '#3D2566';

const NAV_ITEMS = [
  { label: 'Dashboard',       icon: Home,         screen: 'AdminTabs', params: { screen: 'Dashboard' } },
  { label: 'Manage Stock',    icon: Package,      screen: 'ManageStock' },
  { label: 'Register Farmer', icon: Users,        screen: 'CreateCustomer' },
  { label: 'Alerts',          icon: AlertTriangle, screen: 'AlertsList' },
  { label: 'Symptom Records', icon: Thermometer,  screen: 'SymptomsList' },
  { label: 'Notifications',   icon: Bell,         screen: 'NotificationList' },
  { label: 'Sales Report',    icon: TrendingUp,   screen: 'SalesReport' },
  { label: 'Expert Advice',   icon: BookOpen,     screen: 'ExpertAdviceList' },
  { label: 'Update Weather',  icon: CloudRain,    screen: 'UpdateRain' },
  { label: 'My Profile',      icon: User,         screen: 'Profile' },
];

export const AdminDrawerContent = ({ onClose }: { onClose: () => void }) => {
  const user = useSelector((s: RootState) => s.auth.user);
  const dispatch = useDispatch<AppDispatch>();
  const items = user?.role === 'SUPER_ADMIN'
    ? [...NAV_ITEMS.slice(0, 3), { label: 'Add Admin', icon: UserPlus, screen: 'AddAdmin' }, ...NAV_ITEMS.slice(3)]
    : NAV_ITEMS;

  const go = (screen: string, params?: object) => {
    if (navigationRef.isReady()) (navigationRef as any).navigate(screen, params);
    onClose();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(user?.name ?? 'A').charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.headerText}>
          <Text style={styles.name} numberOfLines={1}>{user?.name ?? 'Admin'}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{user?.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'}</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.items} showsVerticalScrollIndicator={false}>
        {items.map(item => (
          <TouchableOpacity
            key={item.label}
            onPress={() => go(item.screen, (item as any).params)}
            activeOpacity={0.6}
            style={styles.item}
          >
            <View style={styles.itemIconWrap}>
              <item.icon size={17} color={ADMIN_ACCENT} />
            </View>
            <Text style={styles.itemLabel}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TouchableOpacity style={styles.logoutBtn} onPress={() => dispatch(logout())} activeOpacity={0.6}>
        <LogOut size={18} color={COLORS.error} />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.surface, paddingHorizontal: 8 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 12, paddingVertical: 20,
    borderBottomWidth: 1, borderBottomColor: COLORS.border, marginBottom: 8,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: ADMIN_ACCENT + '14',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 17, fontWeight: '700', color: ADMIN_ACCENT },
  headerText: { flex: 1 },
  name:  { fontSize: 15.5, fontWeight: '700', color: COLORS.text },
  roleBadge: {
    alignSelf: 'flex-start', marginTop: 3, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8,
    backgroundColor: ADMIN_ACCENT + '14',
  },
  roleText: { fontSize: 10.5, fontWeight: '700', color: ADMIN_ACCENT, letterSpacing: 0.3 },
  items: { paddingBottom: 12 },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10,
  },
  itemIconWrap: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: ADMIN_ACCENT + '12',
    alignItems: 'center', justifyContent: 'center',
  },
  itemLabel: { fontSize: 14.5, fontWeight: '500', color: COLORS.text },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, marginBottom: 8, marginHorizontal: 4,
    borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  logoutText: { fontSize: 14.5, fontWeight: '600', color: COLORS.error },
});
