import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, TextInput, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, BORDER_RADIUS } from '../../../theme';
import { api } from '../../../services/api';
import { LoadingState, EmptyState, ErrorState } from '../../../components/States';
import { UserPlus } from 'lucide-react-native';

interface ApiCustomer {
  userId: string;
  name: string;
  phone: string;
  village: string;
  district: string;
  createdAt: string;
}

export const CustomerListScreen = ({ navigation }: any) => {
  const [customers,   setCustomers]   = useState<ApiCustomer[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [search,      setSearch]      = useState('');
  const [nextCursor,  setNextCursor]  = useState<string | undefined>();
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchCustomers = useCallback(async (cursor?: string) => {
    if (cursor) setLoadingMore(true); else setLoading(true);
    try {
      const path = cursor ? `/farmers?cursor=${cursor}` : '/farmers';
      const res  = await api.get<{ items: ApiCustomer[]; nextCursor?: string }>(path);
      setCustomers(prev => cursor ? [...prev, ...res.items] : res.items);
      setNextCursor(res.nextCursor);
      setError(null);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load customers');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const filtered = customers.filter(c =>
    !search ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  );

  const renderItem = useCallback(({ item }: { item: ApiCustomer }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('CustomerDetails', { customerId: item.userId })}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.detail}>{item.phone}</Text>
        {item.village ? <Text style={styles.detail}>{item.village}</Text> : null}
      </View>
    </TouchableOpacity>
  ), [navigation]);

  if (loading) return <LoadingState />;
  if (error)   return <ErrorState error={error} />;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.search}
          placeholder="Search by name or phone..."
          value={search}
          onChangeText={setSearch}
        />
        <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('CreateCustomer')}>
          <UserPlus size={20} color="#fff" />
        </TouchableOpacity>
      </View>
      <FlatList
        data={filtered}
        keyExtractor={i => i.userId}
        contentContainerStyle={styles.list}
        renderItem={renderItem}
        onEndReached={() => nextCursor && !loadingMore && fetchCustomers(nextCursor)}
        onEndReachedThreshold={0.4}
        removeClippedSubviews={Platform.OS === 'android'}
        ListEmptyComponent={<EmptyState message="No customers found" />}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: COLORS.background },
  searchRow:  { flexDirection: 'row', padding: SPACING.md, gap: 8 },
  search:     { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: BORDER_RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 10, fontSize: 14, backgroundColor: COLORS.surface },
  addBtn:     { backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.md, paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center' },
  list:       { paddingHorizontal: SPACING.md, paddingBottom: SPACING.md },
  card:       { flexDirection: 'row', backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2 },
  avatar:     { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', marginRight: SPACING.md },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  info:       { flex: 1 },
  name:       { fontSize: 16, fontWeight: 'bold', color: COLORS.text },
  detail:     { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
});
