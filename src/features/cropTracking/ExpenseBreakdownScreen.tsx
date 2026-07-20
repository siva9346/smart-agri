import React, { useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { COLORS, SPACING } from '../../theme';
import { PieChart, ArrowLeft, TrendingUp } from 'lucide-react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';

const COLORS_LIST = ['#4CAF50', '#2196F3', '#FFC107', '#E91E63', '#9C27B0', '#00BCD4', '#FF9800', '#795548'];
const getColor = (index: number) => COLORS_LIST[index % COLORS_LIST.length];

export const ExpenseBreakdownScreen = ({ route, navigation }: any) => {
  const { cropCycleId } = route.params;

  const cycle = useSelector((state: RootState) =>
    state.crop.cropCycles.find(cc => cc.id === cropCycleId)
  );
  const records = useSelector((state: RootState) =>
    state.crop.recordsByCycleId[cropCycleId] ?? []
  );

  const { breakdown, total } = useMemo(() => {
    const b: Record<string, number> = {};
    for (const r of records) {
      const key = r.costType || 'Other';
      b[key] = (b[key] || 0) + r.expense;
    }
    return { breakdown: b, total: Object.values(b).reduce((s, v) => s + v, 0) };
  }, [records]);

  const data = Object.entries(breakdown).map(([type, amount], index) => ({
    id: index.toString(),
    type,
    amount,
    percentage: total > 0 ? ((amount / total) * 100).toFixed(1) : '0.0',
    color: getColor(index),
  })).sort((a, b) => b.amount - a.amount);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
              <ArrowLeft size={22} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Cost Breakdown</Text>
      </View>

      <View style={styles.chartSection}>
          <View style={styles.chartContainer}>
              <PieChart size={120} color={COLORS.primary} strokeWidth={2} />
              <View style={styles.chartOverlay}>
                  <Text style={styles.totalValue}>₹{total.toLocaleString()}</Text>
                  <Text style={styles.totalLabel}>Total</Text>
              </View>
          </View>
          <Text style={styles.cropName}>{cycle?.cropName} Expenses</Text>
      </View>

      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.listItem}>
            <View style={[styles.colorIndicator, { backgroundColor: item.color }]} />
            <Text style={styles.typeText}>{item.type}</Text>
            <View style={styles.valueRow}>
                <Text style={styles.amountText}>₹{item.amount.toLocaleString()}</Text>
                <View style={styles.percentageBadge}>
                    <Text style={styles.percentageText}>{item.percentage}%</Text>
                </View>
            </View>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={<Text style={styles.emptyText}>No expense records yet.</Text>}
      />

      <View style={styles.summaryFooter}>
          <TrendingUp size={20} color={COLORS.primary} />
          <Text style={styles.footerText}>Breakdown based on {data.length} categories</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: '#E8EDF2',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
    letterSpacing: 0.2,
  },
  chartSection: {
      alignItems: 'center',
      paddingVertical: SPACING.xl,
      backgroundColor: COLORS.surface,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
  },
  chartContainer: {
      position: 'relative',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: SPACING.md,
  },
  chartOverlay: {
      position: 'absolute',
      justifyContent: 'center',
      alignItems: 'center',
  },
  totalValue: {
      fontSize: 20,
      fontWeight: 'bold',
      color: COLORS.text,
  },
  totalLabel: {
      fontSize: 12,
      color: COLORS.textSecondary,
  },
  cropName: {
      fontSize: 18,
      fontWeight: '600',
      color: COLORS.primary,
  },
  list: {
      padding: SPACING.md,
  },
  listItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: SPACING.md,
  },
  colorIndicator: {
      width: 12,
      height: 12,
      borderRadius: 6,
      marginRight: SPACING.md,
  },
  typeText: {
      flex: 1,
      fontSize: 16,
      color: COLORS.text,
  },
  valueRow: {
      flexDirection: 'row',
      alignItems: 'center',
  },
  amountText: {
      fontSize: 16,
      fontWeight: '600',
      color: COLORS.text,
      marginRight: 8,
  },
  percentageBadge: {
      backgroundColor: '#E8F5E9',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
  },
  percentageText: {
      fontSize: 10,
      fontWeight: 'bold',
      color: COLORS.primary,
  },
  separator: {
      height: 1,
      backgroundColor: COLORS.border,
  },
  emptyText: {
      textAlign: 'center',
      color: COLORS.textSecondary,
      paddingVertical: 32,
  },
  summaryFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: SPACING.lg,
      backgroundColor: COLORS.surface,
  },
  footerText: {
      fontSize: 14,
      color: COLORS.textSecondary,
      marginLeft: 8,
  }
});
