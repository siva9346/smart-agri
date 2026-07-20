import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, BORDER_RADIUS } from '../../../theme';
import { Thermometer, Trash2, Plus, Edit2 } from 'lucide-react-native';
import { api } from '../../../services/api';
import { LoadingState, EmptyState, ErrorState } from '../../../components/States';

interface ApiSymptom {
  symptomId: string;
  name: string;
  cropName: string;
  description: string;
  remedy: string;
  severity: string;
}

const SEVERITY_COLOR: Record<string, string> = { LOW: '#27ae60', MEDIUM: '#e67e22', HIGH: '#e74c3c' };

export const SymptomsListScreen = ({ navigation }: any) => {
  const [symptoms,    setSymptoms]    = useState<ApiSymptom[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [nextCursor,  setNextCursor]  = useState<string | undefined>();
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchSymptoms = useCallback(async (cursor?: string) => {
    if (cursor) setLoadingMore(true); else setLoading(true);
    try {
      const path = cursor ? `/symptoms?cursor=${cursor}` : '/symptoms';
      const res  = await api.get<{ items: ApiSymptom[]; nextCursor?: string }>(path);
      setSymptoms(prev => cursor ? [...prev, ...res.items] : res.items);
      setNextCursor(res.nextCursor);
      setError(null);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load symptoms');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { fetchSymptoms(); }, [fetchSymptoms]);

  const handleDelete = (symptomId: string) => {
    Alert.alert('Delete', 'Remove this symptom record?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/symptoms/${symptomId}`);
            setSymptoms(prev => prev.filter(s => s.symptomId !== symptomId));
          } catch (err: any) {
            Alert.alert('Error', err?.message ?? 'Failed to delete');
          }
        },
      },
    ]);
  };

  const renderItem = useCallback(({ item }: { item: ApiSymptom }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Thermometer size={18} color={SEVERITY_COLOR[item.severity] ?? '#666'} />
        <Text style={styles.name}>{item.name}</Text>
        <View style={[styles.badge, { backgroundColor: (SEVERITY_COLOR[item.severity] ?? '#666') + '20' }]}>
          <Text style={[styles.badgeText, { color: SEVERITY_COLOR[item.severity] ?? '#666' }]}>{item.severity}</Text>
        </View>
      </View>
      <Text style={styles.cropName}>Crop: {item.cropName}</Text>
      {item.description ? <Text style={styles.desc}>{item.description}</Text> : null}
      {item.remedy ? <Text style={styles.remedy}>Remedy: {item.remedy}</Text> : null}
      <View style={styles.actions}>
        <TouchableOpacity onPress={() => navigation.navigate('EditSymptom', { symptom: item })} style={styles.editBtn}>
          <Edit2 size={16} color={COLORS.primary} />
          <Text style={styles.editText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDelete(item.symptomId)}>
          <Trash2 size={18} color="#e74c3c" />
        </TouchableOpacity>
      </View>
    </View>
  ), [navigation]);

  if (loading) return <LoadingState />;
  if (error)   return <ErrorState error={error} />;

  return (
    <SafeAreaView style={styles.safe}>
      <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('AddSymptom', { onAdded: fetchSymptoms })}>
        <Plus size={20} color="#fff" />
        <Text style={styles.addBtnText}>Add Symptom</Text>
      </TouchableOpacity>
      <FlatList
        data={symptoms}
        keyExtractor={i => i.symptomId}
        contentContainerStyle={styles.list}
        renderItem={renderItem}
        onEndReached={() => nextCursor && !loadingMore && fetchSymptoms(nextCursor)}
        onEndReachedThreshold={0.4}
        removeClippedSubviews={Platform.OS === 'android'}
        ListEmptyComponent={<EmptyState message="No symptom records yet" />}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: COLORS.background },
  addBtn:     { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, margin: SPACING.md, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, justifyContent: 'center', gap: 8 },
  addBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  list:       { paddingHorizontal: SPACING.md, paddingBottom: SPACING.md },
  card:       { backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 },
  name:       { flex: 1, fontSize: 15, fontWeight: 'bold', color: COLORS.text },
  badge:      { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeText:  { fontSize: 11, fontWeight: 'bold' },
  cropName:   { fontSize: 13, color: COLORS.primary, fontWeight: '500', marginBottom: 4 },
  desc:       { fontSize: 13, color: COLORS.textSecondary, marginBottom: 4 },
  remedy:     { fontSize: 13, color: '#27ae60', marginBottom: 8 },
  actions:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 8, marginTop: 4 },
  editBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editText:   { fontSize: 13, color: COLORS.primary, fontWeight: '500' },
});
