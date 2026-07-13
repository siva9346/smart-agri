import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, BORDER_RADIUS } from '../../../theme';
import { MapPin, Phone, User, Layers, Sprout, ChevronRight, Clock } from 'lucide-react-native';
import { api } from '../../../services/api';
import { LoadingState, ErrorState } from '../../../components/States';

interface ApiFarmer {
  userId: string;
  name: string;
  phone: string;
  village?: string;
  district?: string;
  state?: string;
  pincode?: string;
  createdAt: string;
}

interface ApiLand {
  landId: string;
  name: string;
  area: number;
  areaUnit: string;
  village?: string;
  soilType?: string;
}

interface ApiCycle {
  cycleId: string;
  landId: string;
  cropName: string;
  status: string;
  startDate: string;
}

const getCropAge = (startDate: string): number => {
  const start = new Date(startDate);
  const today = new Date();
  start.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
};

export const CustomerDetailsScreen = ({ route, navigation }: any) => {
  const { customerId } = route.params;
  const [farmer,  setFarmer]  = useState<ApiFarmer | null>(null);
  const [lands,   setLands]   = useState<ApiLand[]>([]);
  const [activeCycleByLand, setActiveCycleByLand] = useState<Record<string, ApiCycle>>({});
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      setError(null);
      Promise.all([
        api.get<ApiFarmer>(`/farmers/${customerId}`),
        api.get<{ items: ApiLand[] }>(`/lands?farmerId=${customerId}`),
      ])
        .then(async ([farmerData, landsData]) => {
          setFarmer(farmerData);
          const landItems = landsData.items ?? [];
          setLands(landItems);

          const cycleResults = await Promise.all(
            landItems.map(land =>
              api.get<{ items: ApiCycle[] }>(`/crop-cycles?landId=${land.landId}`)
                .then(res => ({ landId: land.landId, cycles: res.items ?? [] }))
                .catch(() => ({ landId: land.landId, cycles: [] as ApiCycle[] }))
            )
          );
          const byLand: Record<string, ApiCycle> = {};
          for (const { landId, cycles } of cycleResults) {
            const active = cycles.find(c => c.status === 'ACTIVE');
            if (active) byLand[landId] = active;
          }
          setActiveCycleByLand(byLand);
        })
        .catch(err => setError(err?.message ?? 'Failed to load customer'))
        .finally(() => setLoading(false));
    }, [customerId])
  );

  if (loading) return <LoadingState />;
  if (error || !farmer) return <ErrorState error={error ?? 'Not found'} />;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Info</Text>
          <View style={styles.infoRow}>
            <User size={16} color={COLORS.textSecondary} />
            <Text style={styles.infoText}>{farmer.name}</Text>
          </View>
          <View style={styles.infoRow}>
            <Phone size={16} color={COLORS.textSecondary} />
            <Text style={styles.infoText}>{farmer.phone}</Text>
          </View>
          {farmer.village ? (
            <View style={styles.infoRow}>
              <MapPin size={16} color={COLORS.textSecondary} />
              <Text style={styles.infoText}>
                {farmer.village}{farmer.district ? `, ${farmer.district}` : ''}{farmer.state ? `, ${farmer.state}` : ''}
              </Text>
            </View>
          ) : null}
          {farmer.pincode ? (
            <Text style={[styles.infoText, { marginLeft: 24, marginBottom: 8 }]}>Pincode: {farmer.pincode}</Text>
          ) : null}
          <Text style={styles.meta}>Member since {farmer.createdAt.split('T')[0]}</Text>
        </View>

        <Text style={styles.landsHeader}>Lands ({lands.length})</Text>

        {lands.length > 0 ? lands.map((land, i) => {
          const activeCycle = activeCycleByLand[land.landId];
          return (
            <TouchableOpacity
              key={land.landId}
              style={styles.landCard}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('CropCycle', { landId: land.landId, landName: land.name || `Land ${i + 1}`, readOnly: true })}
            >
              <View style={styles.landHeader}>
                <Layers size={16} color={COLORS.primary} />
                <Text style={styles.landName}>{land.name || `Land ${i + 1}`}</Text>
                <View style={styles.areaBadge}>
                  <Text style={styles.areaText}>{land.area} {land.areaUnit}</Text>
                </View>
                <ChevronRight size={18} color={COLORS.textSecondary} />
              </View>
              {land.village ? <Text style={styles.landDetail}>Village: {land.village}</Text> : null}
              {land.soilType ? <Text style={styles.landDetail}>Soil: {land.soilType}</Text> : null}
              {activeCycle ? (
                <View style={styles.cycleRow}>
                  <Sprout size={14} color={COLORS.success} />
                  <Text style={styles.cycleText}>{activeCycle.cropName}</Text>
                  <View style={styles.ageChip}>
                    <Clock size={10} color={COLORS.primary} />
                    <Text style={styles.ageText}>{getCropAge(activeCycle.startDate)} days</Text>
                  </View>
                </View>
              ) : (
                <Text style={styles.noCycleText}>No active cultivation</Text>
              )}
            </TouchableOpacity>
          );
        }) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No lands registered</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: COLORS.background },
  container:    { padding: SPACING.lg },
  section:      { backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2 },
  sectionTitle: { fontSize: 13, fontWeight: 'bold', color: COLORS.textSecondary, textTransform: 'uppercase', marginBottom: SPACING.sm },
  infoRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  infoText:     { flex: 1, fontSize: 15, color: COLORS.text },
  meta:         { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
  landsHeader:  { fontSize: 16, fontWeight: 'bold', color: COLORS.text, marginBottom: SPACING.sm },
  landCard:     { backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2 },
  landHeader:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  landName:     { flex: 1, fontSize: 15, fontWeight: 'bold', color: COLORS.text },
  areaBadge:    { backgroundColor: '#E8F5E9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  areaText:     { fontSize: 12, fontWeight: 'bold', color: '#2E7D32' },
  landDetail:   { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  cycleRow:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  cycleText:    { flex: 1, fontSize: 13, fontWeight: '600', color: COLORS.text },
  ageChip:      { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#E8F5E9', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  ageText:      { fontSize: 11, fontWeight: '600', color: COLORS.primary },
  noCycleText:  { fontSize: 12, color: COLORS.textSecondary, fontStyle: 'italic', marginTop: 8 },
  emptyCard:    { backgroundColor: COLORS.surface, padding: SPACING.xl, borderRadius: BORDER_RADIUS.md, alignItems: 'center' },
  emptyText:    { color: COLORS.textSecondary, fontStyle: 'italic' },
});
