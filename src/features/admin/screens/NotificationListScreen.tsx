import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, Alert, Platform } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS } from '../../../theme';
import { Bell, Trash2, Plus } from 'lucide-react-native';
import { api } from '../../../services/api';
import { LoadingState, EmptyState, ErrorState } from '../../../components/States';

interface ApiNotif {
  notifId: string;
  title: string;
  message: string;
  type: string;
  createdAt: string;
}

export const NotificationListScreen = ({ navigation }: any) => {
  const [notifs,      setNotifs]      = useState<ApiNotif[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [nextCursor,  setNextCursor]  = useState<string | undefined>();
  const [loadingMore, setLoadingMore] = useState(false);

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

  useEffect(() => { fetchNotifs(); }, [fetchNotifs]);

  const handleDelete = (notifId: string) => {
    Alert.alert('Delete', 'Remove this notification?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/notifications/${notifId}`);
            setNotifs(prev => prev.filter(n => n.notifId !== notifId));
          } catch (err: any) {
            Alert.alert('Error', err?.message ?? 'Failed to delete');
          }
        },
      },
    ]);
  };

  const renderItem = useCallback(({ item }: { item: ApiNotif }) => (
    <View style={styles.card}>
      <Bell size={18} color={COLORS.primary} style={{ marginRight: 10, marginTop: 2 }} />
      <View style={styles.content}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.message}>{item.message}</Text>
        <Text style={styles.date}>{item.createdAt.split('T')[0]}</Text>
      </View>
      <TouchableOpacity onPress={() => handleDelete(item.notifId)}>
        <Trash2 size={18} color="#e74c3c" />
      </TouchableOpacity>
    </View>
  ), []);

  if (loading) return <LoadingState />;
  if (error)   return <ErrorState error={error} />;

  return (
    <SafeAreaView style={styles.safe}>
      <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('AddNotification', { onAdded: fetchNotifs })}>
        <Plus size={20} color="#fff" />
        <Text style={styles.addBtnText}>New Notification</Text>
      </TouchableOpacity>
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: COLORS.background },
  addBtn:     { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, margin: SPACING.md, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, justifyContent: 'center', gap: 8 },
  addBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  list:       { paddingHorizontal: SPACING.md, paddingBottom: SPACING.md },
  card:       { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2 },
  content:    { flex: 1 },
  title:      { fontSize: 15, fontWeight: 'bold', color: COLORS.text },
  message:    { fontSize: 14, color: COLORS.textSecondary, marginTop: 4 },
  date:       { fontSize: 12, color: COLORS.textSecondary, marginTop: 6 },
});
