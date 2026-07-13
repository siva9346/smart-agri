import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Modal, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, BORDER_RADIUS } from '../../theme';
import { Card } from '../../components/Card';
import {
  Sprout, Banknote, Activity, TrendingUp,
  ArrowLeft, Plus, TrendingDown, CheckCircle, Clock, Lightbulb,
} from 'lucide-react-native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { setCropCycles, setRecords, completeCycle } from '../../store/cropSlice';
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

const adaptRecord = (r: any) => ({
  id:           r.recordId,
  cropCycleId:  r.cycleId,
  date:         r.date,
  stage:        r.stage || r.activityType || '',
  costType:     r.costType || '',
  activityType: r.activityType || undefined,
  expense:      typeof r.expense === 'number' ? r.expense : parseFloat(r.expense ?? '0') || 0,
  incomeAmount: r.incomeAmount != null ? (typeof r.incomeAmount === 'number' ? r.incomeAmount : parseFloat(r.incomeAmount)) : undefined,
  quantity:     r.quantity || undefined,
  notes:        r.notes || '',
  image:        r.image || undefined,
  createdAt:    r.createdAt || undefined,
  updatedAt:    r.updatedAt || undefined,
  title:        r.title || undefined,
  priority:     r.priority || undefined,
  recommendedAction: r.recommendedAction || undefined,
});

// ─── Crop age helper ─────────────────────────────────────────────────────────

const getCropAge = (startDate: string): number => {
  const start = new Date(startDate);
  const today = new Date();
  start.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
};

// ─── Component ───────────────────────────────────────────────────────────────

