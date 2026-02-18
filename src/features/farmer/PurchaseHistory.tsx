import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING } from '../../theme';
import { mockRepository } from '../../repositories/MockRepository';
import { PurchaseHistory as IPurchaseHistory } from '../../types/domain';
import { Card } from '../../components/Card';
import { LoadingState, EmptyState } from '../../components/States';

export const PurchaseHistory = () => {
  const [history, setHistory] = useState<IPurchaseHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    mockRepository.getPurchaseHistory('1').then(res => {
      if (res.success) setHistory(res.data);
      setLoading(false);
    });
  }, []);

  if (loading) return <LoadingState />;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.container}
        renderItem={({ item }) => (
          <Card>
            <View style={styles.row}>
              <Text style={styles.productName}>{item.productName}</Text>
              <Text style={styles.price}>₹{item.totalPrice}</Text>
            </View>
            <Text style={styles.date}>{item.date}</Text>
            <Text style={styles.detail}>Qty: {item.quantity}</Text>
            <View style={[styles.status, { backgroundColor: item.status === 'COMPLETED' ? COLORS.success + '20' : COLORS.secondary + '20' }]}>
              <Text style={[styles.statusText, { color: item.status === 'COMPLETED' ? COLORS.success : COLORS.secondary }]}>
                {item.status}
              </Text>
            </View>
          </Card>
        )}
        ListEmptyComponent={<EmptyState message="No purchase history found" />}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    padding: SPACING.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  productName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  price: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  date: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  detail: {
    fontSize: 14,
    color: COLORS.text,
  },
  status: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: SPACING.sm,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
});
