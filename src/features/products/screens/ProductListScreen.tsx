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
import { Product, UserRole } from '../../../types/product';
import { productService } from '../services/productService';
import { ProductCard } from '../components/ProductCard';
import { addToCart } from '../../../store/cartSlice';
import { RootState } from '../../../store';

export const ProductListScreen = ({ navigation, route }: any) => {
  // Use role from navigation params if provided, otherwise default to 'customer'
  const role: UserRole = route.params?.role || 'customer';
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const dispatch = useDispatch();
  const cartCount = useSelector((state: RootState) =>
    state.cart.items.reduce((sum, item) => sum + item.quantity, 0)
  );

  const fetchProducts = useCallback(async () => {
    try {
      const data = await productService.getProducts();
      setProducts(data);
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch products');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchProducts();
    });
    return unsubscribe;
  }, [navigation, fetchProducts]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchProducts();
  };

  const handleAddToCart = (product: Product) => {
    dispatch(addToCart({ productId: product.id, name: product.name, price: product.price }));
    Alert.alert('Success', `${product.name} added to cart!`);
  };

  const handleUpdateStock = async (product: Product) => {
    try {
      const updated = await productService.updateProductStock(product.id, product.stock + 10);
      if (updated) {
        setProducts(prev => prev.map(p => p.id === updated.id ? updated : p));
        Alert.alert('Success', 'Stock updated (+10)');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update stock');
    }
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
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ProductCard
            product={item}
            role={role}
            onViewDetails={(p) => navigation.navigate('ProductDetails', { productId: p.id })}
            onAddToCart={handleAddToCart}
            onEdit={(p) => Alert.alert('Edit', `Editing ${p.name}`)}
            onUpdateStock={handleUpdateStock}
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

      {(role === 'admin' || role === 'staff') && (
        <>
          <TouchableOpacity
            style={styles.fab}
            onPress={() => navigation.navigate('AddProduct')}
          >
            <Text style={styles.fabIcon}>+</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.fab, { bottom: 90, backgroundColor: '#f57c00' }]}
            onPress={() => navigation.navigate('OrderList')}
          >
            <Text style={styles.fabText}>Orders</Text>
          </TouchableOpacity>
        </>
      )}

      <TouchableOpacity
        style={[styles.fab, { bottom: role === 'customer' ? 100 : 160, backgroundColor: '#1565c0' }]}
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
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
  },
  listContent: {
    paddingBottom: 100,
  },
  headerContainer: {
    padding: 16,
    backgroundColor: '#fff',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  headerTextTamil: {
    fontSize: 15,
    color: '#666',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    backgroundColor: '#2e7d32',
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
  fabIcon: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '300',
  },
  fabText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
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
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
});
