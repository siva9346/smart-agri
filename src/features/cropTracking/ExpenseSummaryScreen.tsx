import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, BORDER_RADIUS } from '../../theme';
import { Card } from '../../components/Card';
import { GradientHero } from '../../components/GradientHero';
import { IndianRupee, PieChart, TrendingDown, ArrowRight } from 'lucide-react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';

export const ExpenseSummaryScreen = ({ route, navigation }: any) => {
  const { cropCycleId } = route.params;

  const cycle = useSelector((state: RootState) =>
    state.crop.cropCycles.find(cc => cc.id === cropCycleId)
  );
  const records = useSelector((state: RootState) =>
    state.crop.recordsByCycleId[cropCycleId] ?? []
  );

  const totalExpense = useMemo(
    () => records.reduce((sum, r) => sum + (r.expense || 0), 0),
    [records],
  );

  if (!cycle) return <View style={styles.container}><Text>Cycle not found</Text></View>;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <GradientHero title="Expense Summary" onBack={() => navigation.goBack()} compact />
      <ScrollView>

      <Card style={styles.summaryCard}>
          <View style={styles.cycleInfo}>
              <Text style={styles.cropName}>{cycle.cropName}</Text>
              <Text style={styles.startDate}>Started: {cycle.startDate}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.totalRow}>
              <View style={styles.iconCircle}>
                  <IndianRupee size={24} color={COLORS.primary} />
              </View>
              <View>
                  <Text style={styles.totalLabel}>Total Expense</Text>
                  <Text style={styles.totalValue}>₹{totalExpense.toLocaleString()}</Text>
              </View>
          </View>
      </Card>

      <View style={styles.actionSection}>
          <Text style={styles.sectionTitle}>Analytics</Text>

          <TouchableOpacity
              style={styles.actionCard}
              onPress={() => navigation.navigate('ExpenseBreakdown', { cropCycleId })}
          >
              <View style={[styles.actionIcon, { backgroundColor: '#E3F2FD' }]}>
                  <PieChart size={24} color="#1E88E5" />
              </View>
              <View style={styles.actionTextContent}>
                  <Text style={styles.actionTitle}>Cost Type Breakdown</Text>
                  <Text style={styles.actionSubtitle}>View how your money was spent</Text>
              </View>
              <ArrowRight size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard}>
              <View style={[styles.actionIcon, { backgroundColor: '#F3E5F5' }]}>
                  <TrendingDown size={24} color="#8E24AA" />
              </View>
              <View style={styles.actionTextContent}>
                  <Text style={styles.actionTitle}>Stage-wise Analysis</Text>
                  <Text style={styles.actionSubtitle}>Compare expenses across stages</Text>
              </View>
              <ArrowRight size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
      </View>

      <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Expert Tip 💡</Text>
          <Text style={styles.infoText}>
              Keep track of your fertilizer costs. Using organic alternatives can reduce your total expense by up to 20%.
          </Text>
      </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F7F3',
  },
  summaryCard: {
    margin: SPACING.md,
    padding: SPACING.lg,
    alignItems: 'center',
    backgroundColor: '#FBFCFB',
  },
  cycleInfo: {
      alignItems: 'center',
      marginBottom: SPACING.md,
  },
  cropName: {
      fontSize: 24,
      fontWeight: 'bold',
      color: COLORS.primary,
  },
  startDate: {
      fontSize: 14,
      color: COLORS.textSecondary,
      marginTop: 4,
  },
  divider: {
      width: '100%',
      height: 1,
      backgroundColor: COLORS.border,
      marginVertical: SPACING.lg,
  },
  totalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
  },
  iconCircle: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: '#E8F5E9',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: SPACING.md,
  },
  totalLabel: {
      fontSize: 16,
      color: COLORS.textSecondary,
  },
  totalValue: {
      fontSize: 28,
      fontWeight: 'bold',
      color: COLORS.text,
  },
  actionSection: {
      padding: SPACING.md,
  },
  sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: COLORS.text,
      marginBottom: SPACING.md,
  },
  actionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: COLORS.surface,
      padding: SPACING.md,
      borderRadius: BORDER_RADIUS.md,
      marginBottom: SPACING.md,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
  },
  actionIcon: {
      width: 48,
      height: 48,
      borderRadius: BORDER_RADIUS.md,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: SPACING.md,
  },
  actionTextContent: {
      flex: 1,
  },
  actionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: COLORS.text,
  },
  actionSubtitle: {
      fontSize: 12,
      color: COLORS.textSecondary,
  },
  infoBox: {
      margin: SPACING.md,
      padding: SPACING.lg,
      backgroundColor: '#FFF8E1',
      borderRadius: BORDER_RADIUS.md,
      borderLeftWidth: 4,
      borderLeftColor: '#FFD54F',
  },
  infoTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: '#F9A825',
      marginBottom: 4,
  },
  infoText: {
      fontSize: 14,
      color: '#616161',
      lineHeight: 20,
  }
});
