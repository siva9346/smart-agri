import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, TouchableWithoutFeedback, Platform } from 'react-native';

const PAGE_SIZE = 20;
import { COLORS, SPACING, BORDER_RADIUS } from '../../../theme';
import { MessageSquare, MapPin, Calendar, Clock, CheckCircle } from 'lucide-react-native';

const INITIAL_ENQUIRIES = [
  {
    id: 'E101',
    userName: 'Ravi Kumar',
    village: 'Ambattur',
    enquiryText: 'Crop leaves turning yellow, need advice',
    fullMessage: 'My paddy crop has been showing yellowing on the lower leaves covering around 2 acres of land. I applied Urea last week but the spreading continues. Please suggest a remedy.',
    date: new Date().toLocaleDateString(),
    status: 'Pending',
    phone: '9876543210'
  },
  {
    id: 'E102',
    userName: 'Suresh Anna',
    village: 'Madurai',
    enquiryText: 'Looking to buy bulk DAP fertilizer',
    fullMessage: 'I need to purchase 50 bags of DAP fertilizer for the upcoming season. Let me know the discounted price.',
    date: new Date(Date.now() - 86400000).toLocaleDateString(),
    status: 'Completed',
    phone: '9876543211'
  },
  {
    id: 'E103',
    userName: 'Murugan',
    village: 'Avadi',
    enquiryText: 'Pest attack on tomato plants',
    fullMessage: 'Noticing significant pest attacks forming webs on my tomato plants during morning hours. Which pesticide works best?',
    date: new Date(Date.now() - 172800000).toLocaleDateString(),
    status: 'Pending',
    phone: '9876543212'
  },
  {
    id: 'E104',
    userName: 'Karthik',
    village: 'Trichy',
    enquiryText: 'Payment issue on last order',
    fullMessage: 'My recent order for Organic Compost shows failed payment but money was deducted from my account. Please verify.',
    date: new Date(Date.now() - 259200000).toLocaleDateString(),
    status: 'Completed',
    phone: '9876543213'
  },
  {
    id: 'E105',
    userName: 'Velu',
    village: 'Tirunelveli',
    enquiryText: 'Recommendation for banana crop',
    fullMessage: 'Starting a new banana plantation. Need a complete fertilizer schedule for the first 3 months.',
    date: new Date(Date.now() - 345600000).toLocaleDateString(),
    status: 'Pending',
    phone: '9876543214'
  }
];

export const EnquiryListScreen = ({ navigation, route }: any) => {
  const [enquiries, setEnquiries] = useState(INITIAL_ENQUIRIES);
  const [filter, setFilter] = useState<'All' | 'Pending' | 'Completed'>('All');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  React.useEffect(() => {
    if (route.params?.updatedEnquiry) {
      setEnquiries(prev => prev.map(e => e.id === route.params.updatedEnquiry.id ? route.params.updatedEnquiry : e));
      navigation.setParams({ updatedEnquiry: undefined });
    }
  }, [route.params?.updatedEnquiry]);

  // Memoised filter — only recomputes when enquiries or filter changes
  const filteredEnquiries = useMemo(() => {
    const base = filter === 'All' ? enquiries : enquiries.filter(e => e.status === filter);
    return base.slice(0, visibleCount);
  }, [enquiries, filter, visibleCount]);

  const handleFilterChange = useCallback((f: 'All' | 'Pending' | 'Completed') => {
    setFilter(f);
    setVisibleCount(PAGE_SIZE); // reset pagination when filter changes
  }, []);

  const handleEndReached = useCallback(() => {
    const total = filter === 'All' ? enquiries.length : enquiries.filter(e => e.status === filter).length;
    setVisibleCount(c => Math.min(c + PAGE_SIZE, total));
  }, [enquiries, filter]);

  const renderEnquiry = useCallback(({ item }: { item: typeof INITIAL_ENQUIRIES[0] }) => {
    const isPending = item.status === 'Pending';
    return (
      <TouchableOpacity 
        style={styles.card}
        activeOpacity={0.9}
        onPress={() => navigation.navigate('EnquiryDetails', { enquiry: item })}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.userName}>{item.userName}</Text>
          <View style={[styles.statusBadge, { backgroundColor: isPending ? '#FFF3E0' : '#E8F5E9' }]}>
            <Text style={[styles.statusText, { color: isPending ? '#E65100' : '#2E7D32' }]}>{item.status}</Text>
          </View>
        </View>
        
        <Text style={styles.preview} numberOfLines={2}>"{item.enquiryText}"</Text>

        <View style={styles.cardFooter}>
          <View style={styles.footerItem}>
            <MapPin size={14} color="#666" style={{ marginRight: 4 }} />
            <Text style={styles.footerText}>{item.village}</Text>
          </View>
          <View style={styles.footerItem}>
            <Calendar size={14} color="#666" style={{ marginRight: 4 }} />
            <Text style={styles.footerText}>{item.date}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [navigation]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.filterContainer}>
        {(['All', 'Pending', 'Completed'] as const).map(f => (
          <TouchableWithoutFeedback key={f} onPress={() => handleFilterChange(f)}>
            <View style={[styles.filterPill, filter === f && styles.filterPillActive]}>
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
            </View>
          </TouchableWithoutFeedback>
        ))}
      </View>

      <FlatList
        data={filteredEnquiries}
        keyExtractor={item => item.id}
        renderItem={renderEnquiry}
        contentContainerStyle={styles.listContent}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={10}
        removeClippedSubviews={Platform.OS === 'android'}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MessageSquare size={48} color="#CCC" />
            <Text style={styles.emptyText}>No enquiries found.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  filterContainer: {
    flexDirection: 'row',
    padding: SPACING.md,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    marginRight: SPACING.md,
  },
  filterPillActive: {
    backgroundColor: COLORS.primary,
  },
  filterText: {
    color: '#666',
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  listContent: {
    padding: SPACING.md,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
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
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  preview: {
    fontSize: 14,
    color: '#555',
    fontStyle: 'italic',
    marginBottom: SPACING.md,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: SPACING.sm,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    color: '#666',
  },
  emptyContainer: {
    padding: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    marginTop: SPACING.md,
    fontSize: 16,
    color: '#999',
  }
});
