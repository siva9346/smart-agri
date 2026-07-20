import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, BORDER_RADIUS } from '../../theme';
import { Bell, X } from 'lucide-react-native';
import { api } from '../../services/api';
import { LoadingState, EmptyState, ErrorState } from '../../components/States';

interface ApiNotif {
  notifId: string;
  title: string;
  message: string;
  type: string;
  createdAt: string;
}

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
};

export const NotificationsScreen = () => {
  const [notifs,     setNotifs]     = useState<ApiNotif[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [loadingMore, setLoadingMore] = useState(false);
  const [selected,   setSelected]   = useState<ApiNotif | null>(null);

  const fetchNotifs = useCallback(async (cursor?: string) => {
    if (cursor) setLoadingMore(true); else setLoading(true);
    try {
      const path = cursor ? `/notifications?cursor=${cursor}` : '/notifications';
      const res  = await api.get<{ items: ApiNotif[]; nextCursor?: string }>(path);
      setNotifs(prev => cursor ? [...prev, ...res.items] : res.items);
      setNextCursor(res.nextCursor);
      setError(null);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load notifications');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchNotifs(); }, [fetchNotifs]));

  const renderItem = useCallback(({ item }: { item: ApiNotif }) => (
    <TouchableOpacity style={styles.card} onPress={() => setSelected(item)} activeOpacity={0.75}>
      <View style={styles.iconCircle}>
        <Bell size={18} color={COLORS.primary} />
      </View>
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.message} numberOfLines={2}>{item.message}</Text>
        <Text style={styles.date}>{formatDateTime(item.createdAt)}</Text>
      </View>
    </TouchableOpacity>
  ), []);

  if (loading) return <LoadingState />;
  if (error)   return <ErrorState error={error} />;

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={notifs}
        keyExtractor={i => i.notifId}
        contentContainerStyle={styles.list}
        renderItem={renderItem}
        onEndReached={() => nextCursor && !loadingMore && fetchNotifs(nextCursor)}
        onEndReachedThreshold={0.4}
        removeClippedSubviews={Platform.OS === 'android'}
        ListEmptyComponent={<EmptyState message="No notifications yet" />}
      />

      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.iconCircle}>
                <Bell size={18} color={COLORS.primary} />
              </View>
              <TouchableOpacity onPress={() => setSelected(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={22} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalTitle}>{selected?.title}</Text>
            <Text style={styles.modalDate}>{selected ? formatDateTime(selected.createdAt) : ''}</Text>
            <Text style={styles.modalMessage}>{selected?.message}</Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  list: { padding: SPACING.md },
  card: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md, marginBottom: SPACING.sm,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2,
  },
  iconCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#E8F5E9', justifyContent: 'center', alignItems: 'center',
    marginRight: SPACING.sm,
  },
  content: { flex: 1 },
  title: { fontSize: 15, fontWeight: 'bold', color: COLORS.text },
  message: { fontSize: 13, color: COLORS.textSecondary, marginTop: 3 },
  date: { fontSize: 11, color: COLORS.textSecondary, marginTop: 6 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: SPACING.lg },
  modalCard: { backgroundColor: '#FFF', borderRadius: BORDER_RADIUS.lg, padding: SPACING.lg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text, marginBottom: 4 },
  modalDate: { fontSize: 12, color: COLORS.textSecondary, marginBottom: SPACING.md },
  modalMessage: { fontSize: 15, color: COLORS.text, lineHeight: 22 },
});
