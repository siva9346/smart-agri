import React, { useMemo, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Platform, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, BORDER_RADIUS } from '../../theme';
import { Calendar, Activity, FileText, ImageIcon, Lightbulb, Plus, ChevronRight } from 'lucide-react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { GradientHero } from '../../components/GradientHero';
import { GlassCard } from '../../components/GlassCard';

// ─── Enum-to-display-label map for uppercase expense categories ───────────────

export const ENUM_LABEL: Record<string, string> = {
  PLOUGHING:  'Ploughing',
  SEED:       'Seed',
  LABOUR:     'Labour',
  WEEDING:    'Weeding',
  FERTILIZER: 'Fertilizer',
  PESTICIDE:  'Pesticide',
  IRRIGATION: 'Irrigation',
  TRANSPORT:  'Transport',
  HARVESTING: 'Harvesting',
  OTHER:      'Others',
};

// ─── Color / background maps — both display names and uppercase enums ─────────

export const ACTIVITY_COLOR: Record<string, string> = {
  // Activity types (display names)
  'Expense':            '#2E7D32',
  'Weekly Condition':   '#0097A7',
  'Symptom':            '#AD1457',
  'Enquiry':            '#7B1FA2',
  'Advice Received':    '#1565C0',
  'Fertilizer Applied': '#388E3C',
  'Irrigation':         '#006064',
  'Labour Work':        '#E65100',
  'Harvest / Income':   '#1B7F3E',
  'Harvest':            '#F57F17',
  'Growth Update':      '#00897B',
  'Admin Advice':       '#5E35B1',
  'Other':              '#757575',
  // Expense category enums (uppercase)
  PLOUGHING:            '#5D4037',
  SEED:                 '#00695C',
  LABOUR:               '#E65100',
  WEEDING:              '#558B2F',
  FERTILIZER:           '#388E3C',
  PESTICIDE:            '#C62828',
  IRRIGATION:           '#006064',
  TRANSPORT:            '#455A64',
  HARVESTING:           '#F57F17',
  OTHER:                '#757575',
  // Legacy title-case values (backward compatibility)
  'Ploughing':          '#5D4037',
  'Seed':               '#00695C',
  'Labour':             '#E65100',
  'Weeding':            '#558B2F',
  'Fertilizer':         '#388E3C',
  'Pesticide':          '#C62828',
  'Transport':          '#455A64',
  'Harvesting':         '#F57F17',
  'Others':             '#757575',
};

export const ACTIVITY_BG: Record<string, string> = {
  // Activity types (display names)
  'Expense':            '#E8F5E9',
  'Weekly Condition':   '#E0F7FA',
  'Symptom':            '#FCE4EC',
  'Enquiry':            '#F3E5F5',
  'Advice Received':    '#E3F2FD',
  'Fertilizer Applied': '#E8F5E9',
  'Irrigation':         '#E0F2F1',
  'Labour Work':        '#FBE9E7',
  'Harvest / Income':   '#D4EDDA',
  'Harvest':            '#FFFDE7',
  'Growth Update':      '#E0F2F1',
  'Admin Advice':       '#EDE7F6',
  'Other':              '#F5F5F5',
  // Expense category enums (uppercase)
  PLOUGHING:            '#EFEBE9',
  SEED:                 '#E0F2F1',
  LABOUR:               '#FBE9E7',
  WEEDING:              '#F1F8E9',
  FERTILIZER:           '#E8F5E9',
  PESTICIDE:            '#FFEBEE',
  IRRIGATION:           '#E0F2F1',
  TRANSPORT:            '#ECEFF1',
  HARVESTING:           '#FFFDE7',
  OTHER:                '#F5F5F5',
  // Legacy title-case (backward compatibility)
  'Ploughing':          '#EFEBE9',
  'Seed':               '#E0F2F1',
  'Labour':             '#FBE9E7',
  'Weeding':            '#F1F8E9',
  'Fertilizer':         '#E8F5E9',
  'Pesticide':          '#FFEBEE',
  'Transport':          '#ECEFF1',
  'Harvesting':         '#FFFDE7',
  'Others':             '#F5F5F5',
};

// Activities where no financial amount is shown
const OBSERVATION_TYPES = new Set([
  'Weekly Condition', 'Symptom', 'Enquiry', 'Advice Received', 'Growth Update', 'Admin Advice', 'Other',
]);

