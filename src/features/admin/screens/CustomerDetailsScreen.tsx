import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, BORDER_RADIUS } from '../../../theme';
import { MapPin, Phone, User, Layers } from 'lucide-react-native';
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

export const CustomerDetailsScreen = ({ route }: any) => {
  const { customerId } = route.params;
  const [farmer,  setFarmer]  = useState<ApiFarmer | null>(null);
  const [lands,   setLands]   = useState<ApiLand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<ApiFarmer>(`/farmers/${customerId}`),
      api.get<{ items: ApiLand[] }>(`/lands?farmerId=${customerId}`),
    ])
      .then(([farmerData, landsData]) => {
        setFarmer(farmerData);
        setLands(landsData.items ?? []);
      })
      .catch(err => setError(err?.message ?? 'Failed to load customer'))
      .finally(() => setLoading(false));
  }, [customerId]);

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

        {lands.length > 0 ? lands.map((land, i) => (
          <View key={land.landId} style={styles.landCard}>
            <View style={styles.landHeader}>
              <Layers size={16} color={COLORS.primary} />
              <Text style={styles.landName}>{land.name || `Land ${i + 1}`}</Text>
              <View style={styles.areaBadge}>
                <Text style={styles.areaText}>{land.area} {land.areaUnit}</Text>
              </View>
            </View>
            {land.village ? <Text style={styles.landDetail}>Village: {land.village}</Text> : null}
            {land.soilType ? <Text style={styles.landDetail}>Soil: {land.soilType}</Text> : null}
          </View>
        )) : (
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
  emptyCard:    { backgroundColor: COLORS.surface, padding: SPACING.xl, borderRadius: BORDER_RADIUS.md, alignItems: 'center' },
  emptyText:    { color: COLORS.textSecondary, fontStyle: 'italic' },
});
