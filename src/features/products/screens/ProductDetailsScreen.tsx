import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Product } from '../../../types/product';
import { productService } from '../services/productService';

export const ProductDetailsScreen = ({ route, navigation }: any) => {
  const { productId } = route.params;
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const data = await productService.getProductById(productId);
        if (data) {
          setProduct(data);
        } else {
          Alert.alert('Error', 'Product not found');
          navigation.goBack();
        }
      } catch (error) {
        Alert.alert('Error', 'Failed to load product details');
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [productId, navigation]);

  const handleAddToCart = async () => {
    if (!product) return;
    try {
      await productService.addToCart(product.id, quantity);
      Alert.alert('Success', `${quantity} x ${product.name} added to cart!`, [
        { text: 'Continue Shopping' },
        { text: 'Go to Cart', onPress: () => navigation.navigate('Cart') }
      ]);
    } catch (error) {
      Alert.alert('Error', 'Could not add to cart');
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2e7d32" />
      </View>
    );
  }

  if (!product) return null;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.category}>{product.category}</Text>
        <Text style={styles.name}>{product.name}</Text>
        <Text style={styles.price}>₹{product.price.toFixed(2)}</Text>
        
        <View style={styles.divider} />
        
        <Text style={styles.sectionTitle}>Description</Text>
        <Text style={styles.description}>{product.description}</Text>
        
        <View style={styles.divider} />
        
        <Text style={styles.stockInfo}>
          Availability: <Text style={product.stock > 0 ? styles.inStock : styles.outOfStock}>
            {product.stock > 0 ? `${product.stock} items left in stock` : 'Out of stock'}
          </Text>
        </Text>

        {product.stock > 0 && (
          <View style={styles.purchaseSection}>
            <Text style={styles.sectionTitle}>Quantity</Text>
            <View style={styles.quantityControls}>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => setQuantity(prev => Math.max(1, prev - 1))}
              >
                <Text style={styles.qtyBtnText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.qtyText}>{quantity}</Text>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => setQuantity(prev => Math.min(product.stock, prev + 1))}
              >
                <Text style={styles.qtyBtnText}>+</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.addToCartBtn} onPress={handleAddToCart}>
              <Text style={styles.addToCartBtnText}>Add to Cart</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 24,
  },
  category: {
    fontSize: 14,
    color: '#2e7d32',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  name: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  price: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 20,
  },
  divider: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
  },
  stockInfo: {
    fontSize: 14,
    color: '#444',
    marginBottom: 24,
  },
  inStock: {
    color: '#2e7d32',
    fontWeight: '600',
  },
  outOfStock: {
    color: '#d32f2f',
    fontWeight: '600',
  },
  purchaseSection: {
    marginTop: 10,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  qtyBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyBtnText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  qtyText: {
    fontSize: 18,
    marginHorizontal: 20,
    minWidth: 20,
    textAlign: 'center',
  },
  addToCartBtn: {
    backgroundColor: '#2e7d32',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  addToCartBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
