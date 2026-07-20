import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, BORDER_RADIUS } from '../../../theme';
import { MapPin, User, Calendar } from 'lucide-react-native';
import { api } from '../../../services/api';
import { LoadingState, ErrorState } from '../../../components/States';
import { ProductImage } from '../../../components/ProductImage';

interface ApiOrder {
  orderId: string;
  customerId: string;
  items: { productId: string; productName: string; quantity: number; unitPrice: string; subtotal: string; imageUrl?: string }[];
  totalAmount: string;
  status: string;
  address: string;
  createdAt: string;
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: '#e67e22', CONFIRMED: '#2980b9', SHIPPED: '#8e44ad',
  DELIVERED: '#27ae60', CANCELLED: '#e74c3c',
};
const NEXT_STATUSES: Record<string, string[]> = {
  PENDING:   ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['SHIPPED', 'CANCELLED'],
  SHIPPED:   ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

export const OrderDetailsScreen = ({ route }: any) => {
  const { orderId, onUpdate } = route.params;
  const [order,   setOrder]   = useState<ApiOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    api.get<ApiOrder>(`/orders/${orderId}`)
      .then(setOrder)
      .catch(err => setError(err?.message ?? 'Failed to load order'))
      .finally(() => setLoading(false));
  }, [orderId]);

  const updateStatus = async (status: string) => {
    if (!order) return;
    setSaving(true);
    try {
      const updated = await api.put<ApiOrder>(`/orders/${orderId}`, { status });
      setOrder(updated);
      onUpdate?.();
      Alert.alert('Updated', `Order status set to ${status}`);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to update status');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState />;
  if (error || !order) return <ErrorState error={error ?? 'Not found'} />;

  const nextStatuses = NEXT_STATUSES[order.status] ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerCard}>
          <View>
            <Text style={styles.orderIdLabel}>ORDER NUMBER</Text>
            <Text style={styles.orderIdValue}>#{order.orderId.slice(-8).toUpperCase()}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLOR[order.status] ?? '#666') + '20' }]}>
            <Text style={[styles.statusText, { color: STATUS_COLOR[order.status] ?? '#666' }]}>{order.status}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Info</Text>
          <View style={styles.infoRow}>
            <User size={16} color={COLORS.textSecondary} />
            <Text style={styles.infoText}>Customer ID: {order.customerId.slice(-8).toUpperCase()}</Text>
          </View>
          <View style={styles.infoRow}>
            <MapPin size={16} color={COLORS.textSecondary} />
            <Text style={styles.infoText}>{order.address}</Text>
          </View>
          <View style={styles.infoRow}>
            <Calendar size={16} color={COLORS.textSecondary} />
            <Text style={styles.infoText}>{order.createdAt.split('T')[0]}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Items</Text>
          {order.items.map((item, i) => (
            <View key={i} style={styles.itemRow}>
              <ProductImage uri={item.imageUrl} size={44} />
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.productName}</Text>
                <Text style={styles.itemQty}>Qty: {item.quantity} × ₹{Number(item.unitPrice).toFixed(2)}</Text>
              </View>
              <Text style={styles.itemSubtotal}>₹{Number(item.subtotal).toFixed(2)}</Text>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>₹{Number(order.totalAmount).toFixed(2)}</Text>
          </View>
        </View>

        {nextStatuses.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Update Status</Text>
            <View style={styles.statusRow}>
              {nextStatuses.map(s => (
                <TouchableOpacity
                  key={s}
                  style={[styles.statusBtn, { borderColor: STATUS_COLOR[s] ?? COLORS.border }, saving && { opacity: 0.6 }]}
                  onPress={() => updateStatus(s)}
                  disabled={saving}
                >
                  <Text style={[styles.statusBtnText, { color: STATUS_COLOR[s] ?? COLORS.text }]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: COLORS.background },
  container:     { padding: SPACING.lg },
  headerCard:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.md, padding: SPACING.lg, marginBottom: SPACING.md, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2 },
  orderIdLabel:  { fontSize: 10, fontWeight: 'bold', color: COLORS.textSecondary, letterSpacing: 1, marginBottom: 4 },
  orderIdValue:  { fontSize: 20, fontWeight: 'bold', color: COLORS.text, fontFamily: 'monospace' },
  statusBadge:   { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText:    { fontSize: 13, fontWeight: 'bold' },
  section:       { backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2 },
  sectionTitle:  { fontSize: 13, fontWeight: 'bold', color: COLORS.textSecondary, textTransform: 'uppercase', marginBottom: SPACING.sm },
  infoRow:       { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  infoText:      { flex: 1, fontSize: 14, color: COLORS.text },
  itemRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm, gap: 10 },
  itemInfo:      { flex: 1 },
  itemName:      { fontSize: 14, fontWeight: '500', color: COLORS.text },
  itemQty:       { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  itemSubtotal:  { fontSize: 15, fontWeight: 'bold', color: COLORS.text },
  divider:       { height: 1, backgroundColor: COLORS.border, marginVertical: SPACING.sm },
  totalRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel:    { fontSize: 16, fontWeight: 'bold', color: COLORS.text },
  totalValue:    { fontSize: 18, fontWeight: 'bold', color: COLORS.primary },
  statusRow:     { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  statusBtn:     { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, backgroundColor: COLORS.surface },
  statusBtnText: { fontSize: 13, fontWeight: 'bold' },
});
