import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, Platform } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS } from '../../../theme';
import { api } from '../../../services/api';
import { LoadingState, EmptyState, ErrorState } from '../../../components/States';

interface ApiEnquiry {
  enquiryId: string;
  farmerId: string;
  subject: string;
  message: string;
  category: string;
  status: string;
  response?: string;
  createdAt: string;
}

const FILTERS = ['All', 'OPEN', 'IN_PROGRESS', 'RESOLVED'];
const STATUS_COLOR: Record<string, string> = { OPEN: '#e67e22', IN_PROGRESS: '#2980b9', RESOLVED: '#27ae60', CLOSED: '#7f8c8d' };

export const EnquiryListScreen = ({ navigation }: any) => {
  const [enquiries,   setEnquiries]   = useState<ApiEnquiry[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [filter,      setFilter]      = useState('All');
  const [nextCursor,  setNextCursor]  = useState<string | undefined>();
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchEnquiries = useCallback(async (cursor?: string, status?: string) => {
    if (cursor) setLoadingMore(true); else setLoading(true);
    try {
      let path = '/enquiries';
      const params = [];
      if (status && status !== 'All') params.push(`status=${status}`);
      if (cursor) params.push(`cursor=${cursor}`);
      if (params.length) path += '?' + params.join('&');

      const res = await api.get<{ items: ApiEnquiry[]; nextCursor?: string }>(path);
      setEnquiries(prev => cursor ? [...prev, ...res.items] : res.items);
      setNextCursor(res.nextCursor);
      setError(null);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load enquiries');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { fetchEnquiries(undefined, filter); }, [filter, fetchEnquiries]);

  const handleFilterChange = useCallback((f: string) => {
    setFilter(f);
    setEnquiries([]);
    setNextCursor(undefined);
  }, []);

  const renderItem = useCallback(({ item }: { item: ApiEnquiry }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('EnquiryDetails', { enquiryId: item.enquiryId, onUpdate: () => fetchEnquiries(undefined, filter) })}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.subject}>{item.subject}</Text>
        <View style={[styles.badge, { backgroundColor: (STATUS_COLOR[item.status] ?? '#666') + '20' }]}>
          <Text style={[styles.badgeText, { color: STATUS_COLOR[item.status] ?? '#666' }]}>{item.status}</Text>
        </View>
      </View>
      <Text style={styles.message} numberOfLines={2}>{item.message}</Text>
      <Text style={styles.date}>{item.createdAt.split('T')[0]}</Text>
    </TouchableOpacity>
  ), [navigation, filter, fetchEnquiries]);

  if (loading) return <LoadingState />;
  if (error)   return <ErrorState error={error} />;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.filterRow}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
            onPress={() => handleFilterChange(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList
        data={enquiries}
        keyExtractor={i => i.enquiryId}
        contentContainerStyle={styles.list}
        renderItem={renderItem}
        onEndReached={() => nextCursor && !loadingMore && fetchEnquiries(nextCursor, filter)}
        onEndReachedThreshold={0.4}
        removeClippedSubviews={Platform.OS === 'android'}
        ListEmptyComponent={<EmptyState message="No enquiries found" />}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: COLORS.background },
  filterRow:       { flexDirection: 'row', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, gap: 8 },
  filterBtn:       { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  filterBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterText:      { fontSize: 12, color: COLORS.text, fontWeight: '500' },
  filterTextActive:{ color: '#fff' },
  list:            { paddingHorizontal: SPACING.md, paddingBottom: SPACING.md },
  card:            { backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2 },
  cardHeader:      { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  subject:         { flex: 1, fontSize: 15, fontWeight: 'bold', color: COLORS.text },
  badge:           { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeText:       { fontSize: 11, fontWeight: 'bold' },
  message:         { fontSize: 13, color: COLORS.textSecondary, marginBottom: 6 },
  date:            { fontSize: 12, color: COLORS.textSecondary },
});
