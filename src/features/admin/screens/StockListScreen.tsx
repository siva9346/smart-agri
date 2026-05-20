import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, Alert } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS } from '../../../theme';
import { Edit2, Package, Plus } from 'lucide-react-native';

const INITIAL_STOCK = [
  { id: '1', name: 'Urea Fertilizer', category: 'Fertilizers', price: 650, stock: 120, description: 'High nitrogen fertilizer for leafy green growth.' },
  { id: '2', name: 'DAP Fertilizer', category: 'Fertilizers', price: 1350, stock: 80, description: 'Phosphate rich fertilizer for roots.' },
  { id: '3', name: 'Potash', category: 'Fertilizers', price: 900, stock: 60, description: 'Enhances overall plant disease resistance.' },
  { id: '4', name: 'Organic Compost', category: 'Organic', price: 450, stock: 200, description: 'Natural compost for soil enrichment.' },
  { id: '5', name: 'Bio Fertilizer', category: 'Organic', price: 520, stock: 150, description: 'Bio-based nutrients for sustainable farming.' },
  { id: '6', name: 'Zinc Sulphate', category: 'Micronutrients', price: 300, stock: 45, description: 'Prevents zinc deficiency in crops.' },
];

export const StockListScreen = ({ navigation, route }: any) => {
  const [inventory, setInventory] = useState(INITIAL_STOCK);

  // Example of handling return params for local state updates
  React.useEffect(() => {
    if (route.params?.newProduct) {
      setInventory(prev => [route.params.newProduct, ...prev]);
      navigation.setParams({ newProduct: undefined }); // clear param
    }
    if (route.params?.updatedProduct) {
      setInventory(prev => prev.map(p => p.id === route.params.updatedProduct.id ? route.params.updatedProduct : p));
      navigation.setParams({ updatedProduct: undefined }); // clear param
    }
  }, [route.params?.newProduct, route.params?.updatedProduct]);

  const renderStockItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.titleArea}>
          <Text style={styles.productName}>{item.name}</Text>
          <Text style={styles.category}>{item.category}</Text>
        </View>
        <TouchableOpacity 
          style={styles.editBtn}
          onPress={() => navigation.navigate('EditStock', { product: item })}
        >
          <Edit2 size={16} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
      
      <View style={styles.divider} />
      
      <View style={styles.cardFooter}>
        <Text style={styles.price}>₹{item.price}</Text>
        <View style={styles.stockBadge}>
          <Package size={14} color="#555" style={{ marginRight: 4 }} />
          <Text style={styles.stockText}>{item.stock} bags</Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerArea}>
        <Text style={styles.title}>Inventory</Text>
        <TouchableOpacity 
          style={styles.addBtn}
          onPress={() => navigation.navigate('AddStock')}
        >
          <Plus size={20} color="#FFF" />
          <Text style={styles.addBtnText}>Add Stock</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={inventory}
        keyExtractor={item => item.id}
        renderItem={renderStockItem}
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  headerArea: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.md,
  },
  addBtnText: {
    color: '#FFF',
    fontWeight: 'bold',
    marginLeft: 4,
  },
  listContent: {
    padding: SPACING.md,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleArea: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  category: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  editBtn: {
    padding: 6,
    backgroundColor: '#F0F0F0',
    borderRadius: 20,
  },
  description: {
    fontSize: 13,
    color: '#666',
    marginTop: SPACING.sm,
  },
  divider: {
    height: 1,
    backgroundColor: '#EEE',
    marginVertical: SPACING.md,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  price: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  stockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  stockText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#555',
  },
});
