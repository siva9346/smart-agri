import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Platform } from 'react-native';
import { useDispatch } from 'react-redux';
import { Bell, CheckCheck, AlertTriangle, ClipboardList, FileText, Stethoscope } from 'lucide-react-native';
import { inboxApi, InboxItem } from '../../services/platform';
import { usePaged, useAuth } from '../../hooks/useApi';
import { refreshUnreadCount } from './useUnreadNotifications';
import { openActionLink } from '../../navigation/actionLinks';
import { Loading, ErrorView, Empty, Segmented, Sheet, Button, Tag, formatDate, timeAgo, humanize, toast } from '../../ui';
import { TOKENS, TYPE } from '../../theme';

const ICONS: Record<string, any> = {
  CONSULTATION: Stethoscope, ASSIGNMENT: Stethoscope, QUOTATION: FileText, CRM_TASK: ClipboardList,
  REMINDER: ClipboardList, IMPORTANT: AlertTriangle, MAINTENANCE: AlertTriangle, ESCALATION: AlertTriangle,
};

// Notification Center: full per-user history (independent of banner dismissal).
export const NotificationsScreen = () => {
  const dispatch = useDispatch();
  const { role } = useAuth();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [selected, setSelected] = useState<InboxItem | null>(null);
  const list = usePaged(cursor => inboxApi.list(cursor), []);

  const markRead = useCallback(async (item: InboxItem) => {
    if (item.isRead) return;
    list.setItems(prev => prev.map(i => i.recipientKey === item.recipientKey ? { ...i, isRead: true } : i));
    try {
      await inboxApi.read(item.recipientKey);
      refreshUnreadCount(dispatch);
    } catch {
      list.reload();
    }
  }, [dispatch, list]);

  const openItem = useCallback((item: InboxItem) => {
    setSelected(item);
    markRead(item);
  }, [markRead]);

  const readAll = async () => {
    try {
      const res = await inboxApi.readAll();
      list.setItems(prev => prev.map(i => ({ ...i, isRead: true })));
      refreshUnreadCount(dispatch);
      toast(res.updated ? `Marked ${res.updated} as read` : 'Everything is already read', 'info');
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  const data = filter === 'unread' ? list.items.filter(i => !i.isRead) : list.items;

  const renderItem = useCallback(({ item }: { item: InboxItem }) => {
    const Icon = ICONS[item.type] ?? Bell;
    return (
      <TouchableOpacity style={[styles.card, !item.isRead && styles.unread]} onPress={() => openItem(item)} activeOpacity={0.7}
                        accessibilityLabel={`${item.isRead ? '' : 'Unread. '}${item.title}`}>
        <View style={styles.icon}><Icon size={18} color={TOKENS.colorPrimary} /></View>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {!item.isRead && <View style={styles.dot} />}
            <Text style={[TYPE.h3, { flex: 1, fontSize: 14.5 }, !item.isRead && { fontWeight: '700' }]} numberOfLines={1}>{item.title}</Text>
            <Text style={TYPE.caption}>{timeAgo(item.createdAt)}</Text>
          </View>
          <Text style={TYPE.secondary} numberOfLines={2}>{item.message}</Text>
          {(item.isExpired || item.priority === 'HIGH') && (
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 2 }}>
              {item.priority === 'HIGH' && <Tag text="High priority" color="orange" small />}
              {item.isExpired && <Tag text="Expired" small />}
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }, [openItem]);

  if (list.loading) return <Loading />;
  if (list.error) return <ErrorView message={list.error} onRetry={list.reload} />;

  return (
    <View style={styles.safe}>
      <View style={styles.toolbar}>
        <Segmented value={filter} onChange={setFilter}
                   options={[{ label: 'All', value: 'all' }, { label: 'Unread', value: 'unread' }]} />
        <Button title="Mark all read" type="text" size="sm" icon={CheckCheck} onPress={readAll} />
      </View>
      <FlatList
        data={data}
        keyExtractor={i => i.recipientKey}
        contentContainerStyle={styles.list}
        renderItem={renderItem}
        onEndReached={list.loadMore}
        onEndReachedThreshold={0.4}
        refreshing={list.refreshing}
        onRefresh={list.refresh}
        removeClippedSubviews={Platform.OS === 'android'}
        ListEmptyComponent={<Empty title={filter === 'unread' ? 'All caught up' : 'No notifications yet'}
                                   description="Announcements, consultation updates and reminders appear here." />}
      />

      <Sheet visible={!!selected} onClose={() => setSelected(null)} title={selected?.title}
             footer={selected?.actionLink ? (
               <Button title="Open" type="primary" block onPress={() => {
                 const link = selected.actionLink;
                 setSelected(null);
                 openActionLink(link, role);
               }} />
             ) : undefined}>
        {selected && (
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              <Tag text={humanize(selected.type)} color="green" />
              {selected.priority !== 'NORMAL' && <Tag text={`${humanize(selected.priority)} priority`} color="orange" />}
            </View>
            <Text style={TYPE.caption}>{formatDate(selected.createdAt)}{selected.expiresAt ? ` · expires ${formatDate(selected.expiresAt)}` : ''}</Text>
            <Text style={[TYPE.body, { fontSize: 15.5, lineHeight: 23 }]}>{selected.message}</Text>
          </View>
        )}
      </Sheet>
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TOKENS.colorBgLayout },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12 },
  list: { padding: 16, gap: 8, flexGrow: 1 },
  card: {
    flexDirection: 'row', gap: 12, backgroundColor: '#FFF', borderRadius: TOKENS.radius, padding: 14,
    borderWidth: 1, borderColor: TOKENS.colorBorder,
  },
  unread: { borderColor: TOKENS.colorPrimaryBorder, backgroundColor: '#FBFEFB' },
  icon: { width: 36, height: 36, borderRadius: 18, backgroundColor: TOKENS.colorPrimaryBg, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: TOKENS.colorPrimary },
});
