import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import { MapPin, ChevronRight } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS } from '../../theme';
import { api } from '../../services/api';
import { RootState, AppDispatch } from '../../store';
import { setLands } from '../../store/landSlice';
import { LoadingState, EmptyState, ErrorState } from '../../components/States';
import { CustomerHubCard } from '../dashboard/CustomerHubCard';
import { NotificationBanner } from '../notifications/NotificationBanner';
import { Truck, CloudRain, ShieldCheck, Sprout, BookOpen, PawPrint, MessageSquare } from 'lucide-react-native';

interface ApiLand {
  landId: string;
  name: string;
  area: string;
  areaUnit: string;
  village: string;
  soilType: string;
}

export const FarmerDashboard = ({ navigation }: any) => {
  const user    = useSelector((state: RootState) => state.auth.user);
  const dispatch = useDispatch<AppDispatch>();
  const [apiLands, setApiLands] = useState<ApiLand[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  const fetchLands = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ items: ApiLand[] }>(`/lands?farmerId=${user.userId}`);
      setApiLands(res.items);
      // Populate Redux so CropTrackingHomeScreen can read lands
      dispatch(setLands(res.items.map(l => ({
        id:           l.landId,
        customerId:   user.userId,
        village:      l.name,               // land name shown as primary title
        farmerName:   l.village || '',       // actual village shown as sub-label
        size:         l.area != null ? `${l.area} ${l.areaUnit || 'acres'}` : '',
        soil:         l.soilType || '',
      }))));
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load lands');
    } finally {
      setLoading(false);
    }
  }, [user, dispatch]);

  useFocusEffect(useCallback(() => { fetchLands(); }, [fetchLands]));

  const menuItems = [
    { id: '1', title: 'Crop Track',    icon: Sprout,      screen: 'CropTrackingHome' },
    { id: '2', title: 'Livestock Track', icon: PawPrint,  screen: null },
    { id: '3', title: 'Weather',       icon: CloudRain,   screen: 'RainUpdates' },
    { id: '4', title: 'Expert Advice', icon: BookOpen,    screen: 'ExpertAdvice' },
    { id: '5', title: 'Symptoms (AI)', icon: ShieldCheck, screen: 'CropTrackingHome' },
    { id: '6', title: 'Order Track',   icon: Truck,       screen: 'PurchaseHistory' },
    { id: '7', title: 'Enquiry',       icon: MessageSquare, screen: 'Enquiry' },
  ];

  const renderHeader = () => (
    <View>
      {/* Header */}
      <View style={styles.hero}>
        <Text style={styles.heroGreeting}>Hello, {user?.name ?? 'Farmer'}</Text>
        <Text style={styles.heroSubtitle}>
          விவசாய பயிர் கண்காணிப்பு மற்றும் உர ஊட்டல் செயலி{'\n'}
          Agriculture Crop Tracking and Fertilizer Feeding App
        </Text>
      </View>

      <NotificationBanner />

      {/* Expert help, consultations, quotations, AI */}
      <CustomerHubCard navigation={navigation} />

      {/* Quick Actions */}
      <View style={styles.quickActionsWrap}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.menuGrid}>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.7}
              style={styles.menuItem}
              onPress={() => item.screen
                ? navigation.navigate(item.screen)
                : Alert.alert('Coming Soon', `${item.title} is on its way — stay tuned!`)
              }
            >
              <View style={styles.menuIconBadge}>
                <item.icon size={19} color={COLORS.primary} />
              </View>
              <Text style={styles.menuText}>{item.title}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.landHeader}>
        <Text style={styles.sectionTitle}>My Lands</Text>
        <TouchableOpacity onPress={() => navigation.navigate('AddLand')}>
          <Text style={styles.addText}>+ Add New</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) return <LoadingState />;
  if (error)   return <ErrorState error={error} />;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <FlatList
        data={apiLands}
        keyExtractor={(item) => item.landId}
        contentContainerStyle={styles.container}
        ListHeaderComponent={renderHeader}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchLands} />}
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => navigation.navigate('CropTrackingHome', { landId: item.landId, landName: item.name })}
          >
            <View style={styles.landCard}>
              <View style={styles.landCardTop}>
                <Text style={styles.landTitle}>{item.name}</Text>
                <ChevronRight size={18} color={COLORS.textSecondary} />
              </View>
              <View style={styles.landRow}>
                <MapPin size={13} color={COLORS.textSecondary} />
                <Text style={styles.landDetail}>{item.village}</Text>
              </View>
              <View style={styles.landMetaRow}>
                <View style={styles.landPill}>
                  <Text style={styles.landPillText}>{item.area} {item.areaUnit}</Text>
                </View>
                {!!item.soilType && (
                  <View style={styles.landPill}>
                    <Text style={styles.landPillText}>{item.soilType}</Text>
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<EmptyState message="No lands registered yet. Tap '+ Add New' to add your first land." />}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  container: { paddingBottom: SPACING.xl, backgroundColor: COLORS.background },

  // Header
  hero: {
    paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg, paddingBottom: SPACING.lg,
    backgroundColor: COLORS.primary,
  },
  heroGreeting: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.3 },
  heroSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: SPACING.xs, lineHeight: 19 },

  // Quick Actions
  quickActionsWrap: { paddingHorizontal: SPACING.md, paddingTop: SPACING.lg, marginBottom: SPACING.sm },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.primary, marginBottom: SPACING.md },
  menuGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  menuItem: {
    width: '31%', marginBottom: SPACING.md, paddingVertical: SPACING.md, alignItems: 'center',
    backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: COLORS.primary + '20',
  },
  menuIconBadge: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primary + '12',
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  menuText: { fontSize: 11.5, color: COLORS.text, fontWeight: '600', textAlign: 'center', paddingHorizontal: 4 },

  // My Lands
  landHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.md, marginBottom: SPACING.sm, marginTop: SPACING.sm,
  },
  addText: { color: COLORS.primary, fontWeight: '700', fontSize: 13.5 },
  landCard: {
    marginHorizontal: SPACING.md, marginBottom: SPACING.sm, padding: SPACING.lg,
    backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: COLORS.primary + '20',
  },
  landCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  landTitle: { fontSize: 16, fontWeight: '700', color: COLORS.primary },
  landRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: SPACING.sm },
  landDetail: { fontSize: 13, color: COLORS.textSecondary },
  landMetaRow: { flexDirection: 'row', gap: 8 },
  landPill: { backgroundColor: COLORS.primary + '12', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  landPillText: { fontSize: 11.5, fontWeight: '600', color: COLORS.primary },
});
