import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { ApiOrder, productService } from '../services/productService';

const STATUS_COLOR: Record<string, string> = {
  PENDING: '#e67e22', CONFIRMED: '#2980b9', SHIPPED: '#8e44ad',
  DELIVERED: '#27ae60', CANCELLED: '#e74c3c',
};

export const OrderListScreen = () => {
  const [orders,      setOrders]      = useState<ApiOrder[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [nextCursor,  setNextCursor]  = useState<string | undefined>();
  const [loadingMore, setLoadingMore] = useState(false);
  const [expanded,    setExpanded]    = useState<string | null>(null);

  const fetchOrders = useCallback(async (cursor?: string) => {
    if (cursor) setLoadingMore(true);
    try {
      const res = await productService.getOrders(cursor);
      setOrders(prev => cursor ? [...prev, ...res.items] : res.items);
      setNextCursor(res.nextCursor);
    } catch {
      Alert.alert('Error', 'Failed to fetch orders');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const onRefresh = () => {
    setRefreshing(true);
    setOrders([]);
    setNextCursor(undefined);
    fetchOrders();
  };

  const renderItem = ({ item }: { item: ApiOrder }) => {
    const isExpanded = expanded === item.orderId;
    const color = STATUS_COLOR[item.status] ?? '#666';
    return (
      <View style={styles.card}>
        <TouchableOpacity style={styles.cardHeader} onPress={() => setExpanded(isExpanded ? null : item.orderId)} activeOpacity={0.7}>
          <View style={styles.headerTop}>
            <Text style={styles.orderId}>#{item.orderId.slice(-8).toUpperCase()}</Text>
            <View style={[styles.statusBadge, { backgroundColor: color + '20' }]}>
              <Text style={[styles.statusText, { color }]}>{item.status}</Text>
            </View>
          </View>
          <Text style={styles.address} numberOfLines={isExpanded ? undefined : 1}>{item.address}</Text>
          <View style={styles.headerBottom}>
            <Text style={styles.total}>₹{Number(item.totalAmount).toFixed(2)}</Text>
            <Text style={styles.date}>{item.createdAt.split('T')[0]}</Text>
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.itemsSection}>
            {item.items.map((line, i) => (
              <View key={i} style={styles.productRow}>
                <View style={styles.productInfo}>
                  <Text style={styles.productName}>{line.productName}</Text>
                  <Text style={styles.productQty}>Qty: {line.quantity} × ₹{Number(line.unitPrice).toFixed(2)}</Text>
                </View>
                <Text style={styles.productPrice}>₹{Number(line.subtotal).toFixed(2)}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2e7d32" />
        <Text style={styles.loadingText}>Loading orders...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={orders}
        keyExtractor={(item) => item.orderId}
        renderItem={renderItem}
        onEndReached={() => nextCursor && !loadingMore && fetchOrders(nextCursor)}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2e7d32']} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No orders yet.</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#f5f5f5' },
  centered:     { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText:  { marginTop: 12, color: '#666' },
  listContent:  { padding: 16 },
  card:         { backgroundColor: '#fff', borderRadius: 12, marginBottom: 16, overflow: 'hidden', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
  cardHeader:   { padding: 16 },
  headerTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  orderId:      { fontSize: 13, fontWeight: 'bold', color: '#2e7d32', backgroundColor: '#e8f5e9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  statusBadge:  { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  statusText:   { fontSize: 11, fontWeight: 'bold' },
  address:      { fontSize: 14, color: '#666', marginBottom: 12 },
  headerBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  total:        { fontSize: 18, fontWeight: 'bold', color: '#333' },
  date:         { fontSize: 12, color: '#999' },
  itemsSection: { padding: 16, paddingTop: 0, borderTopWidth: 1, borderTopColor: '#f0f0f0', backgroundColor: '#fafafa' },
  productRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  productInfo:  { flex: 1 },
  productName:  { fontSize: 14, color: '#333', fontWeight: '500' },
  productQty:   { fontSize: 12, color: '#666' },
  productPrice: { fontSize: 14, fontWeight: '600', color: '#333' },
  emptyContainer:{ padding: 60, alignItems: 'center' },
  emptyText:    { fontSize: 16, color: '#999', textAlign: 'center' },
});
