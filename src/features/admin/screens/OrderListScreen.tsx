import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Platform,
} from 'react-native';

const PAGE_SIZE = 20;
import { COLORS, SPACING, BORDER_RADIUS } from '../../../theme';
import { Package, Calendar, MapPin, User, ChevronRight } from 'lucide-react-native';

const DUMMY_ORDERS = [
  {
    id: 'ORD-10293',
    customerName: 'Ravi Kumar',
    address: 'Ambattur, Chennai',
    phone: '9876543210',
    total: 1950,
    status: 'Pending',
    createdAt: new Date().toISOString(),
    items: [
      { name: 'Urea Fertilizer', quantity: 2, price: 650 },
      { name: 'DAP Fertilizer', quantity: 1, price: 650 },
    ],
  },
  {
    id: 'ORD-10294',
    customerName: 'Suresh Anna',
    address: 'Madurai, Tamil Nadu',
    phone: '9876543211',
    total: 2700,
    status: 'Pending',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    items: [
      { name: 'Potash', quantity: 3, price: 900 },
    ],
  },
  {
    id: 'ORD-10295',
    customerName: 'Murugan',
    address: 'Avadi',
    phone: '9876543212',
    total: 450,
    status: 'Pending',
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    items: [
      { name: 'Organic Compost', quantity: 1, price: 450 },
    ],
  },
  {
    id: 'ORD-10296',
    customerName: 'Karthik',
    address: 'Trichy',
    phone: '9876543213',
    total: 1040,
    status: 'Pending',
    createdAt: new Date(Date.now() - 259200000).toISOString(),
    items: [
      { name: 'Bio Fertilizer', quantity: 2, price: 520 },
    ],
  },
  {
    id: 'ORD-10297',
    customerName: 'Ramesh',
    address: 'Coimbatore',
    phone: '9876543214',
    total: 1300,
    status: 'Pending',
    createdAt: new Date(Date.now() - 345600000).toISOString(),
    items: [
      { name: 'Urea Fertilizer', quantity: 2, price: 650 },
    ],
  }
];

export const OrderListScreen = ({ navigation }: any) => {
  const [orders] = useState(DUMMY_ORDERS);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const visibleOrders = useMemo(
    () => orders.slice(0, visibleCount),
    [orders, visibleCount],
  );
  const handleEndReached = useCallback(() => {
    setVisibleCount(c => Math.min(c + PAGE_SIZE, orders.length));
  }, [orders.length]);

  const renderOrderItem = useCallback(({ item }: { item: any }) => {
    return (
      <TouchableOpacity 
        style={styles.card} 
        onPress={() => navigation.navigate('OrderDetails', { order: item })}
        activeOpacity={0.9}
      >
        <View style={styles.cardHeader}>
          <View style={styles.headerRow}>
            <View style={styles.idContainer}>
              <Text style={styles.orderId}>{item.id}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: '#FFF8E1' }]}>
              <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
            </View>
          </View>
          
          <View style={styles.customerRow}>
            <User size={16} color="#666" style={styles.icon} />
            <Text style={styles.customerName}>{item.customerName}</Text>
          </View>

          <View style={styles.infoRow}>
            <MapPin size={16} color="#666" style={styles.icon} />
            <Text style={styles.address} numberOfLines={1}>{item.address}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.cardFooter}>
          <View style={styles.footerItem}>
            <Package size={16} color="#666" style={styles.icon} />
            <Text style={styles.footerText}>{item.items.length} Items</Text>
          </View>
          <View style={styles.footerItem}>
            <Calendar size={16} color="#666" style={styles.icon} />
            <Text style={styles.footerText}>{new Date(item.createdAt).toLocaleDateString()}</Text>
          </View>
          <Text style={styles.totalAmount}>₹{item.total.toFixed(2)}</Text>
          <ChevronRight size={20} color="#CCC" style={{ marginLeft: 8 }} />
        </View>
      </TouchableOpacity>
    );
  }, [navigation]);

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={visibleOrders}
        keyExtractor={(item) => item.id}
        renderItem={renderOrderItem}
        contentContainerStyle={styles.listContent}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={10}
        removeClippedSubviews={Platform.OS === 'android'}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.4}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  listContent: {
    padding: SPACING.md,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    overflow: 'hidden',
  },
  cardHeader: {
    padding: SPACING.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  idContainer: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  orderId: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#F57F17',
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  customerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  icon: {
    marginRight: 6,
  },
  address: {
    fontSize: 13,
    color: '#666',
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: '#FAFAFA',
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  footerText: {
    fontSize: 12,
    color: '#666',
  },
  totalAmount: {
    flex: 1,
    textAlign: 'right',
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
});
