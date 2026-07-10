import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, Alert, TouchableOpacity, Platform } from 'react-native';
import { useDispatch } from 'react-redux';
import { COLORS, SPACING, BORDER_RADIUS } from '../../theme';
import { api } from '../../services/api';
import { addToCart } from '../../store/cartSlice';
import { Card } from '../../components/Card';
import { LoadingState, EmptyState, ErrorState } from '../../components/States';

interface ApiProduct {
  productId: string;
  name: string;
  category: string;
  price: number;
  unit: string;
  stock: number;
  description: string;
}

export const FertilizerList = ({ navigation }: any) => {
  const [products,    setProducts]    = useState<ApiProduct[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [nextCursor,  setNextCursor]  = useState<string | undefined>();
  const [loadingMore, setLoadingMore] = useState(false);
  const dispatch = useDispatch();

  const fetchProducts = useCallback(async (cursor?: string) => {
    if (cursor) setLoadingMore(true); else setLoading(true);
    try {
      const path = cursor ? `/products?cursor=${cursor}` : '/products';
      const res  = await api.get<{ items: ApiProduct[]; nextCursor?: string }>(path);
      setProducts(prev => cursor ? [...prev, ...res.items] : res.items);
      setNextCursor(res.nextCursor);
      setError(null);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to fetch products');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const handleAddToCart = (product: ApiProduct) => {
    if (product.stock <= 0) {
      Alert.alert('Out of Stock', 'This product is currently unavailable.');
      return;
    }
    dispatch(addToCart({ productId: product.productId, name: product.name, price: product.price }));
    Alert.alert('Added to Cart', `${product.name} added to cart.`, [
      { text: 'Continue' },
      { text: 'Go to Cart', onPress: () => navigation?.navigate('Cart') },
    ]);
  };

  if (loading) return <LoadingState />;
  if (error)   return <ErrorState error={error} />;

  return (
    <FlatList
      data={products}
      keyExtractor={(item) => item.productId}
      contentContainerStyle={styles.container}
      onEndReached={() => nextCursor && !loadingMore && fetchProducts(nextCursor)}
      onEndReachedThreshold={0.4}
      removeClippedSubviews={Platform.OS === 'android'}
      renderItem={({ item }) => (
        <Card>
          <View style={styles.cardHeader}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.price}>₹{item.price.toFixed(2)}{item.unit ? `/${item.unit}` : ''}</Text>
          </View>
          <Text style={styles.description}>{item.description}</Text>
          <View style={styles.cardFooter}>
            <Text style={[styles.stock, item.stock <= 0 && styles.outOfStock]}>
              {item.stock <= 0 ? 'Out of Stock' : `Stock: ${item.stock}`}
            </Text>
            <TouchableOpacity
              style={[styles.buyButton, item.stock <= 0 && styles.buyButtonDisabled]}
              onPress={() => handleAddToCart(item)}
              disabled={item.stock <= 0}
            >
              <Text style={styles.buyButtonText}>Add to Cart</Text>
            </TouchableOpacity>
          </View>
        </Card>
      )}
      ListEmptyComponent={<EmptyState message="No products available" />}
    />
  );
};

const styles = StyleSheet.create({
  container:          { padding: SPACING.md, backgroundColor: COLORS.background },
  cardHeader:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  name:               { fontSize: 17, fontWeight: 'bold', color: COLORS.text, flex: 1 },
  price:              { fontSize: 17, fontWeight: 'bold', color: COLORS.primary },
  description:        { fontSize: 14, color: COLORS.textSecondary, marginBottom: SPACING.md },
  cardFooter:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: SPACING.sm },
  stock:              { fontSize: 12, color: COLORS.textSecondary },
  outOfStock:         { color: '#e74c3c' },
  buyButton:          { backgroundColor: COLORS.primary, paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, borderRadius: BORDER_RADIUS.sm },
  buyButtonDisabled:  { backgroundColor: '#ccc' },
  buyButtonText:      { color: 'white', fontWeight: 'bold' },
});