export const isHarvest = (item: any): boolean =>
  item.activityType === 'Harvest / Income' || item.costType === 'Harvest / Income';

// For Expense records, use the sub-category color; for others, use activityType color
export const getColor = (item: any): string => {
  if (item.activityType === 'Expense' && item.costType) {
    return ACTIVITY_COLOR[item.costType] ?? ACTIVITY_COLOR['Expense'] ?? COLORS.primary;
  }
  return ACTIVITY_COLOR[item.activityType] ?? ACTIVITY_COLOR[item.costType] ?? COLORS.primary;
};

export const getBg = (item: any): string => {
  if (item.activityType === 'Expense' && item.costType) {
    return ACTIVITY_BG[item.costType] ?? ACTIVITY_BG['Expense'] ?? '#F5F5F5';
  }
  return ACTIVITY_BG[item.activityType] ?? ACTIVITY_BG[item.costType] ?? '#F5F5F5';
};

// Show human-readable label; decode uppercase enums for expense sub-types
export const getLabel = (item: any): string => {
  if (item.activityType === 'Expense' && item.costType) {
    return ENUM_LABEL[item.costType] ?? item.costType;
  }
  if (item.activityType === 'Growth Update' && item.stage) {
    return item.stage;
  }
  return item.activityType || (ENUM_LABEL[item.costType] ?? item.costType) || item.stage || 'Activity';
};

const PRIORITY_COLOR: Record<string, string> = { LOW: '#388E3C', MEDIUM: '#F57C00', HIGH: '#D32F2F' };

export const isObservation = (item: any): boolean =>
  OBSERVATION_TYPES.has(item.activityType) || OBSERVATION_TYPES.has(item.costType);

// ─── Component ───────────────────────────────────────────────────────────────

