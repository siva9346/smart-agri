import React, { useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, BORDER_RADIUS } from '../../theme';
import { Card } from '../../components/Card';
import { MapPin, TrendingUp, Calendar } from 'lucide-react-native';
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
  cropAge:   0,
  status:    (c.status === 'COMPLETED' ? 'completed' : 'active') as 'active' | 'completed' | 'current',
});

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

  if (lands.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading lands…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Farm Lands</Text>
      <FlatList
        data={lands}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => navigation.navigate('CropCycle', { landId: item.id, landName: item.village })}
            activeOpacity={0.8}
          >
            <Card style={styles.card}>
              <View style={styles.header}>
                <View>
                  <Text style={styles.landVillage}>{item.village}</Text>
                  <View style={styles.locationRow}>
                    <MapPin size={12} color={COLORS.textSecondary} />
                    <Text style={styles.farmerName}>{item.farmerName}</Text>
                  </View>
                </View>
                <View style={styles.sizeBadge}>
                  <Text style={styles.sizeText}>{item.size}</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <View style={[styles.statIcon, { backgroundColor: COLORS.primary + '15' }]}>
                    <TrendingUp size={16} color={COLORS.primary} />
                  </View>
                  <View style={styles.statTexts}>
                    <Text style={styles.statLabel}>Current Crop</Text>
                    <Text style={styles.statValue}>
                      {cropCycles.find(cc => cc.landId === item.id && (cc.status === 'current' || cc.status === 'active'))?.cropName || 'No Crop'}
                    </Text>
                  </View>
                </View>
                <View style={styles.stat}>
                  <View style={[styles.statIcon, { backgroundColor: COLORS.secondary + '15' }]}>
                    <Calendar size={16} color={COLORS.secondary} />
                  </View>
                  <View style={styles.statTexts}>
                    <Text style={styles.statLabel}>Age</Text>
                    <Text style={styles.statValue}>
                      {cropCycles.find(cc => cc.landId === item.id && (cc.status === 'current' || cc.status === 'active'))?.cropAge || 0} Days
                    </Text>
                  </View>
                </View>
              </View>
            </Card>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.background, padding: SPACING.md },
  centered:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: COLORS.textSecondary },
  title:       { fontSize: 22, fontWeight: 'bold', color: COLORS.text, marginBottom: SPACING.lg },
  list:        { paddingBottom: SPACING.xl },
  card:        { marginBottom: SPACING.md, padding: SPACING.lg, borderRadius: 16, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10 },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  landVillage: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  farmerName:  { fontSize: 13, color: COLORS.textSecondary, marginLeft: 4 },
  sizeBadge:   { backgroundColor: '#E8F5E9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: '#C8E6C9' },
  sizeText:    { fontSize: 11, color: COLORS.primary, fontWeight: 'bold' },
  divider:     { height: 1, backgroundColor: '#F0F0F0', marginVertical: SPACING.lg },
  statsRow:    { flexDirection: 'row', justifyContent: 'space-between' },
  stat:        { flexDirection: 'row', alignItems: 'center', flex: 1 },
  statIcon:    { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  statTexts:   { flex: 1 },
  statLabel:   { fontSize: 11, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue:   { fontSize: 16, fontWeight: 'bold', color: '#333', marginTop: 1 },
});
