import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import { COLORS, SPACING, BORDER_RADIUS } from '../../theme';
import { api } from '../../services/api';
import { RootState, AppDispatch } from '../../store';
import { setLands } from '../../store/landSlice';
import { Card } from '../../components/Card';
import { LoadingState, EmptyState, ErrorState } from '../../components/States';
import { LayoutGrid, ShoppingCart, MessageSquare, CloudRain, ShieldCheck, Sprout, BookOpen } from 'lucide-react-native';

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
    { id: '1', title: 'Products',     icon: ShoppingCart, screen: 'FertilizerList' },
    { id: '2', title: 'History',      icon: LayoutGrid,   screen: 'PurchaseHistory' },
    { id: '3', title: 'Enquiry',      icon: MessageSquare, screen: 'Enquiry' },
    { id: '4', title: 'Symptoms',     icon: ShieldCheck,  screen: 'Symptoms' },
    { id: '5', title: 'Weather',      icon: CloudRain,    screen: 'RainUpdates' },
    { id: '6', title: 'Crop Track',   icon: Sprout,       screen: 'CropTrackingHome' },
    { id: '7', title: 'Expert Advice', icon: BookOpen,    screen: 'ExpertAdvice' },
  ];

  const renderHeader = () => (
    <View>
      <View style={styles.welcomeSection}>
        <Text style={styles.welcomeText}>Hello, {user?.name ?? 'Farmer'}!</Text>
        <Text style={styles.subtitleTitle}>
          விவசாய பயிர் கண்காணிப்பு மற்றும் உர ஊட்டல் செயலி{'\n'}
          Agriculture Crop Tracking and Fertilizer Feeding App
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.menuGrid}>
        {menuItems.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.menuItem}
            onPress={() => navigation.navigate(item.screen)}
          >
            <item.icon size={24} color={COLORS.primary} />
            <Text style={styles.menuText}>{item.title}</Text>
          </TouchableOpacity>
        ))}
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
            onPress={() => navigation.navigate('CropTrackingHome', { landId: item.landId, landName: item.name })}
          >
            <Card>
              <Text style={styles.landTitle}>{item.name}</Text>
              <Text style={styles.landDetail}>Area: {item.area} {item.areaUnit}</Text>
              <Text style={styles.landDetail}>Location: {item.village}</Text>
              {item.soilType ? <Text style={styles.landDetail}>Soil: {item.soilType}</Text> : null}
            </Card>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<EmptyState message="No lands registered yet. Tap '+ Add New' to add your first land." />}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  container: { padding: SPACING.md, backgroundColor: COLORS.background },
  welcomeSection: { marginBottom: SPACING.lg },
  welcomeText: { fontSize: 24, fontWeight: 'bold', color: COLORS.text },
  subtitleTitle: { fontSize: 14, color: COLORS.textSecondary, marginTop: SPACING.sm, lineHeight: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text, marginBottom: SPACING.md },
  menuGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: SPACING.xl },
  menuItem: {
    width: '30%', backgroundColor: COLORS.surface, padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md, alignItems: 'center', marginBottom: SPACING.md,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1,
    shadowRadius: 2, elevation: 2,
  },
  menuText: { fontSize: 12, marginTop: SPACING.xs, color: COLORS.text, fontWeight: '500' },
  landHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  addText: { color: COLORS.primary, fontWeight: 'bold' },
  landTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.primary, marginBottom: SPACING.xs },
  landDetail: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 2 },
});
