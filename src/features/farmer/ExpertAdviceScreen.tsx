import React, { useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  Modal, TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, BORDER_RADIUS } from '../../theme';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store';
import { submitAdviceRequest } from '../../store/adviceSlice';
import {
  MessageSquare, Plus, CheckCircle, Clock, Calendar,
  FileText, ChevronRight, Stethoscope,
} from 'lucide-react-native';

export const ExpertAdviceScreen = ({ navigation }: any) => {
  const dispatch = useDispatch();
  const allRequests = useSelector((state: RootState) => state.advice.requests);
  const farmerRequests = allRequests.filter(r => r.farmerId === '1');

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = 'Please enter a problem title';
    if (!description.trim()) e.description = 'Please describe the issue';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    dispatch(submitAdviceRequest({
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      farmerId: '1',
      farmerName: 'Murugan',
      title: title.trim(),
      description: description.trim(),
      status: 'Pending',
      createdAt: todayStr(),
    }));
    setTitle('');
    setDescription('');
    setErrors({});
    setShowForm(false);
    Alert.alert('Request Submitted', 'Your advice request has been sent. Admin will respond soon.');
  };

  const closeForm = () => {
    setShowForm(false);
    setTitle('');
    setDescription('');
    setErrors({});
  };

  const pendingCount = farmerRequests.filter(r => r.status === 'Pending').length;
  const completedCount = farmerRequests.filter(r => r.status === 'Completed').length;

  const renderItem = ({ item }: { item: any }) => {
    const isPending = item.status === 'Pending';
    return (
      <View style={[styles.card, isPending ? styles.pendingCard : styles.completedCard]}>
        <View style={styles.cardTop}>
          <View style={[styles.statusChip, { backgroundColor: isPending ? '#FFF3E0' : '#E8F5E9' }]}>
            {isPending
              ? <Clock size={13} color="#E65100" />
              : <CheckCircle size={13} color={COLORS.success} />}
            <Text style={[styles.statusText, { color: isPending ? '#E65100' : COLORS.success }]}>
              {item.status}
            </Text>
          </View>
          <View style={styles.dateChip}>
            <Calendar size={12} color={COLORS.textSecondary} />
            <Text style={styles.dateText}>{item.createdAt}</Text>
          </View>
        </View>

        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>

        {item.adminResponse ? (
          <View style={styles.responseBox}>
            <View style={styles.responseHeader}>
              <Stethoscope size={14} color={COLORS.primary} />
              <Text style={styles.responseHeaderText}>Expert Response</Text>
            </View>
            <Text style={styles.responseText}>{item.adminResponse}</Text>
            {item.respondedAt && (
              <Text style={styles.respondedAt}>Responded on {item.respondedAt}</Text>
            )}
          </View>
        ) : (
          <View style={styles.waitingBox}>
            <Clock size={14} color="#999" />
            <Text style={styles.waitingText}>Awaiting expert response...</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Stats bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{farmerRequests.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#E65100' }]}>{pendingCount}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: COLORS.success }]}>{completedCount}</Text>
          <Text style={styles.statLabel}>Answered</Text>
        </View>
      </View>

      <FlatList
        data={farmerRequests}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Text style={styles.listHeader}>My Advice Requests</Text>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <MessageSquare size={56} color="#DDD" />
            <Text style={styles.emptyTitle}>No requests yet</Text>
            <Text style={styles.emptyHint}>Tap "Request Advice" to ask our agri-experts.</Text>
          </View>
        }
      />

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowForm(true)} activeOpacity={0.85}>
        <Plus size={20} color="#FFF" />
        <Text style={styles.fabText}>Request Advice</Text>
      </TouchableOpacity>

      {/* Request Form Modal */}
      <Modal visible={showForm} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.modalTitle}>Request Expert Advice</Text>
            <Text style={styles.modalSub}>Describe your crop problem and our experts will respond.</Text>

            <Text style={styles.fieldLabel}>Problem Title</Text>
            <TextInput
              style={[styles.input, errors.title && styles.inputError]}
              placeholder="e.g. Yellow spots on paddy leaves"
              value={title}
              onChangeText={v => { setTitle(v); setErrors(p => ({ ...p, title: '' })); }}
            />
            {!!errors.title && <Text style={styles.errorText}>{errors.title}</Text>}

            <Text style={styles.fieldLabel}>Describe the Issue</Text>
            <TextInput
              style={[styles.input, styles.textArea, errors.description && styles.inputError]}
              placeholder="Describe in detail: when it started, crop age, location, weather conditions..."
              multiline
              numberOfLines={4}
              value={description}
              onChangeText={v => { setDescription(v); setErrors(p => ({ ...p, description: '' })); }}
              textAlignVertical="top"
            />
            {!!errors.description && <Text style={styles.errorText}>{errors.description}</Text>}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={closeForm}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
                <Text style={styles.submitBtnText}>Submit Request</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F9FC' },
  statsBar: {
    flexDirection: 'row', backgroundColor: '#FFF',
    paddingVertical: SPACING.md, paddingHorizontal: SPACING.lg,
    borderBottomWidth: 1, borderBottomColor: '#EEE',
  },
  statItem: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, backgroundColor: '#EEE', marginHorizontal: SPACING.md },
  statValue: { fontSize: 22, fontWeight: 'bold', color: COLORS.text },
  statLabel: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  list: { padding: SPACING.md, paddingBottom: 100 },
  listHeader: {
    fontSize: 16, fontWeight: 'bold', color: COLORS.text,
    marginBottom: SPACING.md,
  },
  card: {
    backgroundColor: '#FFF', borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md, marginBottom: SPACING.md,
    elevation: 2, shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5,
    borderLeftWidth: 4,
  },
  pendingCard: { borderLeftColor: '#FF8F00' },
  completedCard: { borderLeftColor: COLORS.success },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  statusChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 4,
  },
  statusText: { fontSize: 12, fontWeight: 'bold' },
  dateChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dateText: { fontSize: 12, color: COLORS.textSecondary },
  cardTitle: { fontSize: 15, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 4 },
  cardDesc: { fontSize: 13, color: '#666', lineHeight: 18, marginBottom: SPACING.sm },
  responseBox: {
    backgroundColor: '#E8F5E9', borderRadius: 10,
    padding: SPACING.md, marginTop: SPACING.sm,
    borderWidth: 1, borderColor: '#C8E6C9',
  },
  responseHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  responseHeaderText: { fontSize: 12, fontWeight: 'bold', color: COLORS.primary, textTransform: 'uppercase', letterSpacing: 0.5 },
  responseText: { fontSize: 14, color: '#333', lineHeight: 20 },
  respondedAt: { fontSize: 11, color: '#888', marginTop: 6, textAlign: 'right' },
  waitingBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F5F5F5', borderRadius: 8,
    padding: SPACING.sm, marginTop: SPACING.sm, gap: 6,
  },
  waitingText: { fontSize: 13, color: '#999', fontStyle: 'italic' },
  empty: { padding: 60, alignItems: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: 'bold', color: '#AAA', marginTop: 14 },
  emptyHint: { fontSize: 13, color: '#CCC', marginTop: 6, textAlign: 'center' },
  fab: {
    position: 'absolute', bottom: 24, right: SPACING.lg,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20, paddingVertical: 13,
    borderRadius: 30, gap: 8,
    elevation: 6, shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8,
  },
  fabText: { color: '#FFF', fontSize: 15, fontWeight: 'bold' },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: SPACING.xl, paddingBottom: 40,
  },
  sheetHandle: {
    width: 40, height: 4, backgroundColor: '#DDD',
    borderRadius: 2, alignSelf: 'center', marginBottom: SPACING.lg,
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text, marginBottom: 4 },
  modalSub: { fontSize: 13, color: COLORS.textSecondary, marginBottom: SPACING.lg },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: SPACING.sm, marginTop: SPACING.md },
  input: {
    backgroundColor: '#F7F9FC', borderRadius: 10,
    borderWidth: 1.5, borderColor: '#E0E6EE',
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#333',
  },
  inputError: { borderColor: COLORS.error },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  errorText: { fontSize: 12, color: COLORS.error, marginTop: 4 },
  modalActions: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.xl },
  cancelBtn: {
    flex: 1, padding: 14, borderRadius: BORDER_RADIUS.md,
    backgroundColor: '#F5F5F5', alignItems: 'center',
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: COLORS.textSecondary },
  submitBtn: {
    flex: 2, padding: 14, borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary, alignItems: 'center',
  },
  submitBtnText: { fontSize: 15, fontWeight: 'bold', color: '#FFF' },
});
