import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, SectionList, TouchableOpacity, StyleSheet } from 'react-native';
import { Plus, Phone, CalendarClock, ClipboardList, MessageCircle, MapPin } from 'lucide-react-native';
import { taskApi, Task } from '../../services/platform';
import { usePaged, useAuth } from '../../hooks/useApi';
import { Loading, ErrorView, Empty, Segmented, Button, StatusTag, Tag, formatDate, humanize } from '../../ui';
import { TOKENS, TYPE } from '../../theme';

const KIND_ICON: Record<string, any> = { FOLLOW_UP: Phone, APPOINTMENT: CalendarClock, TASK: ClipboardList, FIELD_VISIT: MapPin };
const FOLLOW_ICON: Record<string, any> = { WHATSAPP: MessageCircle, VISIT: MapPin };

/** Calendar-style agenda grouped by day, with overdue items pinned on top. */
export const TaskListScreen = ({ navigation, route }: any) => {
  const { can } = useAuth();
  const [scope, setScope] = useState<string>('mine');
  const [kind, setKind] = useState<string>(route.params?.kind ?? '');
  const [status, setStatus] = useState<string>(route.params?.overdue ? 'OVERDUE' : 'OPEN');
  const list = usePaged(
    cursor => taskApi.list({ scope, kind: kind || undefined, status: status === 'OVERDUE' ? 'OPEN' : status || undefined,
                             overdue: status === 'OVERDUE' ? '1' : undefined }, cursor),
    [scope, kind, status],
  );

  const sections = useMemo(() => {
    const groups: Record<string, Task[]> = {};
    for (const t of list.items) {
      const key = t.isOverdue ? 'Overdue' : new Date(t.dueAt).toDateString();
      (groups[key] ??= []).push(t);
    }
    const today = new Date().toDateString();
    const tomorrow = new Date(Date.now() + 86400000).toDateString();
    return Object.entries(groups)
      .sort(([a], [b]) => (a === 'Overdue' ? -1 : b === 'Overdue' ? 1 : new Date(a).getTime() - new Date(b).getTime()))
      .map(([title, data]) => ({ title: title === today ? 'Today' : title === tomorrow ? 'Tomorrow' : title, data }));
  }, [list.items]);

  const renderItem = useCallback(({ item }: { item: Task }) => {
    const Icon = (item.followUpType && FOLLOW_ICON[item.followUpType]) || KIND_ICON[item.kind] || ClipboardList;
    return (
      <TouchableOpacity style={[styles.card, item.isOverdue && styles.overdue]} activeOpacity={0.7}
                        onPress={() => navigation.navigate('TaskForm', { taskId: item.taskId })}>
        <View style={styles.icon}><Icon size={18} color={item.isOverdue ? TOKENS.colorError : TOKENS.colorPrimary} /></View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={TYPE.h3} numberOfLines={1}>{item.title}</Text>
          <Text style={TYPE.secondary} numberOfLines={1}>
            {new Date(item.dueAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
            {item.customerName ? ` · ${item.customerName}` : ''}{scope === 'team' ? ` · ${item.assigneeName}` : ''}
          </Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Tag text={humanize(item.kind)} small />
            {item.priority !== 'MEDIUM' && <StatusTag status={item.priority} small />}
            {item.status !== 'OPEN' && <StatusTag status={item.status} small />}
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [navigation, scope]);

  return (
    <View style={styles.root}>
      <View style={styles.toolbar}>
        {can('tasks.assign_others') && (
          <Segmented value={scope} onChange={setScope} options={[{ label: 'Mine', value: 'mine' }, { label: 'Team', value: 'team' }]} />
        )}
        <Segmented value={kind} onChange={setKind} options={[
          { label: 'All types', value: '' }, { label: 'Follow-ups', value: 'FOLLOW_UP' },
          { label: 'Appointments', value: 'APPOINTMENT' }, { label: 'Field visits', value: 'FIELD_VISIT' }, { label: 'Tasks', value: 'TASK' }]} />
        <Segmented value={status} onChange={setStatus} options={[
          { label: 'Open', value: 'OPEN' }, { label: 'Overdue', value: 'OVERDUE' },
          { label: 'Completed', value: 'COMPLETED' }, { label: 'All', value: '' }]} />
      </View>
      {list.loading ? <Loading /> : list.error ? <ErrorView message={list.error} onRetry={list.reload} /> : (
        <SectionList
          sections={sections}
          keyExtractor={t => t.taskId}
          renderItem={renderItem}
          renderSectionHeader={({ section }) => (
            <Text style={[styles.header, section.title === 'Overdue' && { color: TOKENS.colorError }]}>{section.title}</Text>
          )}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          onEndReached={list.loadMore}
          refreshing={list.refreshing}
          onRefresh={list.refresh}
          ListEmptyComponent={<Empty title="Nothing scheduled" description="Follow-ups, appointments and tasks assigned to you appear here." />}
        />
      )}
      <View style={styles.fab}>
        <Button title="New" type="primary" icon={Plus} onPress={() => navigation.navigate('TaskForm', { kind: kind || 'TASK' })} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: TOKENS.colorBgLayout },
  toolbar: { paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  list: { padding: 16, paddingBottom: 96, gap: 8, flexGrow: 1 },
  header: { ...TYPE.label, marginTop: 8, marginBottom: 2, textTransform: 'uppercase' },
  card: { flexDirection: 'row', gap: 12, backgroundColor: '#FFF', borderRadius: TOKENS.radius, padding: 12, borderWidth: 1, borderColor: TOKENS.colorBorder },
  overdue: { borderColor: '#FFA39E', backgroundColor: '#FFFAFA' },
  icon: { width: 36, height: 36, borderRadius: 18, backgroundColor: TOKENS.colorPrimaryBg, alignItems: 'center', justifyContent: 'center' },
  fab: { position: 'absolute', right: 16, bottom: 24 },
});
