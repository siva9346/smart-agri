import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Plus, Pencil } from 'lucide-react-native';
import { UserRole } from '../../../types/product';
import { ApiProduct } from '../services/productService';
import { ProductImage } from '../../../components/ProductImage';
import { GlassCard } from '../../../components/GlassCard';
import { COLORS, BORDER_RADIUS, SPACING } from '../../../theme';

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
    <GlassCard style={styles.card} onPress={() => onViewDetails(product)}>
      <View style={styles.imageWrap}>
        <ProductImage uri={product.imageUrl} width="100%" height={110} borderRadius={BORDER_RADIUS.md} iconSize={34} />
        {isOutOfStock && (
          <View style={styles.outOfStockBanner}>
            <Text style={styles.outOfStockBannerText}>Out of Stock</Text>
          </View>
        )}
        <View style={styles.categoryChip}>
          <Text style={styles.categoryChipText} numberOfLines={1}>{product.category}</Text>
        </View>
      </View>

      <Text style={styles.name} numberOfLines={2}>{product.name}</Text>

      <View style={styles.priceRow}>
        <Text style={styles.price}>₹{product.price.toFixed(2)}</Text>
        {!!product.unit && <Text style={styles.unit}>/{product.unit}</Text>}
      </View>
      {!isOutOfStock && <Text style={styles.stock}>Stock: {product.stock}</Text>}

      {role === 'customer' ? (
        <TouchableOpacity
          style={[styles.actionBtn, isOutOfStock && styles.actionBtnDisabled]}
          onPress={() => onAddToCart?.(product)}
          disabled={isOutOfStock}
          activeOpacity={0.8}
        >
          <Plus size={14} color="#FFF" />
          <Text style={styles.actionBtnText}>Add to Cart</Text>
        </TouchableOpacity>
      ) : role === 'viewer' ? null : (
        <TouchableOpacity style={styles.editBtn} onPress={() => onEdit?.(product)} activeOpacity={0.8}>
          <Pencil size={14} color={COLORS.primary} />
          <Text style={styles.editBtnText}>Edit</Text>
        </TouchableOpacity>
      )}
    </GlassCard>
  );
};

const styles = StyleSheet.create({
  card: { width: '100%', padding: SPACING.sm },
  imageWrap: { marginBottom: SPACING.sm, position: 'relative' },
  outOfStockBanner: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(211,47,47,0.85)', paddingVertical: 4,
    borderBottomLeftRadius: BORDER_RADIUS.md, borderBottomRightRadius: BORDER_RADIUS.md,
  },
  outOfStockBannerText: { color: '#FFF', fontSize: 10.5, fontWeight: 'bold', textAlign: 'center' },
  categoryChip: {
    position: 'absolute', top: 6, left: 6,
    backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 10, maxWidth: '80%',
  },
  categoryChipText: { fontSize: 10, fontWeight: '600', color: COLORS.textSecondary },
  name: { fontSize: 13.5, fontWeight: '700', color: '#333', marginBottom: 4, minHeight: 34 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  price: { fontSize: 16, fontWeight: 'bold', color: COLORS.primary },
  unit: { fontSize: 11, color: COLORS.textSecondary },
  stock: { fontSize: 11, color: COLORS.textSecondary, marginTop: 1, marginBottom: SPACING.sm },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    backgroundColor: COLORS.primary, paddingVertical: 8, borderRadius: BORDER_RADIUS.md, marginTop: SPACING.xs,
  },
  actionBtnDisabled: { backgroundColor: '#B0BEC5' },
  actionBtnText: { color: '#FFF', fontWeight: '700', fontSize: 12 },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    borderWidth: 1, borderColor: COLORS.primary, paddingVertical: 8, borderRadius: BORDER_RADIUS.md, marginTop: SPACING.xs,
  },
  editBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: 12 },
});
