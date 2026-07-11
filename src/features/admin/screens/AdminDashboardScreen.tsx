import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { useSelector } from 'react-redux';
import { ShoppingBag, Users, Package, MessageSquare, TrendingUp, CloudRain, Thermometer, Bell, BookOpen, UserPlus } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS } from '../../../theme';
import { api } from '../../../services/api';
import { RootState } from '../../../store';

export const AdminDashboardScreen = ({ navigation }: any) => {
  const [stats, setStats] = useState({ totalOrders: 0, pendingOrders: 0, totalCustomers: 0, totalProducts: 0 });
  const role = useSelector((state: RootState) => state.auth.user?.role);

  useEffect(() => {
    Promise.all([
      api.get<{ items: any[] }>('/orders').catch(() => ({ items: [] })),
      api.get<{ items: any[] }>('/farmers').catch(() => ({ items: [] })),
      api.get<{ items: any[] }>('/products').catch(() => ({ items: [] })),
    ]).then(([orders, customers, products]) => {
      const pending = orders.items.filter(o => o.status === 'PENDING').length;
      setStats({
        totalOrders:    orders.items.length,
        pendingOrders:  pending,
        totalCustomers: customers.items.length,
        totalProducts:  products.items.length,
      });
    });
  }, []);

  const adminActions = [
    { title: 'New Orders',    icon: ShoppingBag, screen: 'OrdersTab',        color: '#e67e22', badge: stats.pendingOrders > 0 ? String(stats.pendingOrders) : undefined },
    { title: 'Manage Stock',  icon: Package,     screen: 'ManageStock',       color: '#27ae60' },
    { title: 'Customer List', icon: Users,       screen: 'CustomersTab',      color: '#2980b9' },
    { title: 'Enquiries',     icon: MessageSquare, screen: 'EnquiriesTab',    color: '#8e44ad' },
    { title: 'Rain Update',   icon: CloudRain,   screen: 'UpdateRain',        color: '#3498db' },
    { title: 'Symptoms',      icon: Thermometer, screen: 'SymptomsList',      color: '#e74c3c' },
    { title: 'Sales Report',  icon: TrendingUp,  screen: 'Admin',             color: '#c0392b' },
    { title: 'Notifications', icon: Bell,        screen: 'NotificationList',  color: '#7f8c8d' },
    { title: 'Expert Advice', icon: BookOpen,    screen: 'ExpertAdviceList',  color: '#16a085', badge: 'New' },
    ...(role === 'SUPER_ADMIN'
      ? [{ title: 'Add Admin', icon: UserPlus, screen: 'AddAdmin', color: '#34495e' }]
      : []),
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8F9FA' }}>
      <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.greeting}>Admin Control</Text>
          <Text style={styles.subtitle}>Manage your agricultural business</Text>
        </View>

        <View style={styles.grid}>
          {adminActions.map((action, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.card, { borderTopColor: action.color }]}
              onPress={() => navigation.navigate(action.screen)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, { backgroundColor: action.color + '15' }]}>
                <action.icon size={28} color={action.color} />
              </View>
              <Text style={styles.cardTitle}>{action.title}</Text>
              {action.badge ? (
                <View style={[styles.badge, { backgroundColor: action.color }]}>
                  <Text style={styles.badgeText}>{action.badge}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <View style={styles.statBox}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.pendingOrders}</Text>
              <Text style={styles.statLabel}>Pending Orders</Text>
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
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  header:       { marginBottom: SPACING.xl, marginTop: SPACING.md },
  greeting:     { fontSize: 28, fontWeight: 'bold', color: '#1A1A1A' },
  subtitle:     { fontSize: 16, color: '#666', marginTop: 4 },
  grid:         { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  card:         { width: '47%', backgroundColor: '#FFF', borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.lg, borderTopWidth: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 4, position: 'relative', overflow: 'hidden' },
  iconContainer:{ width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.md },
  cardTitle:    { fontSize: 16, fontWeight: '700', color: '#333' },
  badge:        { position: 'absolute', top: 10, right: 10, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeText:    { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  statsSection: { marginTop: SPACING.md },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1A1A1A', marginBottom: SPACING.md },
  statBox:      { backgroundColor: '#FFF', borderRadius: BORDER_RADIUS.lg, padding: SPACING.xl, flexDirection: 'row', alignItems: 'center', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5 },
  statItem:     { flex: 1, alignItems: 'center' },
  statValue:    { fontSize: 24, fontWeight: 'bold', color: COLORS.primary },
  statLabel:    { fontSize: 13, color: '#666', marginTop: 4, textAlign: 'center' },
  divider:      { width: 1, height: '100%', backgroundColor: '#EEE', marginHorizontal: SPACING.xs },
});
