import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING } from '../../theme';
import { api } from '../../services/api';
import { Card } from '../../components/Card';
import { LoadingState, EmptyState, ErrorState } from '../../components/States';

interface ApiOrder {
  orderId: string;
  items: { productName: string; quantity: number; subtotal: string }[];
  totalAmount: string;
  status: string;
  createdAt: string;
}

export const PurchaseHistory = () => {
  const [orders,    setOrders]   = useState<ApiOrder[]>([]);
  const [loading,   setLoading]  = useState(true);
  const [error,     setError]    = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState('');
  const [nameFilter, setNameFilter] = useState('');

  useEffect(() => {
    api.get<{ items: ApiOrder[] }>('/orders')
      .then(res => setOrders(res.items))
      .catch(err => setError(err?.message ?? 'Failed to load orders'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return orders.filter(o => {
      const matchDate = !dateFilter || o.createdAt.includes(dateFilter);
      const matchName = !nameFilter || o.items.some(i =>
        i.productName.toLowerCase().includes(nameFilter.toLowerCase())
      );
      return matchDate && matchName;
    });
  }, [orders, dateFilter, nameFilter]);

  if (loading) return <LoadingState />;
  if (error)   return <ErrorState error={error} />;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          ListHeaderComponent={
            <View style={styles.filterContainer}>
              <View style={styles.filterGroup}>
                <Text style={styles.filterLabel}>Date</Text>
                <TextInput style={styles.filterInput} placeholder="Filter by date (YYYY-MM-DD)" value={dateFilter} onChangeText={setDateFilter} />
              </View>
              <View style={styles.filterGroup}>
                <Text style={styles.filterLabel}>Product Name</Text>
                <TextInput style={styles.filterInput} placeholder="Filter by product name" value={nameFilter} onChangeText={setNameFilter} />
              </View>
            </View>
          }
          data={filtered}
          keyExtractor={(item) => item.orderId}
          contentContainerStyle={styles.container}
          renderItem={({ item }) => (
            <Card>
              <View style={styles.row}>
                <Text style={styles.productName}>
                  {item.items.length === 1
                    ? item.items[0].productName
                    : `${item.items[0].productName} +${item.items.length - 1} more`}
                </Text>
                <Text style={styles.price}>₹{Number(item.totalAmount).toFixed(2)}</Text>
              </View>
              <Text style={styles.date}>{item.createdAt.split('T')[0]}</Text>
              <Text style={styles.detail}>
                {item.items.map(i => `${i.quantity}× ${i.productName}`).join(', ')}
              </Text>
              <View style={[styles.status, { backgroundColor: item.status === 'DELIVERED' ? COLORS.success + '20' : COLORS.secondary + '20' }]}>
                <Text style={[styles.statusText, { color: item.status === 'DELIVERED' ? COLORS.success : COLORS.secondary }]}>
                  {item.status}
                </Text>
              </View>
            </Card>
          )}
          ListEmptyComponent={<EmptyState message="No purchase history found" />}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: COLORS.background },
  filterContainer:{ paddingBottom: SPACING.md },
  filterGroup:   { marginBottom: SPACING.sm },
  filterLabel:   { fontSize: 14, color: COLORS.text, marginBottom: 4, fontWeight: '500' },
  filterInput:   { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, backgroundColor: '#fff' },
  container:     { padding: SPACING.md },
  row:           { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.xs },
  productName:   { fontSize: 16, fontWeight: 'bold', color: COLORS.text, flex: 1 },
  price:         { fontSize: 16, fontWeight: 'bold', color: COLORS.primary },
  date:          { fontSize: 12, color: COLORS.textSecondary, marginBottom: SPACING.xs },
  detail:        { fontSize: 14, color: COLORS.text },
  status:        { alignSelf: 'flex-start', paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: 4, marginTop: SPACING.sm },
  statusText:    { fontSize: 12, fontWeight: 'bold' },
});
