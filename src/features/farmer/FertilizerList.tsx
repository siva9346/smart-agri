import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS } from '../../theme';
import { mockRepository } from '../../repositories/MockRepository';
import { FertilizerProduct } from '../../types/domain';
import { Card } from '../../components/Card';
import { LoadingState, EmptyState, ErrorState } from '../../components/States';

export const FertilizerList = () => {
  const [products, setProducts] = useState<FertilizerProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const response = await mockRepository.getFertilizers();
      if (response.success) {
        setProducts(response.data);
      } else {
        setError(response.error);
      }
    } catch (err) {
      setError('Failed to fetch products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handlePurchase = async (product: FertilizerProduct) => {
    Alert.alert(
      'Confirm Purchase',
      `Buy 1 unit of ${product.name} for ₹${product.price}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Buy',
          onPress: async () => {
            const res = await mockRepository.purchaseFertilizer('1', product.id, 1);
            if (res.success) {
              Alert.alert('Success', 'Fertilizer purchased successfully!');
            }
          }
        }
      ]
    );
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;

  return (
    <FlatList
      data={products}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.container}
      renderItem={({ item }) => (
        <Card>
          <View style={styles.cardHeader}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.price}>₹{item.price}</Text>
          </View>
          <Text style={styles.description}>{item.description}</Text>
          <View style={styles.cardFooter}>
            <Text style={styles.stock}>Stock: {item.stock} left</Text>
            <TouchableOpacity 
              style={styles.buyButton}
              onPress={() => handlePurchase(item)}
            >
              <Text style={styles.buyButtonText}>Purchase</Text>
            </TouchableOpacity>
          </View>
        </Card>
      )}
      ListEmptyComponent={<EmptyState message="No products available" />}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    padding: SPACING.md,
    backgroundColor: COLORS.background,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  price: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  description: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.sm,
  },
  stock: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  buyButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  buyButtonText: {
    color: 'white',
    fontWeight: 'bold',
  }
});