export const CropTrackingScreen = ({ route, navigation }: any) => {
  const { cropCycleId, cropName, readOnly } = route.params || {};

  const recordsByCycleId = useSelector((state: RootState) => state.crop.recordsByCycleId);

  // O(1) lookup from index; sort memoised — only recomputes when this cycle's data changes
  const records = useMemo(
    () => [...(recordsByCycleId[cropCycleId] ?? [])].sort((a, b) => a.date.localeCompare(b.date)),
    [recordsByCycleId, cropCycleId],
  );

  // All derived financials in one memoised pass over the cycle's records
  const { totalExpense, totalIncome, netPL, suggestions } = useMemo(() => {
    let exp = 0, inc = 0, fertCost = 0, labourCost = 0;
    const symptomList: any[] = [];
    for (const r of records) {
      if (isHarvest(r)) {
        inc += r.incomeAmount ?? 0;
      } else if (!isObservation(r)) {
        exp += r.expense;
      }
      if (r.activityType === 'Fertilizer Applied' || r.costType === 'Fertilizer') fertCost += r.expense;
      if (r.activityType === 'Labour Work' || r.costType === 'LABOUR' || r.costType === 'Labour') labourCost += r.expense;
      if (r.activityType === 'Symptom' || r.costType === 'Symptom') symptomList.push(r);
    }
    const tips: string[] = [];
    if (fertCost > 5000) tips.push('Fertilizer cost is high. Consider Nano-Urea to reduce chemical expenditure.');
    if (labourCost > 10000) tips.push('High labour cost. Consider mechanical weeding to reduce manual work.');
    if (symptomList.length > 1) tips.push(`${symptomList.length} symptoms recorded. Monitor closely and consult an expert if spreading.`);
    return { totalExpense: exp, totalIncome: inc, netPL: inc - exp, suggestions: tips };
  }, [records]);

  const renderItem = useCallback(({ item, index }: { item: any; index: number }) => {
    const color = getColor(item);
    const bg = getBg(item);
    const label = getLabel(item);
    const isLast = index === records.length - 1;
    const isObs = isObservation(item);
    const harv = isHarvest(item);
    const isAdvice = item.activityType === 'Admin Advice';
    const showExpense = item.expense > 0 && !isObs && !harv;
    const showIncomeAmt = harv && (item.incomeAmount ?? 0) > 0;
    const hasDetails = !!item.notes || showExpense || showIncomeAmt;

    return (
      <View style={styles.timelineRow}>
        {/* Spine */}
        <View style={styles.spine}>
          <View style={[styles.dotRing, { borderColor: color + '30' }]}>
            <View style={[styles.dot, { backgroundColor: color }]} />
          </View>
          {!isLast && <View style={[styles.line, { backgroundColor: color + '30' }]} />}
        </View>

        {/* Card */}
        <GlassCard
          style={[styles.card, { borderLeftColor: color }]}
          onPress={() => navigation.navigate('ActivityDetails', { recordId: item.id, cropCycleId, readOnly })}
        >
          {/* Top row: date + badge */}
          <View style={styles.cardTop}>
            <View style={[styles.dateRow, { backgroundColor: color + '12' }]}>
              <Calendar size={11} color={color} />
              <Text style={[styles.dateText, { color }]}>{item.date}</Text>
            </View>
            <View style={styles.cardTopRight}>
              <View style={[styles.activityBadge, { backgroundColor: bg }]}>
                <Text style={[styles.activityLabel, { color }]}>{label}</Text>
              </View>
              <ChevronRight size={16} color="#C5CBD3" />
            </View>
          </View>

          {/* Body */}
          <View style={styles.cardBody}>
            <View style={styles.bodyLeft}>
              {/* Admin Advice: title + priority badge + recommended action */}
              {isAdvice && (
                <View style={styles.adviceBlock}>
                  <View style={styles.adviceTopRow}>
                    <Text style={styles.adviceTitle} numberOfLines={1}>{item.title}</Text>
                    {!!item.priority && (
                      <View style={[styles.priorityBadge, { backgroundColor: (PRIORITY_COLOR[item.priority] ?? COLORS.primary) + '20' }]}>
                        <Text style={[styles.priorityText, { color: PRIORITY_COLOR[item.priority] ?? COLORS.primary }]}>
                          {item.priority}
                        </Text>
                      </View>
                    )}
                  </View>
                  {!!item.recommendedAction && (
                    <Text style={styles.adviceRecommended} numberOfLines={2}>
                      Recommended: {item.recommendedAction}
                    </Text>
                  )}
                </View>
              )}

              {/* Symptom: AI-assessed priority badge */}
              {item.activityType === 'Symptom' && !!item.priority && (
                <View style={[styles.priorityBadge, styles.symptomPriorityBadge, { backgroundColor: (PRIORITY_COLOR[item.priority] ?? COLORS.primary) + '20' }]}>
                  <Text style={[styles.priorityText, { color: PRIORITY_COLOR[item.priority] ?? COLORS.primary }]}>
                    {item.priority} PRIORITY
                  </Text>
                </View>
              )}

              {/* Notes */}
              {!!item.notes && (
                <Text style={styles.notesText}>{item.notes}</Text>
              )}

              {/* Expense cost */}
              {showExpense && (
                <View style={styles.costRow}>
                  <Text style={[styles.rupee, { color }]}>₹</Text>
                  <Text style={[styles.costAmount, { color }]}>
                    {item.expense.toLocaleString('en-IN')}
                  </Text>
                </View>
              )}

              {/* Harvest income + optional quantity */}
              {showIncomeAmt && (
                <View style={styles.incomeBlock}>
                  {!!item.quantity && (
                    <Text style={styles.quantityText}>📦 {item.quantity}</Text>
                  )}
                  <View style={styles.incomeRow}>
                    <Text style={styles.incomeLabel}>Income</Text>
                    <Text style={styles.incomeAmount}>
                      ₹{(item.incomeAmount ?? 0).toLocaleString('en-IN')}
                    </Text>
                  </View>
                </View>
              )}

              {!hasDetails && (
                <Text style={styles.noNotesHint}>No details recorded</Text>
              )}
            </View>

            {/* Photo indicator */}
            {item.image ? (
              <View style={styles.photoThumbWrap}>
                <Image source={{ uri: item.image }} style={styles.photoThumb} />
              </View>
            ) : (
              <View style={styles.photoBox}>
                <ImageIcon size={16} color="#CCC" />
              </View>
            )}
          </View>
        </GlassCard>
      </View>
    );
  }, [records.length, cropCycleId, readOnly, navigation]);

  return (
    <SafeAreaView style={styles.container}>
      <GradientHero title={cropName || 'Crop Records'} subtitle="Activity Timeline" onBack={() => navigation.goBack()} compact />

      <FlatList
        data={records}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listPad}
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={10}
        removeClippedSubviews={Platform.OS === 'android'}
        ListHeaderComponent={(
          <>
            {/* Timeline heading */}
            <View style={styles.sectionHeading}>
              <Activity size={16} color={COLORS.primary} />
              <Text style={styles.sectionHeadingText}>CULTIVATION TIMELINE</Text>
            </View>

            {/* Legend */}
            <View style={styles.legend}>
              {[
                { label: 'Expense',    color: ACTIVITY_COLOR['Expense'] },
                { label: 'Harvest',    color: ACTIVITY_COLOR['Harvest / Income'] },
                { label: 'Symptom',    color: ACTIVITY_COLOR['Symptom'] },
                { label: 'Condition',  color: ACTIVITY_COLOR['Weekly Condition'] },
                { label: 'Advice',     color: ACTIVITY_COLOR['Advice Received'] },
              ].map(l => (
                <View key={l.label} style={[styles.legendItem, { backgroundColor: l.color + '14' }]}>
                  <View style={[styles.legendDot, { backgroundColor: l.color }]} />
                  <Text style={[styles.legendLabel, { color: l.color }]}>{l.label}</Text>
                </View>
              ))}
            </View>

            {/* Smart suggestions */}
            {suggestions.length > 0 && (
              <View style={styles.insightsBox}>
                <View style={styles.insightsHeader}>
                  <Lightbulb size={16} color="#F57C00" />
                  <Text style={styles.insightsTitle}>SMART SUGGESTIONS</Text>
                </View>
                {suggestions.map((s, i) => (
                  <View key={i} style={styles.suggestionRow}>
                    <View style={styles.suggestionDot} />
                    <Text style={styles.suggestionText}>{s}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
        ListEmptyComponent={(
          <View style={styles.empty}>
            <FileText size={48} color="#DDD" />
            <Text style={styles.emptyTitle}>No records yet</Text>
            <Text style={styles.emptyHint}>Tap "Add Record" to start tracking this crop cycle.</Text>
          </View>
        )}
      />

      {/* Footer: 3-column summary + action button, stacked so neither ever overlaps */}
      <View style={styles.footer}>
        <View style={styles.footerStatsRow}>
          <View style={styles.footerItem}>
            <Text style={styles.footerLabel}>EXPENSE</Text>
            <Text style={[styles.footerValue, styles.footerExpense]}>
              ₹{totalExpense.toLocaleString('en-IN')}
            </Text>
          </View>
          <View style={styles.footerDivider} />
          <View style={styles.footerItem}>
            <Text style={styles.footerLabel}>INCOME</Text>
            <Text style={[styles.footerValue, styles.footerIncome]}>
              {totalIncome > 0 ? `₹${totalIncome.toLocaleString('en-IN')}` : '—'}
            </Text>
          </View>
          <View style={styles.footerDivider} />
          <View style={styles.footerItem}>
            <Text style={styles.footerLabel}>P&L</Text>
            {totalIncome > 0 ? (
              <Text style={[styles.footerValue, { color: netPL >= 0 ? COLORS.success : COLORS.error }]}>
                {netPL >= 0 ? '+' : ''}₹{Math.abs(netPL).toLocaleString('en-IN')}
              </Text>
            ) : (
              <Text style={[styles.footerValue, styles.footerZero]}>—</Text>
            )}
          </View>
        </View>

        {/* Hidden entirely in read-only (admin viewing a customer's cycle) */}
        {!readOnly && (
          <TouchableOpacity
            style={styles.addRecordBtn}
            onPress={() => navigation.navigate('AddExpenseEntry', { cropCycleId })}
            activeOpacity={0.85}
          >
            <Plus size={20} color="#FFF" />
            <Text style={styles.fabText}>Add Record</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F7F3' },
  listPad: { paddingBottom: 110 },
  // Section heading
  sectionHeading: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingTop: SPACING.md, paddingBottom: SPACING.sm,
  },
  sectionHeadingText: {
    fontSize: 11, fontWeight: 'bold', color: COLORS.primary,
    textTransform: 'uppercase', letterSpacing: 1.2, marginLeft: 6,
  },
  // Legend
  legend: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: SPACING.md, marginBottom: SPACING.md, gap: 10,
  },
  legendItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10,
  },
  legendDot: { width: 7, height: 7, borderRadius: 3.5, marginRight: 5 },
  legendLabel: { fontSize: 11, fontWeight: '600' },
  // Insights
  insightsBox: {
    backgroundColor: '#FFF8E1',
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.lg,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1, borderColor: '#FFE082',
  },
  insightsHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  insightsTitle: {
    fontSize: 11, fontWeight: 'bold', color: '#F57C00',
    marginLeft: 6, letterSpacing: 1,
  },
  suggestionRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 5 },
  suggestionDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: '#FF9800', marginTop: 5, marginRight: 8,
  },
  suggestionText: { fontSize: 13, color: '#5D4037', lineHeight: 18, flex: 1 },
  // Timeline
  timelineRow: {
    flexDirection: 'row',
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  spine: {
    width: 22, alignItems: 'center',
    marginRight: 10, marginTop: 8,
  },
  dotRing: {
    width: 18, height: 18, borderRadius: 9, borderWidth: 3,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  line: { flex: 1, width: 2, minHeight: 36 },
  card: {
    flex: 1, padding: SPACING.md, borderLeftWidth: 4,
  },
  cardTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: SPACING.sm,
  },
  cardTopRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dateRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8,
  },
  dateText: { fontSize: 11, fontWeight: '700', marginLeft: 4 },
  activityBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  activityLabel: { fontSize: 10, fontWeight: 'bold' },
  cardBody: { flexDirection: 'row', alignItems: 'flex-start' },
  bodyLeft: { flex: 1 },
  notesText: {
    fontSize: 13, color: '#444', lineHeight: 18, marginBottom: 6,
  },
  adviceBlock: { marginBottom: 6 },
  adviceTopRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4,
  },
  adviceTitle: { fontSize: 14, fontWeight: 'bold', color: '#1A1A1A', flex: 1, marginRight: 8 },
  priorityBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 },
  symptomPriorityBadge: { alignSelf: 'flex-start', marginBottom: 6 },
  priorityText: { fontSize: 9, fontWeight: 'bold', letterSpacing: 0.5 },
  adviceRecommended: { fontSize: 12, color: '#5E35B1', fontStyle: 'italic', marginBottom: 4 },
  costRow: { flexDirection: 'row', alignItems: 'flex-end' },
  rupee: { fontSize: 13, fontWeight: 'bold', marginBottom: 2, marginRight: 2 },
  costAmount: { fontSize: 20, fontWeight: 'bold' },
  noNotesHint: { fontSize: 12, color: '#BBB', fontStyle: 'italic' },
  photoBox: {
    width: 54, height: 54, backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginLeft: 10,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)', borderStyle: 'dashed',
  },
  photoThumbWrap: {
    marginLeft: 10, borderRadius: 10, overflow: 'hidden',
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3,
  },
  photoThumb: { width: 54, height: 54, backgroundColor: '#EAEDF1' },
  // Harvest income display in timeline card
  incomeBlock: { marginTop: 4 },
  quantityText: { fontSize: 12, color: '#555', marginBottom: 4 },
  incomeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  incomeLabel: { fontSize: 12, fontWeight: '600', color: '#1B7F3E' },
  incomeAmount: { fontSize: 20, fontWeight: 'bold', color: '#1B7F3E' },
  // Footer
  footer: {
    backgroundColor: '#FFF',
    paddingHorizontal: SPACING.md, paddingTop: SPACING.md, paddingBottom: SPACING.sm,
    borderTopWidth: 1, borderTopColor: '#EEE',
  },
  footerStatsRow: { flexDirection: 'row', alignItems: 'center' },
  footerItem: { flex: 1, alignItems: 'center' },
  footerDivider: { width: 1, height: 32, backgroundColor: '#E8E8E8' },
  footerLabel: {
    fontSize: 9, fontWeight: 'bold', color: '#999',
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3,
  },
  footerValue: { fontSize: 16, fontWeight: 'bold', color: COLORS.primary },
  footerExpense: { color: COLORS.error },
  footerIncome: { color: COLORS.success },
  footerZero: { fontSize: 18, fontWeight: '300', color: '#CCC' },
  // Empty
  empty: { padding: 60, alignItems: 'center' },
  emptyTitle: { fontSize: 15, fontWeight: 'bold', color: '#AAA', marginTop: 12 },
  emptyHint: { fontSize: 13, color: '#CCC', marginTop: 4, textAlign: 'center' },
  // Add Record — laid out in-flow below the stats row, so it can never cover them
  addRecordBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 30, marginTop: SPACING.sm,
    elevation: 4,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6,
  },
  fabText: { color: '#FFF', fontSize: 15, fontWeight: 'bold', marginLeft: 6 },
});
