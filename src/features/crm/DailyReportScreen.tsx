import React, { useState } from 'react';
import { Text } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { crmApi, teamApi } from '../../services/platform';
import { useApi, useAuth } from '../../hooks/useApi';
import { Page, Section, Stat, StatGrid, Row, Button, Select, ListRow, Tag, Loading, ErrorView, Empty, humanize, formatDate } from '../../ui';
import { TOKENS, TYPE } from '../../theme';

const shift = (day: string, n: number) => { const d = new Date(`${day}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/** What one person did on a day — calls, WhatsApp, visits, completed tasks — from recorded activity. */
export const DailyReportScreen = ({ navigation }: any) => {
  const { can, user } = useAuth();
  const [day, setDay] = useState(new Date().toISOString().slice(0, 10));
  const [userId, setUserId] = useState<string>('');
  const team = useApi(async () => {
    if (!can('reports.team')) return [];
    const [s, e] = await Promise.all([teamApi.assignable('STAFF'), teamApi.assignable('EXPERT')]);
    return [...s.items, ...e.items];
  }, [], { focus: false });
  const { data, loading, error, reload, refreshing, refresh } = useApi(() => crmApi.dailyReport(day, userId || undefined), [day, userId]);
  const c = data?.counts;

  return (
    <Page refreshing={refreshing} onRefresh={refresh}>
      {can('reports.team') && (
        <Select value={userId} onChange={setUserId} title="Team member"
                options={[{ label: `Me (${user?.name})`, value: '' }, ...(team.data ?? []).map(u => ({ label: u.name, value: u.userId, description: humanize(u.role) }))]} />
      )}
      <Row style={{ justifyContent: 'space-between' }}>
        <Button title="" icon={ChevronLeft} size="sm" onPress={() => setDay(shift(day, -1))} accessibilityLabel="Previous day" />
        <Text style={TYPE.h3}>{new Date(`${day}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</Text>
        <Button title="" icon={ChevronRight} size="sm" disabled={day >= new Date().toISOString().slice(0, 10)} onPress={() => setDay(shift(day, 1))} accessibilityLabel="Next day" />
      </Row>
      {loading ? <Loading /> : error || !data ? <ErrorView message={error ?? 'Failed'} onRetry={reload} /> : (
        <>
          <StatGrid>
            <Stat label="Calls logged" value={c.callsLogged} hint={`${c.callsConnected} connected`} />
            <Stat label="WhatsApp" value={c.whatsapp} />
            <Stat label="Field visits" value={c.fieldVisits} />
            <Stat label="Tasks completed" value={c.tasksCompleted} hint={`${c.tasksDue} were due`} />
            <Stat label="Leads created" value={c.leadsCreated} />
            <Stat label="Stage changes" value={c.stageChanges} />
            <Stat label="Quotation actions" value={c.quotationActions} />
            <Stat label="Notes" value={c.notes} />
          </StatGrid>
          {!!data.fieldVisits.length && (
            <Section title="Field visits">
              {data.fieldVisits.map((v: any) => (
                <ListRow key={v.taskId} title={v.title} subtitle={v.visitReport || 'No report yet'}
                         meta={`${v.customerName ?? ''}${v.checkIns?.length ? ` · checked in ${formatDate(v.checkIns[v.checkIns.length - 1].at)}` : ''}`}
                         onPress={() => navigation.navigate('TaskForm', { taskId: v.taskId })} />
              ))}
            </Section>
          )}
          <Section title="Timeline">
            {!data.timeline.length && <Empty title="No recorded activity this day" />}
            {data.timeline.map((a: any) => (
              <ListRow key={a.activityId} left={<Tag text={humanize(a.type)} small />} title={<Text style={TYPE.body}>{a.text}</Text>}
                       meta={new Date(a.createdAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
                       onPress={() => navigation.navigate('LeadDetail', { id: a.leadId })} />
            ))}
          </Section>
          <Text style={[TYPE.caption, { color: TOKENS.colorTextTertiary }]}>Counts come from activity recorded in the app. Calls count only when an outcome was logged.</Text>
        </>
      )}
    </Page>
  );
};
