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
  Platform,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { UserRole } from '../../../types/product';
import { ApiProduct, productService } from '../services/productService';
import { ProductCard } from '../components/ProductCard';
import { addToCart } from '../../../store/cartSlice';
import { RootState } from '../../../store';

export const ProductListScreen = ({ navigation, route }: any) => {
  const role: UserRole = route.params?.role || 'customer';
  const [products,    setProducts]    = useState<ApiProduct[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [nextCursor,  setNextCursor]  = useState<string | undefined>();
  const [loadingMore, setLoadingMore] = useState(false);
  const dispatch = useDispatch();
  const cartCount = useSelector((state: RootState) =>
    state.cart.items.reduce((sum, item) => sum + item.quantity, 0)
  );

  const fetchProducts = useCallback(async (cursor?: string) => {
    if (cursor) { setLoadingMore(true); }
    try {
      const res = await productService.getProducts(cursor);
      setProducts(prev => cursor ? [...prev, ...res.items] : res.items);
      setNextCursor(res.nextCursor);
    } catch {
      Alert.alert('Error', 'Failed to fetch products');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setProducts([]);
      setNextCursor(undefined);
      setLoading(true);
      fetchProducts();
    });
    return unsubscribe;
  }, [navigation, fetchProducts]);

  const onRefresh = () => {
    setRefreshing(true);
    setProducts([]);
    setNextCursor(undefined);
    fetchProducts();
  };

  const handleAddToCart = (product: ApiProduct) => {
    dispatch(addToCart({ productId: product.productId, name: product.name, price: product.price }));
    Alert.alert('Success', `${product.name} added to cart!`);
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2e7d32" />
        <Text style={styles.loadingText}>Loading products...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={products}
        keyExtractor={(item) => item.productId}
        renderItem={({ item }) => (
          <ProductCard
            product={item}
            role={role}
            onViewDetails={(p) => navigation.navigate('ProductDetails', { productId: p.productId })}
            onAddToCart={handleAddToCart}
            onEdit={(p) => navigation.navigate('EditStock', { product: p })}
          />
        )}
        ListHeaderComponent={
          <View style={styles.headerContainer}>
            <Text style={styles.headerText}>Please select the required fertilizer and medicine.</Text>
            <Text style={styles.headerTextTamil}>தேவையான உரமும் மருந்தையும் தேர்வு செய்யவும்.</Text>
          </View>
        }
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={10}
        removeClippedSubviews={Platform.OS === 'android'}
        onEndReached={() => nextCursor && !loadingMore && fetchProducts(nextCursor)}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2e7d32']} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No products found.</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />

      <TouchableOpacity
        style={[styles.fab, { bottom: 20, backgroundColor: '#1565c0' }]}
        onPress={() => navigation.navigate('Cart')}
      >
        <Text style={styles.fabText}>Cart</Text>
        {cartCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{cartCount > 99 ? '99+' : cartCount}</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#f5f5f5' },
  centered:        { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText:     { marginTop: 12, color: '#666' },
  listContent:     { paddingBottom: 100 },
  headerContainer: { padding: 16, backgroundColor: '#fff', marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#eee' },
  headerText:      { fontSize: 16, color: '#333', marginBottom: 4 },
  headerTextTamil: { fontSize: 15, color: '#666' },
  emptyContainer:  { padding: 32, alignItems: 'center' },
  emptyText:       { fontSize: 16, color: '#999' },
  fab: {
    position: 'absolute',
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabText:  { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#e53935',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
});
