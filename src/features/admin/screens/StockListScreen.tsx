import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, BORDER_RADIUS } from '../../../theme';
import { Edit2, Plus } from 'lucide-react-native';
import { api } from '../../../services/api';
import { LoadingState, EmptyState, ErrorState } from '../../../components/States';
import { ProductImage } from '../../../components/ProductImage';

interface ApiProduct {
  productId: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  unit: string;
  description: string;
  imageUrl?: string;
  isActive: boolean;
}

export const StockListScreen = ({ navigation }: any) => {
  const [products,    setProducts]    = useState<ApiProduct[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [nextCursor,  setNextCursor]  = useState<string | undefined>();
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchProducts = useCallback(async (cursor?: string) => {
    if (cursor) setLoadingMore(true); else setLoading(true);
    try {
      const path = cursor ? `/products?cursor=${cursor}` : '/products';
      const res  = await api.get<{ items: ApiProduct[]; nextCursor?: string }>(path);
      setProducts(prev => cursor ? [...prev, ...res.items] : res.items);
      setNextCursor(res.nextCursor);
      setError(null);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load products');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const renderItem = useCallback(({ item }: { item: ApiProduct }) => (
    <View style={styles.card}>
      <View style={styles.cardBody}>
        <ProductImage uri={item.imageUrl} size={60} />
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <Text style={styles.productName}>{item.name}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('EditStock', { product: item })}>
              <Edit2 size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.category}>{item.category}</Text>
          <View style={styles.row}>
            <Text style={styles.price}>₹{item.price}/{item.unit}</Text>
            <View style={[styles.stockBadge, { backgroundColor: item.stock < 10 ? '#FFEBEE' : '#E8F5E9' }]}>
              <Text style={[styles.stockText, { color: item.stock < 10 ? '#C62828' : '#2E7D32' }]}>
                Stock: {item.stock}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  ), [navigation]);

  if (loading) return <LoadingState />;
  if (error)   return <ErrorState error={error} />;

  return (
    <SafeAreaView style={styles.safe}>
      <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('AddStock')}>
        <Plus size={20} color="#fff" />
        <Text style={styles.addBtnText}>Add Product</Text>
      </TouchableOpacity>
      <FlatList
        data={products}
        keyExtractor={i => i.productId}
        contentContainerStyle={styles.list}
        renderItem={renderItem}
        onEndReached={() => nextCursor && !loadingMore && fetchProducts(nextCursor)}
        onEndReachedThreshold={0.4}
        removeClippedSubviews={Platform.OS === 'android'}
        ListEmptyComponent={<EmptyState message="No products found" />}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: COLORS.background },
  addBtn:      { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, margin: SPACING.md, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, justifyContent: 'center', gap: 8 },
  addBtnText:  { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  list:        { paddingHorizontal: SPACING.md, paddingBottom: SPACING.md },
  card:        { backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2 },
  cardBody:    { flexDirection: 'row', gap: SPACING.md },
  cardContent: { flex: 1 },
  cardHeader:  { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.xs, gap: 8 },
  productName: { flex: 1, fontSize: 16, fontWeight: 'bold', color: COLORS.text },
  category:    { fontSize: 13, color: COLORS.textSecondary, marginBottom: SPACING.sm },
  row:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  price:       { fontSize: 16, fontWeight: 'bold', color: COLORS.primary },
  stockBadge:  { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  stockText:   { fontSize: 13, fontWeight: '600' },
});
