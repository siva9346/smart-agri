import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, RefreshControl, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, BORDER_RADIUS } from '../../theme';
import { mockRepository } from '../../repositories/MockRepository';
import { User, Enquiry } from '../../types/domain';
import { Card } from '../../components/Card';
import { LoadingState, EmptyState, ErrorState } from '../../components/States';
import { Users, Package, Settings, MessageSquare, CloudRain, Thermometer } from 'lucide-react-native';

export const AdminDashboard = ({ navigation }: any) => {
  const [customers, setCustomers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await mockRepository.getCustomers();
      if (response.success) {
        setCustomers(response.data);
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

  const adminActions = [
    { title: 'Add Customer', icon: Users, screen: 'AddCustomer' },
    { title: 'Stock Update', icon: Package, screen: 'ManageStock' },
    { title: 'Price Update', icon: Settings, screen: 'ManagePrice' },
    { title: 'Enquiries', icon: MessageSquare, screen: 'ViewEnquiries' },
    { title: 'Weather/Rain', icon: CloudRain, screen: 'UpdateRain' },
    { title: 'Symptoms', icon: Thermometer, screen: 'UpdateSymptoms' },
  ];

  const renderHeader = () => (
    <View>
      <View style={styles.welcomeSection}>
        <Text style={styles.welcomeText}>Admin Panel</Text>
        <Text style={styles.subtitle}>Management Dashboard</Text>
      </View>

      <Text style={styles.sectionTitle}>Management Tools</Text>
      <View style={styles.actionGrid}>
        {adminActions.map((action, index) => (
          <TouchableOpacity 
            key={index} 
            style={styles.actionItem}
            onPress={() => navigation.navigate(action.screen, { title: action.title })}
          >
            <action.icon size={24} color={COLORS.secondary} />
            <Text style={styles.actionText}>{action.title}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Recent Customers</Text>
    </View>
  );

  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <FlatList
        data={customers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.container}
        ListHeaderComponent={renderHeader}
        refreshControl={<RefreshControl refreshing={Boolean(loading)} onRefresh={fetchData} />}
        renderItem={({ item }) => (
          <Card onPress={() => navigation.navigate('CustomerDetails', { customerId: item.id })}>
            <View style={styles.customerRow}>
              <View>
                <Text style={styles.customerName}>{item.name}</Text>
                <Text style={styles.customerPhone}>{item.phone}</Text>
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.role}</Text>
              </View>
            </View>
          </Card>
        )}
        ListEmptyComponent={<EmptyState message="No customers found" />}
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
    marginTop: SPACING.sm,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  actionItem: {
    width: '48%',
    backgroundColor: COLORS.surface,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.secondary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  actionText: {
    fontSize: 14,
    marginLeft: SPACING.sm,
    color: COLORS.text,
    fontWeight: 'bold',
  },
  customerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  customerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  customerPhone: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  badge: {
    backgroundColor: COLORS.primary + '20',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  badgeText: {
    fontSize: 10,
    color: COLORS.primary,
    fontWeight: 'bold',
  }
});
