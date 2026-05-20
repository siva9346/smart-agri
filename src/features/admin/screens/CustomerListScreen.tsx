import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, BORDER_RADIUS } from '../../../theme';
import { User, MapPin, Phone, CheckCircle, Plus, ChevronRight } from 'lucide-react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store';

const PAGE_SIZE = 20;

const INITIAL_CUSTOMERS = [
  {
    id: '1',
    name: 'Murugan',
    village: 'Avadi',
    phone: '9876543210',
    email: 'murugan@example.com',
    landsCount: 2,
    lands: [
      { 
        id: 'L1', 
        size: '2.5 acres', 
        soil: 'Black soil', 
        currentCrop: 'Paddy', 
        prevCrops: 'Groundnut, Cotton', 
        fertilizerUsed: 'Urea, DAP', 
        manureUsed: 'Cow dung',
        cropCycles: [
          { cropName: 'Paddy', records: [{ expense: 12000, stage: 'planting', date: '2026-03-01' }, { expense: 6500, stage: 'fertilizer', date: '2026-03-15' }] },
          { cropName: 'Groundnut', records: [{ expense: 15000, stage: 'harvesting', date: '2025-11-20' }] }
        ]
      },
      { 
        id: 'L2', 
        size: '1.2 acres', 
        soil: 'Red soil', 
        currentCrop: 'Banana', 
        prevCrops: 'None', 
        fertilizerUsed: 'Potash', 
        manureUsed: 'Compost',
        cropCycles: [
          { cropName: 'Banana', records: [{ expense: 8000, stage: 'cleaning', date: '2026-02-10' }] }
        ]
      },
    ]
  },
  {
    id: '2',
    name: 'Suresh Anna',
    village: 'Madurai',
    phone: '9876543211',
    email: 'suresh@example.com',
    landsCount: 1,
    lands: [
      { 
        id: 'L3', 
        size: '5 acres', 
        soil: 'Alluvial soil', 
        currentCrop: 'Sugarcane', 
        prevCrops: 'Paddy', 
        fertilizerUsed: 'Urea', 
        manureUsed: 'Poultry manure',
        cropCycles: [
          { cropName: 'Sugarcane', records: [{ expense: 25000, stage: 'planting', date: '2026-01-05' }] }
        ]
      }
    ]
  },
  {
    id: '3',
    name: 'Karthik',
    village: 'Trichy',
    phone: '9876543212',
    email: 'karthik@example.com',
    landsCount: 3,
    lands: [
      { id: 'L4', size: '1 acre', soil: 'Red soil', currentCrop: 'Tomato', prevCrops: 'Chilli', fertilizerUsed: 'Bio Fertilizer', manureUsed: 'Compost' }
    ]
  },
  {
    id: '4',
    name: 'Ramesh',
    village: 'Coimbatore',
    phone: '9876543213',
    email: 'ramesh@example.com',
    landsCount: 1,
    lands: [
      { id: 'L5', size: '3 acres', soil: 'Black soil', currentCrop: 'Cotton', prevCrops: 'Maize', fertilizerUsed: 'DAP', manureUsed: 'None' }
    ]
  },
  {
    id: '5',
    name: 'Velu',
    village: 'Tirunelveli',
    phone: '9876543214',
    email: 'velu@example.com',
    landsCount: 2,
    lands: [
      { id: 'L6', size: '4 acres', soil: 'Sandy soil', currentCrop: 'Groundnut', prevCrops: 'Sesame', fertilizerUsed: 'Urea', manureUsed: 'Cow dung' }
    ]
  },
];

export const CustomerListScreen = ({ navigation, route }: any) => {
  const customers = useSelector((state: RootState) => state.customer.customers);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const visibleCustomers = useMemo(
    () => customers.slice(0, visibleCount),
    [customers, visibleCount],
  );
  const handleEndReached = useCallback(() => {
    setVisibleCount(c => Math.min(c + PAGE_SIZE, customers.length));
  }, [customers.length]);

  const renderCustomerItem = useCallback(({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.card}
      activeOpacity={0.9}
      onPress={() => navigation.navigate('CustomerDetails', { customer: item })}
    >
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
        </View>
        <View style={styles.infoArea}>
          <Text style={styles.name}>{item.name}</Text>
          <View style={styles.row}>
            <MapPin size={14} color="#666" style={{ marginRight: 4 }} />
            <Text style={styles.detailText}>{item.village}</Text>
          </View>
        </View>
        <ChevronRight size={20} color="#CCC" />
      </View>

      <View style={styles.divider} />

      <View style={styles.cardFooter}>
        <View style={styles.footerItem}>
          <Phone size={14} color="#666" style={{ marginRight: 6 }} />
          <Text style={styles.phoneText}>{item.phone}</Text>
        </View>
        <View style={styles.landBadge}>
          <Text style={styles.landBadgeText}>
            {item.landsCount} {item.landsCount === 1 ? 'Land' : 'Lands'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  ), [navigation]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerArea}>
        <Text style={styles.title}>Farmers Directory</Text>
        <TouchableOpacity 
          style={styles.addBtn}
          onPress={() => navigation.navigate('CreateCustomer')}
        >
          <Plus size={20} color="#FFF" />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={visibleCustomers}
        keyExtractor={item => item.id}
        renderItem={renderCustomerItem}
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
    alignItems: 'center',
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  infoArea: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 14,
    color: '#666',
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
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#555',
  },
  phoneText: {
    fontSize: 13,
    color: '#666',
  },
  landBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  landBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
});
