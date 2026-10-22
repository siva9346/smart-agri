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
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShoppingCart } from 'lucide-react-native';
import { useDispatch, useSelector } from 'react-redux';
import { UserRole } from '../../../types/product';
import { ApiProduct, productService } from '../services/productService';
import { ProductCard } from '../components/ProductCard';
import { addToCart } from '../../../store/cartSlice';
import { RootState } from '../../../store';
import { GradientHero } from '../../../components/GradientHero';
import { COLORS, SPACING } from '../../../theme';

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
    dispatch(addToCart({ productId: product.productId, name: product.name, price: product.price, imageUrl: product.imageUrl }));
    Alert.alert('Success', `${product.name} added to cart!`);
  };

  const CartButton = role === 'customer' ? (
    <TouchableOpacity onPress={() => navigation.navigate('Cart')} style={styles.cartBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <ShoppingCart size={20} color="#FFFFFF" />
      {cartCount > 0 && (
        <View style={styles.cartBadge}>
          <Text style={styles.cartBadgeText}>{cartCount > 99 ? '99+' : cartCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  ) : undefined;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <GradientHero
        title="Fertilizer Store"
        subtitle="தேவையான உரமும் மருந்தையும் தேர்வு செய்யவும்"
        onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
        right={CartButton}
        compact
      />

      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading products...</Text>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.productId}
          numColumns={2}
          columnWrapperStyle={styles.row}
          renderItem={({ item }) => (
            <View style={styles.cardWrap}>
              <ProductCard
                product={item}
                role={role}
                onViewDetails={(p) => navigation.navigate('ProductDetails', { productId: p.productId })}
                onAddToCart={handleAddToCart}
                onEdit={(p) => navigation.navigate('EditStock', { product: p })}
              />
            </View>
          )}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={10}
          removeClippedSubviews={Platform.OS === 'android'}
          onEndReached={() => nextCursor && !loadingMore && fetchProducts(nextCursor)}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No products found.</Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: '#F2F7F3' },
  centered:        { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText:     { marginTop: 12, color: COLORS.textSecondary },
  listContent:     { padding: SPACING.md, paddingBottom: 40 },
  row:             { gap: SPACING.sm },
  cardWrap:        { flex: 1, maxWidth: '50%' },
  emptyContainer:  { padding: 32, alignItems: 'center' },
  emptyText:       { fontSize: 16, color: COLORS.textSecondary },
  cartBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  cartBadge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: '#FF5252', borderRadius: 9, minWidth: 18, height: 18,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3,
  },
  cartBadgeText: { color: '#fff', fontSize: 9.5, fontWeight: 'bold' },
});
