import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import { Calendar, FileText, Lock, Edit3, Trash2, X, AlertTriangle, Package, ZoomIn } from 'lucide-react-native';
import { RootState, AppDispatch } from '../../store';
import { removeRecord } from '../../store/cropSlice';
import { api } from '../../services/api';
import { COLORS, SPACING, BORDER_RADIUS } from '../../theme';
import { ZoomableImage } from '../../components/ZoomableImage';
import { GradientHero } from '../../components/GradientHero';
import { GlassCard } from '../../components/GlassCard';
import { getColor, getBg, getLabel, isHarvest, isObservation } from './CropTrackingScreen';

const formatDateTime = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
};

const PRIORITY_COLOR: Record<string, string> = { LOW: '#388E3C', MEDIUM: '#F57C00', HIGH: '#D32F2F' };

export const ActivityDetailsScreen = ({ route, navigation }: any) => {
  const { recordId, cropCycleId, readOnly } = route.params || {};
  const dispatch = useDispatch<AppDispatch>();
  const [photoOpen, setPhotoOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const record = useSelector((state: RootState) =>
    (state.crop.recordsByCycleId[cropCycleId] ?? []).find(r => r.id === recordId)
  );
  const cycle = useSelector((state: RootState) =>
    state.crop.cropCycles.find(cc => cc.id === cropCycleId)
  );

  if (!record) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Record not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isCompleted = cycle?.status === 'completed';
  const canEdit = !readOnly && !isCompleted;
  const color = getColor(record);
  const bg = getBg(record);
  const label = getLabel(record);
  const isAdvice = record.activityType === 'Admin Advice';
  const harv = isHarvest(record);
  const obs = isObservation(record);
  const showExpense = record.expense > 0 && !obs && !harv && !isAdvice;
  const showIncome = harv && (record.incomeAmount ?? 0) > 0;

  const handleEdit = () => {
    navigation.navigate('AddExpenseEntry', { cropCycleId, record });
  };

  const handleDelete = () => {
    Alert.alert('Delete Activity Record', 'This cannot be undone. Delete this record?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await api.delete(`/records/${record.id}`);
            dispatch(removeRecord({ id: record.id, cropCycleId }));
            navigation.goBack();
          } catch (err: any) {
            Alert.alert('Error', err?.message ?? 'Failed to delete record');
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <GradientHero title="Activity Details" subtitle={record.date} onBack={() => navigation.goBack()} compact />

      <ScrollView contentContainerStyle={styles.scroll}>
        {isCompleted && (
          <View style={styles.readOnlyBanner}>
            <Lock size={16} color="#7A5C00" />
            <Text style={styles.readOnlyText}>
              This crop cycle has been completed. Activity records are now read-only.
            </Text>
          </View>
        )}

        <GlassCard style={[styles.card, { borderLeftColor: color }]}>
          <View style={styles.topRow}>
            <View style={[styles.badge, { backgroundColor: bg }]}>
              <Text style={[styles.badgeText, { color }]}>{label}</Text>
            </View>
            <View style={styles.dateChip}>
              <Calendar size={13} color={COLORS.textSecondary} />
              <Text style={styles.dateChipText}>{record.date}</Text>
            </View>
          </View>

          {(isAdvice || record.activityType === 'Symptom') && record.priority && (
            <View style={[styles.priorityBadge, { backgroundColor: (PRIORITY_COLOR[record.priority] ?? color) + '22' }]}>
              <AlertTriangle size={13} color={PRIORITY_COLOR[record.priority] ?? color} />
              <Text style={[styles.priorityText, { color: PRIORITY_COLOR[record.priority] ?? color }]}>
                {record.priority} PRIORITY
              </Text>
            </View>
          )}

          {isAdvice && record.title ? <Text style={styles.adviceTitle}>{record.title}</Text> : null}

          {(showExpense || showIncome) && (
            <View style={[styles.statBlock, { backgroundColor: (showExpense ? COLORS.error : COLORS.success) + '10' }]}>
              <View style={[styles.statIcon, { backgroundColor: (showExpense ? COLORS.error : COLORS.success) + '20' }]}>
                <Text style={[styles.statRupee, { color: showExpense ? COLORS.error : COLORS.success }]}>₹</Text>
              </View>
              <View>
                <Text style={styles.statLabel}>{showExpense ? 'COST' : 'INCOME'}</Text>
                <Text style={[styles.statValue, { color: showExpense ? COLORS.error : COLORS.success }]}>
                  {(showExpense ? record.expense : (record.incomeAmount ?? 0)).toLocaleString('en-IN')}
                </Text>
              </View>
            </View>
          )}

          {!!record.quantity && (
            <View style={styles.quantityChip}>
              <Package size={13} color={COLORS.textSecondary} />
              <Text style={styles.quantityChipText}>{record.quantity}</Text>
            </View>
          )}

          {(!!record.notes || isAdvice) && (
            <View style={styles.notesBlock}>
              <View style={styles.notesLabelRow}>
                <FileText size={14} color={COLORS.textSecondary} />
                <Text style={styles.notesLabel}>{isAdvice ? 'Advice Message' : 'Notes'}</Text>
              </View>
              <Text style={styles.notesText}>{record.notes || '—'}</Text>
            </View>
          )}

          {isAdvice && !!record.recommendedAction && (
            <View style={styles.notesBlock}>
              <Text style={styles.notesLabel}>Recommended Action</Text>
              <Text style={styles.notesText}>{record.recommendedAction}</Text>
            </View>
          )}

          {!!record.image && (
            <TouchableOpacity style={styles.photoThumbWrap} onPress={() => setPhotoOpen(true)} activeOpacity={0.85}>
              <Image source={{ uri: record.image }} style={styles.photoThumb} />
              <View style={styles.photoZoomBadge}>
                <ZoomIn size={16} color="#FFF" />
              </View>
            </TouchableOpacity>
          )}

          <View style={styles.timestampBlock}>
            <Text style={styles.timestampText}>Created: {formatDateTime(record.createdAt)}</Text>
            <Text style={styles.timestampText}>Last Updated: {formatDateTime(record.updatedAt ?? record.createdAt)}</Text>
          </View>
        </GlassCard>

        {canEdit && (
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.editBtn} onPress={handleEdit}>
              <Edit3 size={16} color="#FFF" />
              <Text style={styles.actionBtnText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.deleteBtn, deleting && { opacity: 0.7 }]} onPress={handleDelete} disabled={deleting}>
              <Trash2 size={16} color="#FFF" />
              <Text style={styles.actionBtnText}>{deleting ? 'Deleting...' : 'Delete'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <Modal visible={photoOpen} transparent animationType="fade" onRequestClose={() => setPhotoOpen(false)}>
        <View style={styles.photoModalOverlay}>
          <TouchableOpacity style={styles.photoCloseBtn} onPress={() => setPhotoOpen(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <X size={26} color="#FFF" />
          </TouchableOpacity>
          {!!record.image && <ZoomableImage uri={record.image} />}
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F2F7F3' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: COLORS.textSecondary },
  scroll: { padding: SPACING.md, paddingBottom: 40 },
  readOnlyBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFF8E1', borderWidth: 1, borderColor: '#FFE082',
    borderRadius: BORDER_RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md,
  },
  readOnlyText: { flex: 1, fontSize: 13, color: '#7A5C00', lineHeight: 18 },
  card: { padding: SPACING.lg, borderLeftWidth: 4 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  badgeText: { fontSize: 12, fontWeight: 'bold' },
  dateChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.05)', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10 },
  dateChipText: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  priorityBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginBottom: SPACING.sm },
  priorityText: { fontSize: 11, fontWeight: 'bold' },
  adviceTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text, marginBottom: SPACING.md },
  statBlock: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: SPACING.md, borderRadius: BORDER_RADIUS.md, marginBottom: SPACING.md,
  },
  statIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  statRupee: { fontSize: 18, fontWeight: 'bold' },
  statLabel: { fontSize: 10.5, fontWeight: 'bold', color: COLORS.textSecondary, letterSpacing: 0.8 },
  statValue: { fontSize: 24, fontWeight: 'bold', marginTop: 1 },
  quantityChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.05)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, marginBottom: SPACING.md,
  },
  quantityChipText: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  notesBlock: { marginTop: SPACING.sm, marginBottom: SPACING.md },
  notesLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  notesLabel: { fontSize: 12, fontWeight: 'bold', color: COLORS.textSecondary, textTransform: 'uppercase' },
  notesText: { fontSize: 15, color: COLORS.text, lineHeight: 22 },
  photoThumbWrap: { marginTop: SPACING.sm, marginBottom: SPACING.md, position: 'relative' },
  photoThumb: { width: '100%', height: 200, borderRadius: BORDER_RADIUS.md, backgroundColor: '#EAEDF1' },
  photoZoomBadge: {
    position: 'absolute', bottom: 10, right: 10,
    width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  timestampBlock: { borderTopWidth: 1, borderTopColor: '#EEE', paddingTop: SPACING.md, marginTop: SPACING.sm },
  timestampText: { fontSize: 12, color: '#999', marginBottom: 2 },
  actionsRow: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.lg },
  editBtn: {
    flex: 1, flexDirection: 'row', gap: 8, backgroundColor: COLORS.primary,
    paddingVertical: 14, borderRadius: 30, alignItems: 'center', justifyContent: 'center',
    elevation: 3, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6,
  },
  deleteBtn: {
    flex: 1, flexDirection: 'row', gap: 8, backgroundColor: COLORS.error,
    paddingVertical: 14, borderRadius: 30, alignItems: 'center', justifyContent: 'center',
    elevation: 3, shadowColor: COLORS.error, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6,
  },
  actionBtnText: { color: '#FFF', fontSize: 15, fontWeight: 'bold' },
  photoModalOverlay: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  photoCloseBtn: { position: 'absolute', top: 50, right: 20, zIndex: 10 },
});
