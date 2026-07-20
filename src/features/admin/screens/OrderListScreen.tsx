import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, BORDER_RADIUS } from '../../../theme';
import { api } from '../../../services/api';
import { LoadingState, EmptyState, ErrorState } from '../../../components/States';

interface ApiOrder {
  orderId: string;
  customerId: string;
  items: { productName: string; quantity: number; subtotal: string }[];
  totalAmount: string;
  status: string;
  address: string;
  createdAt: string;
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: '#e67e22', CONFIRMED: '#2980b9', SHIPPED: '#8e44ad',
  DELIVERED: '#27ae60', CANCELLED: '#e74c3c',
};
const FILTERS = ['All', 'PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

export const OrderListScreen = ({ navigation }: any) => {
  const [orders,      setOrders]      = useState<ApiOrder[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [filter,      setFilter]      = useState('All');
  const [nextCursor,  setNextCursor]  = useState<string | undefined>();
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchOrders = useCallback(async (cursor?: string) => {
    if (cursor) setLoadingMore(true); else setLoading(true);
    try {
      const path = cursor ? `/orders?cursor=${cursor}` : '/orders';
      const res  = await api.get<{ items: ApiOrder[]; nextCursor?: string }>(path);
      setOrders(prev => cursor ? [...prev, ...res.items] : res.items);
      setNextCursor(res.nextCursor);
      setError(null);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load orders');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const displayed = filter === 'All' ? orders : orders.filter(o => o.status === filter);

  const renderItem = useCallback(({ item }: { item: ApiOrder }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('OrderDetails', { orderId: item.orderId, onUpdate: fetchOrders })}
    >
      <View style={styles.row}>
        <Text style={styles.orderId}>#{item.orderId.slice(-8).toUpperCase()}</Text>
        <View style={[styles.badge, { backgroundColor: (STATUS_COLOR[item.status] ?? '#666') + '20' }]}>
          <Text style={[styles.badgeText, { color: STATUS_COLOR[item.status] ?? '#666' }]}>{item.status}</Text>
        </View>
      </View>
      <Text style={styles.items} numberOfLines={1}>
        {item.items.map(i => `${i.quantity}× ${i.productName}`).join(', ')}
      </Text>
      <View style={styles.row}>
        <Text style={styles.total}>₹{Number(item.totalAmount).toFixed(2)}</Text>
        <Text style={styles.date}>{item.createdAt.split('T')[0]}</Text>
      </View>
    </TouchableOpacity>
  ), [navigation, fetchOrders]);

  if (loading) return <LoadingState />;
  if (error)   return <ErrorState error={error} />;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.filterScroll}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList
        data={displayed}
        keyExtractor={i => i.orderId}
        contentContainerStyle={styles.list}
        renderItem={renderItem}
        onEndReached={() => nextCursor && !loadingMore && fetchOrders(nextCursor)}
        onEndReachedThreshold={0.4}
        removeClippedSubviews={Platform.OS === 'android'}
        ListEmptyComponent={<EmptyState message="No orders found" />}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: COLORS.background },
  filterScroll:    { flexDirection: 'row', flexWrap: 'wrap', padding: SPACING.sm, gap: 6 },
  filterBtn:       { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  filterBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterText:      { fontSize: 12, color: COLORS.text, fontWeight: '500' },
  filterTextActive:{ color: '#fff' },
  list:            { paddingHorizontal: SPACING.md, paddingBottom: SPACING.md },
  card:            { backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2 },
  row:             { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  orderId:         { fontSize: 15, fontWeight: 'bold', color: COLORS.text, fontFamily: 'monospace' },
  badge:           { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeText:       { fontSize: 11, fontWeight: 'bold' },
  items:           { fontSize: 13, color: COLORS.textSecondary, marginBottom: 8 },
  total:           { fontSize: 16, fontWeight: 'bold', color: COLORS.primary },
  date:            { fontSize: 12, color: COLORS.textSecondary },
});
