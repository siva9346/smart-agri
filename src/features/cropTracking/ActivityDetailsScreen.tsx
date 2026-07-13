import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import { ArrowLeft, Calendar, FileText, Lock, Edit3, Trash2, X, AlertTriangle } from 'lucide-react-native';
import { RootState, AppDispatch } from '../../store';
import { removeRecord } from '../../store/cropSlice';
import { api } from '../../services/api';
import { COLORS, SPACING, BORDER_RADIUS } from '../../theme';
import { ZoomableImage } from '../../components/ZoomableImage';
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Activity Details</Text>
          <Text style={styles.headerSubtitle}>{record.date}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {isCompleted && (
          <View style={styles.readOnlyBanner}>
            <Lock size={16} color="#7A5C00" />
            <Text style={styles.readOnlyText}>
              This crop cycle has been completed. Activity records are now read-only.
            </Text>
          </View>
        )}

        <View style={[styles.card, { borderLeftColor: color }]}>
          <View style={[styles.badge, { backgroundColor: bg }]}>
            <Text style={[styles.badgeText, { color }]}>{label}</Text>
          </View>

          {isAdvice && record.priority && (
            <View style={[styles.priorityBadge, { backgroundColor: (PRIORITY_COLOR[record.priority] ?? color) + '22' }]}>
              <AlertTriangle size={13} color={PRIORITY_COLOR[record.priority] ?? color} />
              <Text style={[styles.priorityText, { color: PRIORITY_COLOR[record.priority] ?? color }]}>
                {record.priority} PRIORITY
              </Text>
            </View>
          )}

          {isAdvice && record.title ? <Text style={styles.adviceTitle}>{record.title}</Text> : null}

          <View style={styles.fieldRow}>
            <Calendar size={16} color={COLORS.textSecondary} />
            <Text style={styles.fieldLabel}>Date</Text>
            <Text style={styles.fieldValue}>{record.date}</Text>
          </View>

          {showExpense && (
            <View style={styles.fieldRow}>
              <Text style={styles.rupee}>₹</Text>
              <Text style={styles.fieldLabel}>Cost</Text>
              <Text style={[styles.fieldValue, { color: COLORS.error, fontWeight: 'bold' }]}>
                {record.expense.toLocaleString('en-IN')}
              </Text>
            </View>
          )}

          {showIncome && (
            <View style={styles.fieldRow}>
              <Text style={styles.rupee}>₹</Text>
              <Text style={styles.fieldLabel}>Income</Text>
              <Text style={[styles.fieldValue, { color: COLORS.success, fontWeight: 'bold' }]}>
                {(record.incomeAmount ?? 0).toLocaleString('en-IN')}
              </Text>
            </View>
          )}

          {!!record.quantity && (
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Quantity</Text>
              <Text style={styles.fieldValue}>{record.quantity}</Text>
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
              <Text style={styles.photoHint}>Tap to view full size</Text>
            </TouchableOpacity>
          )}

          <View style={styles.timestampBlock}>
            <Text style={styles.timestampText}>Created: {formatDateTime(record.createdAt)}</Text>
            <Text style={styles.timestampText}>Last Updated: {formatDateTime(record.updatedAt ?? record.createdAt)}</Text>
          </View>
        </View>

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
  safe: { flex: 1, backgroundColor: '#F0F4F8' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: COLORS.textSecondary },
  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#E8EDF2',
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3,
  },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A1A' },
  headerSubtitle: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  scroll: { padding: SPACING.md, paddingBottom: 40 },
  readOnlyBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFF8E1', borderWidth: 1, borderColor: '#FFE082',
    borderRadius: BORDER_RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md,
  },
  readOnlyText: { flex: 1, fontSize: 13, color: '#7A5C00', lineHeight: 18 },
  card: {
    backgroundColor: '#FFF', borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg,
    borderLeftWidth: 4, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5,
  },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, marginBottom: SPACING.md },
  badgeText: { fontSize: 12, fontWeight: 'bold' },
  priorityBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginBottom: SPACING.sm },
  priorityText: { fontSize: 11, fontWeight: 'bold' },
  adviceTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text, marginBottom: SPACING.md },
  fieldRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md, gap: 8 },
  rupee: { fontSize: 14, fontWeight: 'bold', color: COLORS.textSecondary, width: 16 },
  fieldLabel: { fontSize: 14, color: COLORS.textSecondary, flex: 1 },
  fieldValue: { fontSize: 15, color: COLORS.text, fontWeight: '600' },
  notesBlock: { marginTop: SPACING.sm, marginBottom: SPACING.md },
  notesLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  notesLabel: { fontSize: 12, fontWeight: 'bold', color: COLORS.textSecondary, textTransform: 'uppercase' },
  notesText: { fontSize: 15, color: COLORS.text, lineHeight: 22 },
  photoThumbWrap: { marginTop: SPACING.sm, marginBottom: SPACING.md },
  photoThumb: { width: '100%', height: 200, borderRadius: BORDER_RADIUS.md, backgroundColor: '#EAEDF1' },
  photoHint: { fontSize: 12, color: COLORS.textSecondary, marginTop: 6, textAlign: 'center' },
  timestampBlock: { borderTopWidth: 1, borderTopColor: '#EEE', paddingTop: SPACING.md, marginTop: SPACING.sm },
  timestampText: { fontSize: 12, color: '#999', marginBottom: 2 },
  actionsRow: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.lg },
  editBtn: { flex: 1, flexDirection: 'row', gap: 8, backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: BORDER_RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  deleteBtn: { flex: 1, flexDirection: 'row', gap: 8, backgroundColor: COLORS.error, paddingVertical: 14, borderRadius: BORDER_RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  actionBtnText: { color: '#FFF', fontSize: 15, fontWeight: 'bold' },
  photoModalOverlay: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  photoCloseBtn: { position: 'absolute', top: 50, right: 20, zIndex: 10 },
});
