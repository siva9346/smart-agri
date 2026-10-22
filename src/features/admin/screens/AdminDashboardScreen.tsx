import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NotificationBanner } from '../../notifications/NotificationBanner';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { ShoppingBag, Users, Package, MessageSquare, TrendingUp, CloudRain, Thermometer, Bell, BookOpen, UserPlus, AlertTriangle } from 'lucide-react-native';
import { GradientHero } from '../../../components/GradientHero';
import { COLORS, SPACING, BORDER_RADIUS } from '../../../theme';
import { api } from '../../../services/api';
import { RootState } from '../../../store';

export const AdminDashboardScreen = ({ navigation }: any) => {
  const [stats, setStats] = useState({ totalOrders: 0, pendingOrders: 0, totalCustomers: 0, totalProducts: 0, highAlerts: 0 });
  const user = useSelector((state: RootState) => state.auth.user);
  const role = user?.role;

  useFocusEffect(
    useCallback(() => {
      Promise.all([
        api.get<{ items: any[] }>('/orders').catch(() => ({ items: [] })),
        api.get<{ items: any[] }>('/farmers').catch(() => ({ items: [] })),
        api.get<{ items: any[] }>('/products').catch(() => ({ items: [] })),
        api.get<{ items: any[] }>('/records/alerts').catch(() => ({ items: [] })),
      ]).then(([orders, customers, products, alerts]) => {
        const pending = orders.items.filter(o => o.status === 'PENDING').length;
        setStats({
          totalOrders:    orders.items.length,
          pendingOrders:  pending,
          totalCustomers: customers.items.length,
          totalProducts:  products.items.length,
          highAlerts:     alerts.items.length,
        });
      });
    }, [])
  );

  const adminActions = [
    { title: 'New Orders',    icon: ShoppingBag, screen: 'OrdersTab',        color: '#e67e22', badge: stats.pendingOrders > 0 ? String(stats.pendingOrders) : undefined },
    { title: 'Manage Stock',  icon: Package,     screen: 'ManageStock',       color: '#27ae60' },
    { title: 'Customer List', icon: Users,       screen: 'CustomersTab',      color: '#2980b9' },
    { title: 'Enquiries',     icon: MessageSquare, screen: 'EnquiriesTab',    color: '#8e44ad' },
    { title: 'Alerts',        icon: AlertTriangle, screen: 'AlertsList',      color: '#D32F2F', badge: stats.highAlerts > 0 ? String(stats.highAlerts) : undefined },
    { title: 'Rain Update',   icon: CloudRain,   screen: 'UpdateRain',        color: '#3498db' },
    { title: 'Symptoms',      icon: Thermometer, screen: 'SymptomsList',      color: '#e74c3c' },
    { title: 'Sales Report',  icon: TrendingUp,  screen: 'SalesReport',       color: '#c0392b' },
    { title: 'Notifications', icon: Bell,        screen: 'NotificationList',  color: '#7f8c8d' },
    { title: 'Expert Advice', icon: BookOpen,    screen: 'ExpertAdviceList',  color: '#16a085', badge: 'New' },
    ...(role === 'SUPER_ADMIN'
      ? [{ title: 'Add Admin', icon: UserPlus, screen: 'AddAdmin', color: '#34495e' }]
      : []),
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <GradientHero
          title={`Welcome, ${user?.name ?? 'Admin'}`}
          subtitle="Manage your agricultural business"
          colors={['#2B1B4A', '#3D2566', '#4C3384']}
          bleedToTop={false}
          showMenu={false}
        />
        <NotificationBanner />

        <View style={styles.overviewWrap}>
          <View style={styles.statBox}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.pendingOrders}</Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.totalCustomers}</Text>
              <Text style={styles.statLabel}>Customers</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.totalProducts}</Text>
              <Text style={styles.statLabel}>Products</Text>
            </View>
          </View>
        </View>

        <View style={styles.body}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.grid}>
            {adminActions.map((action, index) => (
              <TouchableOpacity
                key={index}
                activeOpacity={0.85}
                style={styles.cardShadow}
                onPress={() => navigation.navigate(action.screen)}
              >
                <View style={styles.card}>
                  <View style={[styles.iconContainer, { backgroundColor: action.color + '18' }]}>
                    <action.icon size={24} color={action.color} />
                  </View>
                  <Text style={styles.cardTitle}>{action.title}</Text>
                  {action.badge ? (
                    <View style={[styles.badge, { backgroundColor: action.color }]}>
                      <Text style={styles.badgeText}>{action.badge}</Text>
                    </View>
                  ) : null}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  overviewWrap: { paddingHorizontal: SPACING.md, paddingTop: SPACING.md },
  statBox: {
    backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg, flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#3D256620',
  },
  statItem:  { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '700', color: '#3D2566' },
  statLabel: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4, textAlign: 'center' },
  divider:   { width: 1, height: '100%', backgroundColor: COLORS.border, marginHorizontal: SPACING.xs },

  body: { padding: SPACING.md, paddingTop: SPACING.lg },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#3D2566', marginBottom: SPACING.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  cardShadow: { width: '47%', marginBottom: SPACING.md },
  card: {
    backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg,
    borderWidth: 1, borderColor: COLORS.border, position: 'relative',
  },
  iconContainer: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.sm },
  cardTitle: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  badge: { position: 'absolute', top: 10, right: 10, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
});
