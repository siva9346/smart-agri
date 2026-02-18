import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, BORDER_RADIUS } from '../../theme';
import { mockRepository } from '../../repositories/MockRepository';
import { Land } from '../../types/domain';
import { Card } from '../../components/Card';
import { LoadingState, EmptyState, ErrorState } from '../../components/States';
import { LayoutGrid, ShoppingCart, MessageSquare, CloudRain, ShieldCheck } from 'lucide-react-native';

export const FarmerDashboard = ({ navigation }: any) => {
  const [lands, setLands] = useState<Land[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await mockRepository.getLands('1');
      if (response.success) {
        setLands(response.data);
      } else {
        setError(response.error);
      }
    } catch (err) {
      setError('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const menuItems = [
    { id: '1', title: 'Products', icon: ShoppingCart, screen: 'FertilizerList' },
    { id: '2', title: 'History', icon: LayoutGrid, screen: 'PurchaseHistory' },
    { id: '3', title: 'Enquiry', icon: MessageSquare, screen: 'Enquiry' },
    { id: '4', title: 'Symptoms', icon: ShieldCheck, screen: 'Symptoms' },
    { id: '5', title: 'Rain', icon: CloudRain, screen: 'RainUpdates' },
  ];

  const renderHeader = () => (
    <View>
      <View style={styles.welcomeSection}>
        <Text style={styles.welcomeText}>Hello, John Doe!</Text>
        <Text style={styles.subtitle}>Your Farm Overview</Text>
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
  if (error) return <ErrorState error={error} />;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <FlatList
        data={lands}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.container}
        ListHeaderComponent={renderHeader}
        refreshControl={<RefreshControl refreshing={Boolean(loading)} onRefresh={fetchData} />}
        renderItem={({ item }) => (
          <Card>
            <Text style={styles.landTitle}>{item.cropType}</Text>
            <Text style={styles.landDetail}>Area: {item.area}</Text>
            <Text style={styles.landDetail}>Location: {item.location}</Text>
          </Card>
        )}
        ListEmptyComponent={<EmptyState message="No lands registered yet" />}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    padding: SPACING.md,
    backgroundColor: COLORS.background,
  },
  welcomeSection: {
    marginBottom: SPACING.lg,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: SPACING.xl,
  },
  menuItem: {
    width: '30%',
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    marginBottom: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  menuText: {
    fontSize: 12,
    marginTop: SPACING.xs,
    color: COLORS.text,
    fontWeight: '500',
  },
  landHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  addText: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  landTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  landDetail: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
});
