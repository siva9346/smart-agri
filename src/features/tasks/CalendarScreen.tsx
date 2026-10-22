import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react-native';
import { taskApi, Task } from '../../services/platform';
import { useApi, useAuth } from '../../hooks/useApi';
import { Page, Section, Segmented, Button, Row, ListRow, StatusTag, Tag, Loading, ErrorView, humanize } from '../../ui';
import { TOKENS, TYPE } from '../../theme';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const KIND_COLOR: Record<string, string> = { FOLLOW_UP: '#1677FF', APPOINTMENT: '#722ED1', TASK: '#8C8C8C', FIELD_VISIT: '#2E7D32' };
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Month calendar of follow-ups, appointments, field visits and tasks (local time). */
export const CalendarScreen = ({ navigation }: any) => {
  const { can } = useAuth();
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [selected, setSelected] = useState(ymd(new Date()));
  const [scope, setScope] = useState('mine');

  const from = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const to = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59);
  const { data, loading, error, reload, refreshing, refresh } = useApi(
    () => taskApi.list({ scope, from: from.toISOString(), to: to.toISOString(), status: '' }),
    [cursor.getTime(), scope],
  );

  const byDay = useMemo(() => {
    const m: Record<string, Task[]> = {};
    for (const t of data?.items ?? []) (m[ymd(new Date(t.dueAt))] ??= []).push(t);
    return m;
  }, [data]);

  const cells = useMemo(() => {
    const lead = (from.getDay() + 6) % 7;  // Monday-first
    const days = to.getDate();
    return [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => new Date(cursor.getFullYear(), cursor.getMonth(), i + 1))];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor]);

  const today = ymd(new Date());
  const dayTasks = (byDay[selected] ?? []).sort((a, b) => a.dueAt.localeCompare(b.dueAt));

  return (
    <Page refreshing={refreshing} onRefresh={refresh}>
      {can('tasks.assign_others') && (
        <Segmented value={scope} onChange={setScope} options={[{ label: 'My calendar', value: 'mine' }, { label: 'Team', value: 'team' }]} />
      )}
      <Section>
        <Row style={{ justifyContent: 'space-between' }}>
          <TouchableOpacity onPress={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} hitSlop={12} accessibilityLabel="Previous month">
            <ChevronLeft size={22} color={TOKENS.colorText} />
          </TouchableOpacity>
          <Text style={TYPE.h2}>{cursor.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</Text>
          <TouchableOpacity onPress={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} hitSlop={12} accessibilityLabel="Next month">
            <ChevronRight size={22} color={TOKENS.colorText} />
          </TouchableOpacity>
        </Row>
        {loading ? <Loading /> : error ? <ErrorView message={error} onRetry={reload} /> : (
          <View>
            <View style={styles.grid}>
              {WEEKDAYS.map(w => <Text key={w} style={[styles.cell, styles.weekday]}>{w}</Text>)}
              {cells.map((d, i) => {
                if (!d) return <View key={`e${i}`} style={styles.cell} />;
                const key = ymd(d);
                const items = byDay[key] ?? [];
                const overdue = items.some(t => t.isOverdue);
                return (
                  <TouchableOpacity key={key} style={[styles.cell, styles.day, key === selected && styles.selected]} onPress={() => setSelected(key)}
                                    accessibilityLabel={`${d.toDateString()}, ${items.length} items`}>
                    <Text style={[TYPE.body, key === today && { color: TOKENS.colorPrimary, fontWeight: '700' }]}>{d.getDate()}</Text>
                    <View style={styles.dots}>
                      {items.slice(0, 3).map(t => <View key={t.taskId} style={[styles.dot, { backgroundColor: overdue ? TOKENS.colorError : KIND_COLOR[t.kind] }]} />)}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Row gap={10} wrap style={{ marginTop: 8 }}>
              {Object.entries(KIND_COLOR).map(([k, c]) => (
                <Row key={k} gap={4}><View style={[styles.dot, { backgroundColor: c }]} /><Text style={TYPE.caption}>{humanize(k)}</Text></Row>
              ))}
            </Row>
          </View>
        )}
      </Section>

      <Section title={new Date(`${selected}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
               extra={<Button title="Add" size="sm" type="text" icon={Plus} onPress={() => navigation.navigate('TaskForm', { kind: 'FOLLOW_UP' })} />}>
        {!dayTasks.length && <Text style={TYPE.secondary}>Nothing scheduled.</Text>}
        {dayTasks.map(t => (
          <ListRow key={t.taskId} title={t.title}
                   subtitle={`${new Date(t.dueAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}${t.customerName ? ' · ' + t.customerName : ''}${scope === 'team' ? ' · ' + t.assigneeName : ''}`}
                   meta={<Row gap={6}><Tag text={humanize(t.kind)} small />{t.isOverdue && <Tag text="Overdue" color="red" small />}</Row>}
                   right={<StatusTag status={t.status} small />}
                   onPress={() => navigation.navigate('TaskForm', { taskId: t.taskId })} />
        ))}
      </Section>
    </Page>
  );
};

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  cell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 6, minHeight: 48 },
  weekday: { fontSize: 11.5, color: TOKENS.colorTextTertiary, fontWeight: '600', minHeight: 24 },
  day: { borderRadius: 10 },
  selected: { backgroundColor: TOKENS.colorPrimaryBg },
  dots: { flexDirection: 'row', gap: 3, marginTop: 4, height: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
