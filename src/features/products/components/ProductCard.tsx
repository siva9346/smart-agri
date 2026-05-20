import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Product, UserRole } from '../../../types/product';

interface ProductCardProps {
  product: Product;
  role: UserRole;
  onViewDetails: (product: Product) => void;
  onAddToCart?: (product: Product) => void;
  onEdit?: (product: Product) => void;
  onUpdateStock?: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  role,
  onViewDetails,
  onAddToCart,
  onEdit,
  onUpdateStock,
}) => {
  const isOutofStock = product.stock <= 0;

  return (
    <View style={styles.card}>
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
          <Text style={[styles.stock, isOutofStock && styles.outOfStock]}>
            {isOutofStock ? 'Out of Stock' : `Stock: ${product.stock}`}
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
                style={[styles.button, styles.primaryButton, isOutofStock && styles.disabledButton]}
                onPress={() => onAddToCart?.(product)}
                disabled={isOutofStock}
              >
                <Text style={styles.primaryButtonText}>Add to Cart</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.button, styles.secondaryButton]}
                onPress={() => onEdit?.(product)}
              >
                <Text style={styles.secondaryButtonText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.primaryButton]}
                onPress={() => onUpdateStock?.(product)}
              >
                <Text style={styles.primaryButtonText}>Stock +</Text>
              </TouchableOpacity>
            </>
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
    color: '#2e7d32', // Green for price
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
