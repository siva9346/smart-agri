import React, { useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  Modal, TextInput, Alert, KeyboardAvoidingView, Platform, SafeAreaView,
} from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS } from '../../../theme';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../../store';
import { respondToAdvice } from '../../../store/adviceSlice';
import {
  MessageSquare, CheckCircle, Clock, Calendar, Send, User, Stethoscope,
} from 'lucide-react-native';

export const ExpertAdviceListScreen = () => {
  const dispatch = useDispatch();
  const allRequests = useSelector((state: RootState) => state.advice.requests);

  const [filter, setFilter] = useState<'All' | 'Pending' | 'Completed'>('All');
  const [selectedReq, setSelectedReq] = useState<any>(null);
  const [responseText, setResponseText] = useState('');
  const [responseError, setResponseError] = useState('');

  const filtered = allRequests.filter(r => filter === 'All' || r.status === filter);

  const pendingCount = allRequests.filter(r => r.status === 'Pending').length;

  const openRequest = (item: any) => {
    setSelectedReq(item);
    setResponseText(item.adminResponse || '');
    setResponseError('');
  };

  const handleRespond = () => {
    if (!responseText.trim()) {
      setResponseError('Please enter your response before sending.');
      return;
    }
    dispatch(respondToAdvice({ id: selectedReq.id, response: responseText.trim() }));
    setSelectedReq(null);
    setResponseText('');
    Alert.alert('Response Sent', 'The farmer has been notified with your expert advice.');
  };

  const renderItem = ({ item }: { item: any }) => {
    const isPending = item.status === 'Pending';
    return (
      <TouchableOpacity
        style={[styles.card, isPending ? styles.pendingCard : styles.completedCard]}
        onPress={() => openRequest(item)}
        activeOpacity={0.85}
      >
        <View style={styles.cardTop}>
          <View style={styles.farmerInfo}>
            <User size={14} color={COLORS.primary} />
            <Text style={styles.farmerName}>{item.farmerName}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: isPending ? '#FFF3E0' : '#E8F5E9' }]}>
            {isPending
              ? <Clock size={12} color="#E65100" />
              : <CheckCircle size={12} color={COLORS.success} />}
            <Text style={[styles.badgeText, { color: isPending ? '#E65100' : COLORS.success }]}>
              {item.status}
            </Text>
          </View>
        </View>

        <Text style={styles.reqTitle}>{item.title}</Text>
        <Text style={styles.reqDesc} numberOfLines={2}>{item.description}</Text>

        <View style={styles.cardFooter}>
          <View style={styles.dateRow}>
            <Calendar size={12} color="#999" />
            <Text style={styles.dateText}>{item.createdAt}</Text>
          </View>
          {isPending && (
            <View style={styles.respondHint}>
              <Text style={styles.respondHintText}>Tap to respond →</Text>
            </View>
          )}
          {!isPending && item.respondedAt && (
            <Text style={styles.respondedAt}>Replied {item.respondedAt}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Filter Bar */}
      <View style={styles.filterBar}>
        {(['All', 'Pending', 'Completed'] as const).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.pill, filter === f && styles.pillActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.pillText, filter === f && styles.pillTextActive]}>
              {f}{f === 'Pending' && pendingCount > 0 ? ` (${pendingCount})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MessageSquare size={48} color="#DDD" />
            <Text style={styles.emptyText}>
              {filter === 'Pending' ? 'No pending requests.' : 'No requests found.'}
            </Text>
          </View>
        }
      />

      {/* Respond Modal */}
      <Modal visible={!!selectedReq} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modal}>
            <View style={styles.sheetHandle} />

            <View style={styles.reqHeader}>
              <View style={[
                styles.badge,
                { backgroundColor: selectedReq?.status === 'Pending' ? '#FFF3E0' : '#E8F5E9' }
              ]}>
                <Text style={[
                  styles.badgeText,
                  { color: selectedReq?.status === 'Pending' ? '#E65100' : COLORS.success }
                ]}>
                  {selectedReq?.status}
                </Text>
              </View>
              <Text style={styles.reqFarmer}>{selectedReq?.farmerName}</Text>
            </View>

            <Text style={styles.modalTitle}>{selectedReq?.title}</Text>
            <View style={styles.issueBox}>
              <Text style={styles.issueText}>{selectedReq?.description}</Text>
              <Text style={styles.issueDate}>Submitted: {selectedReq?.createdAt}</Text>
            </View>

            <View style={styles.responseLabelRow}>
              <Stethoscope size={15} color={COLORS.primary} />
              <Text style={styles.responseLabel}>
                {selectedReq?.status === 'Pending' ? 'Write Expert Response' : 'Sent Response'}
              </Text>
            </View>

            <TextInput
              style={[styles.responseInput, !!responseError && styles.inputError]}
              placeholder="Enter your expert recommendation, treatment plan, or advice..."
              multiline
              numberOfLines={5}
              value={responseText}
              onChangeText={v => { setResponseText(v); setResponseError(''); }}
              textAlignVertical="top"
              editable={selectedReq?.status === 'Pending'}
            />
            {!!responseError && <Text style={styles.errorText}>{responseError}</Text>}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => { setSelectedReq(null); setResponseText(''); setResponseError(''); }}
              >
                <Text style={styles.closeBtnText}>Close</Text>
              </TouchableOpacity>
              {selectedReq?.status === 'Pending' && (
                <TouchableOpacity style={styles.sendBtn} onPress={handleRespond}>
                  <Send size={16} color="#FFF" />
                  <Text style={styles.sendBtnText}>Send Response</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  filterBar: {
    flexDirection: 'row', padding: SPACING.md,
    backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#EEE',
    gap: SPACING.sm,
  },
  pill: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, backgroundColor: '#F5F5F5',
  },
  pillActive: { backgroundColor: COLORS.primary },
  pillText: { color: '#666', fontWeight: '500', fontSize: 13 },
  pillTextActive: { color: '#FFF', fontWeight: 'bold' },
  list: { padding: SPACING.md },
  card: {
    backgroundColor: '#FFF', borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg, marginBottom: SPACING.md,
    elevation: 2, shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5,
    borderLeftWidth: 4,
  },
  pendingCard: { borderLeftColor: '#FF8F00' },
  completedCard: { borderLeftColor: COLORS.success },
  cardTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: SPACING.sm,
  },
  farmerInfo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  farmerName: { fontSize: 14, fontWeight: 'bold', color: '#333' },
  badge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12, gap: 4,
  },
  badgeText: { fontSize: 12, fontWeight: 'bold' },
  reqTitle: { fontSize: 15, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 4 },
  reqDesc: { fontSize: 13, color: '#666', lineHeight: 18, marginBottom: SPACING.md },
  cardFooter: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F0F0F0', paddingTop: SPACING.sm,
  },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dateText: { fontSize: 12, color: '#999' },
  respondHint: {
    backgroundColor: '#E8F5E9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
  },
  respondHintText: { fontSize: 12, color: COLORS.success, fontWeight: '600' },
  respondedAt: { fontSize: 12, color: '#999' },
  empty: { padding: 60, alignItems: 'center' },
  emptyText: { marginTop: SPACING.md, fontSize: 15, color: '#999' },
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: SPACING.xl, paddingBottom: 40,
  },
  sheetHandle: {
    width: 40, height: 4, backgroundColor: '#DDD',
    borderRadius: 2, alignSelf: 'center', marginBottom: SPACING.lg,
  },
  reqHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  reqFarmer: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  modalTitle: { fontSize: 17, fontWeight: 'bold', color: '#1A1A1A', marginBottom: SPACING.sm },
  issueBox: {
    backgroundColor: '#F5F7FA', borderRadius: 10,
    padding: SPACING.md, marginBottom: SPACING.lg,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  issueText: { fontSize: 14, color: '#444', lineHeight: 20 },
  issueDate: { fontSize: 11, color: '#999', marginTop: 6 },
  responseLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SPACING.sm },
  responseLabel: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  responseInput: {
    backgroundColor: '#F7F9FC', borderRadius: 10,
    borderWidth: 1.5, borderColor: '#E0E6EE',
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: '#333', minHeight: 110,
  },
  inputError: { borderColor: COLORS.error },
  errorText: { fontSize: 12, color: COLORS.error, marginTop: 4 },
  modalActions: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.lg },
  closeBtn: {
    flex: 1, padding: 14, borderRadius: BORDER_RADIUS.md,
    backgroundColor: '#F5F5F5', alignItems: 'center',
  },
  closeBtnText: { fontSize: 15, fontWeight: '600', color: COLORS.textSecondary },
  sendBtn: {
    flex: 2, flexDirection: 'row', padding: 14, borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  sendBtnText: { fontSize: 15, fontWeight: 'bold', color: '#FFF' },
});
