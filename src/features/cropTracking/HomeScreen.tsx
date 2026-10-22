import React, { useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING } from '../../theme';
import { GlassCard } from '../../components/GlassCard';
import { GradientHero } from '../../components/GradientHero';
import { EmptyState } from '../../components/States';
import { MapPin, TrendingUp, Calendar, ChevronRight } from 'lucide-react-native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { setCropCycles } from '../../store/cropSlice';
import { api } from '../../services/api';

const adaptCycle = (c: any) => ({
  id:        c.cycleId,
  landId:    c.landId,
  cropName:  c.cropName,
  startDate: c.startDate,
  endDate:   c.endDate || undefined,
  area:      c.area || undefined,
  status:    (c.status === 'COMPLETED' ? 'completed' : 'active') as 'active' | 'completed' | 'current',
});

const getCropAge = (startDate: string): number => {
  const start = new Date(startDate);
  const today = new Date();
  start.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
};

export const CropTrackingHomeScreen = ({ navigation }: any) => {
  const dispatch   = useDispatch<AppDispatch>();
  const lands      = useSelector((state: RootState) => state.land.lands);
  const cropCycles = useSelector((state: RootState) => state.crop.cropCycles);

  const loadCycles = useCallback(async () => {
    if (lands.length === 0) return;
    try {
      const allItems = await Promise.all(
        lands.map(land =>
          api.get<{ items: any[] }>(`/crop-cycles?landId=${land.id}`)
            .then(res => res.items)
            .catch(() => [])
        )
      );
      dispatch(setCropCycles(allItems.flat().map(adaptCycle)));
    } catch { /* non-critical */ }
  }, [lands, dispatch]);

  useFocusEffect(useCallback(() => { loadCycles(); }, [loadCycles]));

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <GradientHero title="My Farm Lands" subtitle="Tap a land to view its cultivation" onBack={() => navigation.goBack()} compact />

      {lands.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading lands…</Text>
        </View>
      ) : (
        <FlatList
          data={lands}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<EmptyState message="No lands registered yet." />}
          renderItem={({ item }) => {
            const current = cropCycles.find(cc => cc.landId === item.id && (cc.status === 'current' || cc.status === 'active'));
            return (
              <GlassCard onPress={() => navigation.navigate('CropCycle', { landId: item.id, landName: item.village })} style={styles.card}>
                <View style={styles.header}>
                  <View style={styles.headerLeft}>
                    <Text style={styles.landVillage}>{item.village}</Text>
                    <View style={styles.locationRow}>
                      <MapPin size={12} color={COLORS.textSecondary} />
                      <Text style={styles.farmerName}>{item.farmerName}</Text>
                    </View>
                  </View>
                  <View style={styles.sizeBadge}>
                    <Text style={styles.sizeText}>{item.size}</Text>
                  </View>
                  <ChevronRight size={18} color={COLORS.textSecondary} />
                </View>

                <View style={styles.divider} />

                <View style={styles.statsRow}>
                  <View style={styles.stat}>
                    <View style={[styles.statIcon, { backgroundColor: COLORS.primary + '15' }]}>
                      <TrendingUp size={16} color={COLORS.primary} />
                    </View>
                    <View style={styles.statTexts}>
                      <Text style={styles.statLabel}>Current Crop</Text>
                      <Text style={styles.statValue}>{current?.cropName || 'No Crop'}</Text>
                    </View>
                  </View>
                  <View style={styles.stat}>
                    <View style={[styles.statIcon, { backgroundColor: COLORS.secondary + '15' }]}>
                      <Calendar size={16} color={COLORS.secondary} />
                    </View>
                    <View style={styles.statTexts}>
                      <Text style={styles.statLabel}>Age</Text>
                      <Text style={styles.statValue}>{current ? getCropAge(current.startDate) : 0} Days</Text>
                    </View>
                  </View>
                </View>
              </GlassCard>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: '#F2F7F3' },
  centered:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: COLORS.textSecondary },
  list:        { padding: SPACING.md, paddingBottom: SPACING.xl },
  card:        { padding: SPACING.lg, marginBottom: SPACING.md },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  headerLeft:  { flex: 1 },
  landVillage: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  farmerName:  { fontSize: 13, color: COLORS.textSecondary, marginLeft: 4 },
  sizeBadge:   { backgroundColor: '#E8F5E9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: '#C8E6C9' },
  sizeText:    { fontSize: 11, color: COLORS.primary, fontWeight: 'bold' },
  divider:     { height: 1, backgroundColor: 'rgba(0,0,0,0.06)', marginVertical: SPACING.md },
  statsRow:    { flexDirection: 'row', justifyContent: 'space-between' },
  stat:        { flexDirection: 'row', alignItems: 'center', flex: 1 },
  statIcon:    { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  statTexts:   { flex: 1 },
  statLabel:   { fontSize: 11, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue:   { fontSize: 16, fontWeight: 'bold', color: '#333', marginTop: 1 },
});
