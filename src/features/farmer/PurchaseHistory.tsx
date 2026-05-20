import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING } from '../../theme';
import { mockRepository } from '../../repositories/MockRepository';
import { PurchaseHistory as IPurchaseHistory } from '../../types/domain';
import { Card } from '../../components/Card';
import { LoadingState, EmptyState } from '../../components/States';

export const PurchaseHistory = () => {
  const [history, setHistory] = useState<IPurchaseHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('');
  const [priceFilter, setPriceFilter] = useState('');
  const [nameFilter, setNameFilter] = useState('');

  useEffect(() => {
    mockRepository.getPurchaseHistory('1').then(res => {
      if (res.success) setHistory(res.data);
      setLoading(false);
    });
  }, []);

  const filteredHistory = useMemo(() => {
    return history.filter(item => {
      const matchDate = dateFilter === '' || item.date.includes(dateFilter);
      const matchPrice = priceFilter === '' || String(item.totalPrice).includes(priceFilter);
      const matchName = nameFilter === '' || item.productName.toLowerCase().includes(nameFilter.toLowerCase());
      return matchDate && matchPrice && matchName;
    });
  }, [history, dateFilter, priceFilter, nameFilter]);

  if (loading) return <LoadingState />;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          ListHeaderComponent={
            <View style={styles.filterContainer}>
              <View style={styles.filterGroup}>
                <Text style={styles.filterLabel}>Date</Text>
                <TextInput
                  style={styles.filterInput}
                  placeholder="Filter by date"
                  value={dateFilter}
                  onChangeText={setDateFilter}
                />
              </View>
              <View style={styles.filterGroup}>
                <Text style={styles.filterLabel}>Price</Text>
                <TextInput
                  style={styles.filterInput}
                  placeholder="Filter by price"
                  keyboardType="numeric"
                  value={priceFilter}
                  onChangeText={setPriceFilter}
                />
              </View>
              <View style={styles.filterGroup}>
                <Text style={styles.filterLabel}>Product Name</Text>
                <TextInput
                  style={styles.filterInput}
                  placeholder="Filter by product name"
                  value={nameFilter}
                  onChangeText={setNameFilter}
                />
              </View>
            </View>
          }
          data={filteredHistory}
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  filterContainer: {
    paddingBottom: SPACING.md,
  },
  filterGroup: {
    marginBottom: SPACING.sm,
  },
  filterLabel: {
    fontSize: 14,
    color: COLORS.text,
    marginBottom: 4,
    fontWeight: '500',
  },
  filterInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#fff',
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
