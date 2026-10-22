import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { Plus, BarChart3, Trash2 } from 'lucide-react-native';
import { announcementApi } from '../../../services/platform';
import { usePaged } from '../../../hooks/useApi';
import { Button, Row, Tag, Sheet, StatGrid, Stat, ConfirmDialog, Loading, ErrorView, Empty, formatDate, humanize, toast } from '../../../ui';
import { TOKENS, TYPE } from '../../../theme';

/** Announcement history with per-announcement delivery / read statistics. */
export const AnnouncementsScreen = ({ navigation }: any) => {
  const list = usePaged(cursor => announcementApi.list(cursor), []);
  const [stats, setStats] = useState<{ title: string; data: any } | null>(null);
  const [remove, setRemove] = useState<any>(null);
  const sorted = [...list.items].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

  const showStats = async (n: any) => {
    try {
      setStats({ title: n.title, data: await announcementApi.stats(n.notifId) });
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  return (
    <View style={styles.root}>
      {list.loading ? <Loading /> : list.error ? <ErrorView message={list.error} onRetry={list.reload} /> : (
        <FlatList data={sorted} keyExtractor={n => n.notifId} contentContainerStyle={styles.list}
                  onEndReached={list.loadMore} refreshing={list.refreshing} onRefresh={list.refresh}
                  ListEmptyComponent={<Empty title="No announcements yet" />}
                  renderItem={({ item }) => (
                    <View style={styles.card}>
                      <Row style={{ justifyContent: 'space-between' }}>
                        <Text style={[TYPE.h3, { flex: 1 }]} numberOfLines={1}>{item.title}</Text>
                        <Tag text={humanize(item.type ?? 'GENERAL')} small color={item.type === 'IMPORTANT' || item.type === 'MAINTENANCE' ? 'orange' : 'green'} />
                      </Row>
                      <Text style={TYPE.secondary} numberOfLines={2}>{item.message}</Text>
                      <Row gap={6} wrap>
                        <Tag text={item.audience ? humanize(item.audience) : `Legacy · ${item.targetRole}`} small />
                        {item.deliveryStatus && <Tag text={humanize(item.deliveryStatus)} small color={item.deliveryStatus === 'COMPLETED' ? 'green' : item.deliveryStatus === 'FAILED' ? 'red' : 'gold'} />}
                        {item.recipientCount != null && <Text style={TYPE.caption}>{item.recipientCount} recipients</Text>}
                        <Text style={[TYPE.caption, { marginLeft: 'auto' }]}>{formatDate(item.createdAt)}</Text>
                      </Row>
                      {(item.startsAt || item.expiresAt) && (
                        <Text style={TYPE.caption}>{item.startsAt ? `From ${formatDate(item.startsAt)}` : ''}{item.expiresAt ? ` · until ${formatDate(item.expiresAt)}` : ''}</Text>
                      )}
                      <Row gap={8}>
                        {item.audience && <Button title="Delivery stats" icon={BarChart3} size="sm" onPress={() => showStats(item)} />}
                        <Button title="Delete" icon={Trash2} size="sm" type="danger" onPress={() => setRemove(item)} />
                      </Row>
                    </View>
                  )} />
      )}
      <View style={styles.fab}>
        <Button title="New announcement" type="primary" icon={Plus} onPress={() => navigation.navigate('AnnouncementComposer')} />
      </View>

      <Sheet visible={!!stats} onClose={() => setStats(null)} title={stats?.title}>
        {stats && (
          <View style={{ gap: 10 }}>
            <StatGrid>
              <Stat label="Recipients" value={stats.data.recipients} />
              <Stat label="Delivered in app" value={stats.data.delivered} hint="Fetched by the recipient's app" />
              <Stat label="Read" value={stats.data.read} />
              <Stat label="Dismissed" value={stats.data.dismissed} />
            </StatGrid>
            {Object.entries(stats.data.channelStatus ?? {}).map(([ch, st]) => (
              <Text key={ch} style={TYPE.secondary}>{ch.replace('_', '-')}: {humanize(String(st))}</Text>
            ))}
          </View>
        )}
      </Sheet>
      <ConfirmDialog visible={!!remove} title="Delete announcement?" danger confirmText="Delete"
                     message="It will also be removed from every recipient's notification center."
                     onCancel={() => setRemove(null)}
                     onConfirm={async () => {
                       const n = remove; setRemove(null);
                       try { await announcementApi.remove(n.notifId); toast('Deleted'); list.reload(); } catch (e: any) { toast(e.message, 'error'); }
                     }} />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: TOKENS.colorBgLayout },
  list: { padding: 16, gap: 10, paddingBottom: 96, flexGrow: 1 },
  card: { backgroundColor: '#FFF', borderRadius: TOKENS.radius, borderWidth: 1, borderColor: TOKENS.colorBorder, padding: 14, gap: 8 },
  fab: { position: 'absolute', right: 16, bottom: 24 },
});