export const CropCycleScreen = ({ route, navigation }: any) => {
  const { landId, landName, readOnly } = route.params;
  const dispatch = useDispatch<AppDispatch>();
  const [dataLoading, setDataLoading] = useState(true);

  const allCycles        = useSelector((state: RootState) => state.crop.cropCycles);
  const recordsByCycleId = useSelector((state: RootState) => state.crop.recordsByCycleId);

  const loadData = useCallback(async () => {
    setDataLoading(true);
    try {
      const cyclesRes = await api.get<{ items: any[] }>(`/crop-cycles?landId=${landId}`);
      const cycles    = cyclesRes.items.map(adaptCycle);

      // Keep cycles for other lands + replace cycles for this land
      const otherCycles = allCycles.filter(c => c.landId !== landId);
      dispatch(setCropCycles([...otherCycles, ...cycles]));

      // Load records for each cycle in parallel
      await Promise.all(
        cycles.map(cycle =>
          api.get<{ items: any[] }>(`/records?cycleId=${cycle.id}`)
            .then(res => dispatch(setRecords({ cycleId: cycle.id, records: res.items.map(adaptRecord) })))
            .catch(() => {})
        )
      );
    } catch { /* show empty state */ } finally {
      setDataLoading(false);
    }
  }, [landId, dispatch]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const cropCycles = useMemo(
    () => allCycles.filter(cc => cc.landId === landId),
    [allCycles, landId],
  );
  const activeCycles = useMemo(
    () => cropCycles.filter(cc => cc.status === 'current' || cc.status === 'active'),
    [cropCycles],
  );
  const pastCycles = useMemo(
    () => cropCycles.filter(cc => cc.status === 'completed'),
    [cropCycles],
  );

  const [completeModal, setCompleteModal] = useState(false);
  const [completingId, setCompletingId] = useState('');

  // Single memoised pass — O(records per land) instead of O(total records × cycles)
  const cycleStats = useMemo(() => {
    const stats: Record<string, { expense: number; income: number }> = {};
    for (const cc of cropCycles) {
      const recs = recordsByCycleId[cc.id] ?? [];
      let expense = 0, income = 0;
      for (const r of recs) {
        if (r.activityType === 'Harvest / Income') income += r.incomeAmount ?? 0;
        else expense += r.expense;
      }
      stats[cc.id] = { expense, income };
    }
    return stats;
  }, [cropCycles, recordsByCycleId]);

  const handleCompleteCycle = (cycleId: string) => {
    setCompletingId(cycleId);
    setCompleteModal(true);
  };

  const confirmComplete = async () => {
    const endDate = new Date().toISOString().split('T')[0];
    setCompleteModal(false);
    try {
      await api.put(`/crop-cycles/${completingId}`, { status: 'COMPLETED', endDate });
    } catch { /* best-effort — update Redux anyway */ }
    dispatch(completeCycle({ id: completingId, endDate }));
    Alert.alert('Cycle Completed', 'This cultivation cycle is now closed. All records are preserved.');
  };

  // Land-level aggregates — derived from already-computed cycleStats
  const { landTotalExpense, landTotalIncome } = useMemo(() => {
    let exp = 0, inc = 0;
    for (const cc of cropCycles) {
      exp += cycleStats[cc.id]?.expense ?? 0;
      inc += cycleStats[cc.id]?.income ?? 0;
    }
    return { landTotalExpense: exp, landTotalIncome: inc };
  }, [cropCycles, cycleStats]);
  const landNetPL = landTotalIncome - landTotalExpense;

  const renderCycleCard = (cycle: any, isActive: boolean) => {
    const { expense, income } = cycleStats[cycle.id] ?? { expense: 0, income: 0 };
    const profit = income - expense;
    const age = isActive ? getCropAge(cycle.startDate) : null;

    return (
      <Card key={cycle.id} style={styles.card}>
        {/* Header row */}
        <View style={styles.cardHeader}>
          <View style={styles.cropIconContainer}>
            <Sprout size={22} color={COLORS.primary} />
          </View>
          <View style={styles.cropDetails}>
            <Text style={styles.cropNameText}>{cycle.cropName}</Text>
            <Text style={styles.dateText}>
              {cycle.startDate}{cycle.endDate ? ` → ${cycle.endDate}` : ''}
            </Text>
            <View style={styles.metaRow}>
              {cycle.area ? <Text style={styles.areaText}>{cycle.area}</Text> : null}
              {age !== null && (
                <View style={styles.ageChip}>
                  <Clock size={10} color={COLORS.primary} />
                  <Text style={styles.ageText}>Age: {age} days</Text>
                </View>
              )}
            </View>
          </View>
          <View style={[styles.statusBadge, isActive ? styles.activeBadge : styles.completedBadge]}>
            <Text style={[styles.statusText, isActive ? styles.activeText : styles.completedText]}>
              {isActive ? 'ACTIVE' : 'DONE'}
            </Text>
          </View>
        </View>

        {/* Financial summary — always visible */}
        <View style={styles.finRow}>
          <View style={styles.finItem}>
            <Text style={styles.finLabel}>EXPENSE</Text>
            <Text style={styles.finExpense}>₹{expense.toLocaleString()}</Text>
          </View>
          <View style={styles.finDivider} />
          <View style={styles.finItem}>
            <Text style={styles.finLabel}>INCOME</Text>
            {income > 0 ? (
              <Text style={styles.finIncome}>₹{income.toLocaleString()}</Text>
            ) : (
              <Text style={styles.finZero}>—</Text>
            )}
          </View>
          <View style={styles.finDivider} />
          <View style={styles.finItem}>
            <Text style={styles.finLabel}>P&L</Text>
            {income > 0 ? (
              <View style={styles.plRow}>
                {profit >= 0
                  ? <TrendingUp size={13} color={COLORS.success} />
                  : <TrendingDown size={13} color={COLORS.error} />}
                <Text style={[styles.plText, { color: profit >= 0 ? COLORS.success : COLORS.error }]}>
                  {profit >= 0 ? '+' : ''}₹{Math.abs(profit).toLocaleString()}
                </Text>
              </View>
            ) : (
              <Text style={styles.finZero}>—</Text>
            )}
          </View>
        </View>

        {/* Actions */}
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.trackBtn}
            onPress={() => navigation.navigate('CropTracking', { cropCycleId: cycle.id, cropName: cycle.cropName, readOnly })}
          >
            <Activity size={13} color={COLORS.surface} />
            <Text style={styles.trackBtnText}>View Timeline</Text>
          </TouchableOpacity>
          {isActive && !readOnly && (
            <TouchableOpacity style={styles.completeBtn} onPress={() => handleCompleteCycle(cycle.id)}>
              <CheckCircle size={13} color={COLORS.surface} />
              <Text style={styles.completeBtnText}>Complete Cycle</Text>
            </TouchableOpacity>
          )}
          {!isActive && (
            <TouchableOpacity
              style={styles.summaryBtn}
              onPress={() => navigation.navigate('ExpenseSummary', { cropCycleId: cycle.id, cropName: cycle.cropName })}
            >
              <Banknote size={13} color={COLORS.primary} />
              <Text style={styles.summaryBtnText}>Full Summary</Text>
            </TouchableOpacity>
          )}
          {readOnly && (
            <TouchableOpacity
              style={styles.adviceBtn}
              onPress={() => navigation.navigate('AddAdvice', { cycleId: cycle.id, cropName: cycle.cropName })}
            >
              <Lightbulb size={13} color={COLORS.surface} />
              <Text style={styles.adviceBtnText}>Give Advice</Text>
            </TouchableOpacity>
          )}
        </View>
      </Card>
    );
  };

  if (dataLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.screenHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ArrowLeft size={22} color={COLORS.text} />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>{landName}</Text>
            <Text style={styles.headerSub}>Cultivation Cycles</Text>
          </View>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.screenHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>{landName}</Text>
          <Text style={styles.headerSub}>Cultivation Cycles</Text>
        </View>
        {!readOnly && (
          <TouchableOpacity
            style={styles.newCycleBtn}
            onPress={() => navigation.navigate('AddCropCycle', { landId, landName })}
          >
            <Plus size={18} color="#FFF" />
            <Text style={styles.newCycleBtnText}>New</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {activeCycles.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>CURRENT CULTIVATION</Text>
            {activeCycles.map(cc => renderCycleCard(cc, true))}
          </View>
        )}

        {pastCycles.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>PAST CYCLES</Text>
            {pastCycles.map(cc => renderCycleCard(cc, false))}
          </View>
        )}

        {cropCycles.length === 0 && (
          <View style={styles.emptyContainer}>
            <Sprout size={48} color="#CCC" />
            <Text style={styles.emptyText}>No cultivation cycles yet.</Text>
            <Text style={styles.emptyHint}>Tap "New" to start your first cultivation.</Text>
          </View>
        )}

        {/* Land-level summary */}
        {cropCycles.length > 0 && (
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <TrendingUp size={18} color={COLORS.surface} />
              <Text style={styles.summaryTitle}>Land Summary</Text>
            </View>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryItemLabel}>Total Investment</Text>
                <Text style={styles.summaryExpense}>₹{landTotalExpense.toLocaleString()}</Text>
              </View>
              <View style={styles.summarySeparator} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryItemLabel}>Total Income</Text>
                <Text style={styles.summaryIncome}>₹{landTotalIncome.toLocaleString()}</Text>
              </View>
            </View>
            <View style={styles.netPLContainer}>
              <Text style={styles.netPLLabel}>NET PROFIT / LOSS</Text>
              <View style={styles.netPLRow}>
                {landNetPL >= 0
                  ? <TrendingUp size={22} color={landNetPL > 0 ? '#A5D6A7' : '#FFF'} />
                  : <TrendingDown size={22} color="#FF5252" />}
                <Text style={[styles.netPLAmount, { color: landNetPL >= 0 ? '#A5D6A7' : '#FF5252' }]}>
                  {landNetPL >= 0 ? '+' : ''}₹{Math.abs(landNetPL).toLocaleString()}
                </Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Complete Cycle confirmation modal — no income input, just confirm */}
      <Modal visible={completeModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconRow}>
              <CheckCircle size={44} color={COLORS.success} />
            </View>
            <Text style={styles.modalTitle}>Complete Cultivation Cycle?</Text>
            <Text style={styles.modalSub}>
              This cycle will be marked as closed. All expense and income records are preserved and the timeline remains viewable.
            </Text>

            {/* Snapshot summary — reads from already-computed cycleStats */}
            <View style={styles.modalSummaryRow}>
              <View style={styles.modalSummaryItem}>
                <Text style={styles.modalSummaryLabel}>TOTAL EXPENSE</Text>
                <Text style={styles.modalSummaryExpense}>
                  ₹{(cycleStats[completingId]?.expense ?? 0).toLocaleString()}
                </Text>
              </View>
              <View style={styles.modalSummaryDivider} />
              <View style={styles.modalSummaryItem}>
                <Text style={styles.modalSummaryLabel}>TOTAL INCOME</Text>
                <Text style={styles.modalSummaryIncome}>
                  ₹{(cycleStats[completingId]?.income ?? 0).toLocaleString()}
                </Text>
              </View>
            </View>

            {(() => {
              const exp = cycleStats[completingId]?.expense ?? 0;
              const inc = cycleStats[completingId]?.income ?? 0;
              const pl = inc - exp;
              if (inc === 0) return null;
              return (
                <View style={[styles.plPreview, { backgroundColor: pl >= 0 ? '#E8F5E9' : '#FFEBEE' }]}>
                  {pl >= 0
                    ? <TrendingUp size={16} color={COLORS.success} />
                    : <TrendingDown size={16} color={COLORS.error} />}
                  <Text style={[styles.plPreviewText, { color: pl >= 0 ? COLORS.success : COLORS.error }]}>
                    {pl >= 0 ? 'Profit' : 'Loss'}: {pl >= 0 ? '+' : ''}₹{Math.abs(pl).toLocaleString()}
                  </Text>
                </View>
              );
            })()}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setCompleteModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={confirmComplete}>
                <CheckCircle size={16} color="#FFF" />
                <Text style={styles.modalConfirmText}>Mark Complete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export const LandDetailsScreen = CropCycleScreen;

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  screenHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#FFF',
    borderBottomWidth: 1, borderBottomColor: '#E8EDF2',
    elevation: 2, shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A1A' },
  headerSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  newCycleBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 20, gap: 4,
  },
  newCycleBtnText: { color: '#FFF', fontSize: 13, fontWeight: 'bold' },
  scroll: { flex: 1 },
  scrollContent: { padding: SPACING.md, paddingBottom: 40 },
  section: { marginBottom: SPACING.lg },
  sectionLabel: {
    fontSize: 11, fontWeight: 'bold', color: COLORS.textSecondary,
    textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: SPACING.sm,
  },
  card: { marginBottom: SPACING.md, padding: SPACING.md },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: SPACING.md },
  cropIconContainer: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center', alignItems: 'center', marginRight: SPACING.md,
  },
  cropDetails: { flex: 1 },
  cropNameText: { fontSize: 17, fontWeight: 'bold', color: COLORS.primary },
  dateText: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8, flexWrap: 'wrap' },
  areaText: { fontSize: 12, color: COLORS.textSecondary },
  ageChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#E8F5E9', borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  ageText: { fontSize: 11, fontWeight: '600', color: COLORS.primary },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  activeBadge: { backgroundColor: '#E8F5E9' },
  completedBadge: { backgroundColor: '#F5F5F5' },
  statusText: { fontSize: 10, fontWeight: 'bold' },
  activeText: { color: COLORS.primary },
  completedText: { color: COLORS.textSecondary },
  // Financial row
  finRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F8FAFB', borderRadius: 10,
    padding: SPACING.md, marginBottom: SPACING.md,
  },
  finItem: { flex: 1, alignItems: 'center' },
  finDivider: { width: 1, height: 36, backgroundColor: '#E0E0E0' },
  finLabel: {
    fontSize: 9, fontWeight: 'bold', color: '#999',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4,
  },
  finExpense: { fontSize: 14, fontWeight: 'bold', color: COLORS.error },
  finIncome: { fontSize: 14, fontWeight: 'bold', color: COLORS.success },
  finZero: { fontSize: 18, fontWeight: '300', color: '#CCC' },
  plRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  plText: { fontSize: 13, fontWeight: 'bold' },
  // Actions
  cardActions: { flexDirection: 'row', gap: SPACING.sm },
  trackBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', backgroundColor: COLORS.primary,
    paddingVertical: 8, borderRadius: BORDER_RADIUS.md, gap: 6,
  },
  trackBtnText: { color: '#FFF', fontSize: 13, fontWeight: 'bold' },
  completeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', backgroundColor: COLORS.success,
    paddingVertical: 8, borderRadius: BORDER_RADIUS.md, gap: 6,
  },
  completeBtnText: { color: '#FFF', fontSize: 13, fontWeight: 'bold' },
  summaryBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.primary,
    paddingVertical: 8, borderRadius: BORDER_RADIUS.md, gap: 6,
  },
  summaryBtnText: { color: COLORS.primary, fontSize: 13, fontWeight: 'bold' },
  adviceBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', backgroundColor: '#5E35B1',
    paddingVertical: 8, borderRadius: BORDER_RADIUS.md, gap: 6,
  },
  adviceBtnText: { color: '#FFF', fontSize: 13, fontWeight: 'bold' },
  // Empty state
  emptyContainer: { paddingVertical: 60, alignItems: 'center' },
  emptyText: { fontSize: 16, color: COLORS.textSecondary, marginTop: 12 },
  emptyHint: { fontSize: 13, color: '#CCC', marginTop: 4, textAlign: 'center' },
  // Land summary card
  summaryCard: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg, marginTop: SPACING.md,
    elevation: 4, shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8,
  },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.lg },
  summaryTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginLeft: SPACING.sm },
  summaryRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.lg },
  summaryItem: { flex: 1, alignItems: 'center' },
  summarySeparator: { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.3)' },
  summaryItemLabel: {
    color: 'rgba(255,255,255,0.7)', fontSize: 11,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4,
  },
  summaryExpense: { color: '#FFCDD2', fontSize: 18, fontWeight: 'bold' },
  summaryIncome: { color: '#C8E6C9', fontSize: 18, fontWeight: 'bold' },
  netPLContainer: {
    alignItems: 'center',
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)',
    paddingTop: SPACING.md,
  },
  netPLLabel: {
    color: 'rgba(255,255,255,0.7)', fontSize: 11,
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6,
  },
  netPLRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  netPLAmount: { fontSize: 28, fontWeight: 'bold' },
  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: SPACING.xl, paddingBottom: 40,
  },
  modalIconRow: { alignItems: 'center', marginBottom: SPACING.md },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text, marginBottom: 6, textAlign: 'center' },
  modalSub: {
    fontSize: 13, color: COLORS.textSecondary, textAlign: 'center',
    lineHeight: 20, marginBottom: SPACING.lg,
  },
  modalSummaryRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F8FAFB', borderRadius: 12,
    padding: SPACING.md, marginBottom: SPACING.md,
  },
  modalSummaryItem: { flex: 1, alignItems: 'center' },
  modalSummaryDivider: { width: 1, height: 36, backgroundColor: '#E0E0E0' },
  modalSummaryLabel: {
    fontSize: 9, fontWeight: 'bold', color: '#999',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4,
  },
  modalSummaryExpense: { fontSize: 16, fontWeight: 'bold', color: COLORS.error },
  modalSummaryIncome: { fontSize: 16, fontWeight: 'bold', color: COLORS.success },
  plPreview: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, marginBottom: SPACING.md,
  },
  plPreviewText: { fontSize: 16, fontWeight: 'bold' },
  modalActions: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.sm },
  modalCancel: {
    flex: 1, padding: 14, borderRadius: BORDER_RADIUS.md,
    backgroundColor: '#F5F5F5', alignItems: 'center',
  },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: COLORS.textSecondary },
  modalConfirm: {
    flex: 2, flexDirection: 'row', padding: 14, borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.success, alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  modalConfirmText: { fontSize: 15, fontWeight: 'bold', color: '#FFF' },
});
