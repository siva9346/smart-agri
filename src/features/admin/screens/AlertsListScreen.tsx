import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertTriangle } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS } from '../../../theme';
import { api } from '../../../services/api';
import { LoadingState, EmptyState, ErrorState } from '../../../components/States';

interface ApiAlert {
  recordId: string;
  cycleId: string;
  date: string;
  notes: string;
  priority: string;
  cropName?: string;
  landId?: string;
  farmerId?: string;
}

export const AlertsListScreen = ({ navigation }: any) => {
  const [alerts,      setAlerts]      = useState<ApiAlert[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [nextCursor,  setNextCursor]  = useState<string | undefined>();
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchAlerts = useCallback(async (cursor?: string) => {
    if (cursor) setLoadingMore(true); else setLoading(true);
    try {
      const path = cursor ? `/records/alerts?cursor=${cursor}` : '/records/alerts';
      const res  = await api.get<{ items: ApiAlert[]; nextCursor?: string }>(path);
      setAlerts(prev => cursor ? [...prev, ...res.items] : res.items);
      setNextCursor(res.nextCursor);
      setError(null);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load alerts');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  const renderItem = useCallback(({ item }: { item: ApiAlert }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('CropTracking', { cropCycleId: item.cycleId, cropName: item.cropName, readOnly: true })}
    >
      <View style={styles.cardHeader}>
        <AlertTriangle size={16} color="#D32F2F" />
        <Text style={styles.cropName}>{item.cropName || 'Unknown crop'}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>HIGH</Text>
        </View>
      </View>
      <Text style={styles.notes} numberOfLines={2}>{item.notes}</Text>
      <Text style={styles.date}>{item.date}</Text>
    </TouchableOpacity>
  ), [navigation]);

  if (loading) return <LoadingState />;
  if (error)   return <ErrorState error={error} />;

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={alerts}
        keyExtractor={i => i.recordId}
        contentContainerStyle={styles.list}
        renderItem={renderItem}
        onEndReached={() => nextCursor && !loadingMore && fetchAlerts(nextCursor)}
        onEndReachedThreshold={0.4}
        removeClippedSubviews={Platform.OS === 'android'}
        ListEmptyComponent={<EmptyState message="No high-priority symptom alerts" />}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: COLORS.background },
  list:       { padding: SPACING.md },
  card:       {
    backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.md, padding: SPACING.md,
    marginBottom: SPACING.sm, borderLeftWidth: 3, borderLeftColor: '#D32F2F',
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  cropName:   { flex: 1, fontSize: 15, fontWeight: 'bold', color: COLORS.text },
  badge:      { backgroundColor: '#D32F2F' + '20', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeText:  { fontSize: 11, fontWeight: 'bold', color: '#D32F2F' },
  notes:      { fontSize: 13, color: COLORS.textSecondary, marginBottom: 6 },
  date:       { fontSize: 12, color: COLORS.textSecondary },
});
