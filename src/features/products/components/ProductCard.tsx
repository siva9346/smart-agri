import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { UserRole } from '../../../types/product';
import { ApiProduct } from '../services/productService';
import { ProductImage } from '../../../components/ProductImage';

interface ProductCardProps {
  product: ApiProduct;
  role: UserRole;
  onViewDetails: (product: ApiProduct) => void;
  onAddToCart?: (product: ApiProduct) => void;
  onEdit?: (product: ApiProduct) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  role,
  onViewDetails,
  onAddToCart,
  onEdit,
}) => {
  const isOutOfStock = product.stock <= 0;

  return (
    <View style={styles.card}>
      <View style={styles.imageWrap}>
        <ProductImage uri={product.imageUrl} width="100%" height={140} borderRadius={12} iconSize={40} />
      </View>
      <View style={styles.header}>
        <Text style={styles.name}>{product.name}</Text>
        <Text style={styles.category}>{product.category}</Text>
      </View>

      <Text style={styles.description} numberOfLines={2}>
        {product.description}
      </Text>

      <View style={styles.footer}>
        <View>
          <Text style={styles.price}>₹{product.price.toFixed(2)}</Text>
          {product.unit ? (
            <Text style={styles.unit}>per {product.unit}</Text>
          ) : null}
          <Text style={[styles.stock, isOutOfStock && styles.outOfStock]}>
            {isOutOfStock ? 'Out of Stock' : `Stock: ${product.stock}`}
          </Text>
        </View>

        <View style={styles.actions}>
          {role === 'customer' ? (
            <>
              <TouchableOpacity
                style={[styles.button, styles.secondaryButton]}
                onPress={() => onViewDetails(product)}
              >
                <Text style={styles.secondaryButtonText}>Details</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.primaryButton, isOutOfStock && styles.disabledButton]}
                onPress={() => onAddToCart?.(product)}
                disabled={isOutOfStock}
              >
                <Text style={styles.primaryButtonText}>Add to Cart</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={() => onEdit?.(product)}
            >
              <Text style={styles.secondaryButtonText}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  imageWrap: {
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  category: {
    fontSize: 12,
    color: '#666',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 8,
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2e7d32',
  },
  unit: {
    fontSize: 11,
    color: '#888',
    marginTop: 1,
  },
  stock: {
    fontSize: 12,
    color: '#777',
    marginTop: 2,
  },
  outOfStock: {
    color: '#d32f2f',
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
  },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginLeft: 8,
  },
  primaryButton: {
    backgroundColor: '#2e7d32',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#2e7d32',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  secondaryButtonText: {
    color: '#2e7d32',
    fontWeight: '600',
    fontSize: 14,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
});
