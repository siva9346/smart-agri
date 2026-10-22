import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { crmApi } from '../../services/platform';
import { useApi } from '../../hooks/useApi';
import { AiAssistPanel } from '../ai/AiAssistPanel';
import { Page, Section, Segmented, Row, Tag, KeyValue, Loading, ErrorView, Empty, formatMoney } from '../../ui';
import { TOKENS, TYPE } from '../../theme';

/** Staff & expert performance over a period, computed from recorded activity. */
export const PerformanceScreen = ({ navigation }: any) => {
  const [days, setDays] = useState('30');
  const { data, loading, error, reload, refreshing, refresh } = useApi(() => crmApi.performance(Number(days)), [days]);
  const staff = (data?.items ?? []).filter(r => r.role === 'STAFF');
  const experts = (data?.items ?? []).filter(r => r.role === 'EXPERT');

  return (
    <Page refreshing={refreshing} onRefresh={refresh}>
      <Segmented value={days} onChange={setDays} options={[{ label: '7 days', value: '7' }, { label: '30 days', value: '30' }, { label: '90 days', value: '90' }]} />
      {loading ? <Loading /> : error ? <ErrorView message={error} onRetry={reload} /> : (
        <>
          <Section title="Staff">
            {!staff.length && <Empty title="No active staff" />}
            {staff.map(r => (
              <View key={r.userId} style={styles.card}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text style={TYPE.h3}>{r.name}</Text>
                  {r.overdueTasks > 0 && <Tag text={`${r.overdueTasks} overdue`} color="red" small />}
                </Row>
                <View style={styles.metrics}>
                  <Metric label="Calls" value={r.calls} /><Metric label="WhatsApp" value={r.whatsapp} />
                  <Metric label="Tasks done" value={r.tasksCompleted} /><Metric label="Open leads" value={r.openLeads} />
                  <Metric label="Won / lost" value={`${r.won} / ${r.lost}`} />
                  <Metric label="Conversion" value={r.conversionRate == null ? '—' : `${r.conversionRate}%`} />
                  <Metric label="Quotations" value={r.quotations} /><Metric label="Accepted value" value={formatMoney(r.acceptedValue)} />
                </View>
                <Text style={[TYPE.caption, { color: TOKENS.colorPrimary }]} onPress={() => navigation.navigate('DailyReport')}>Daily reports →</Text>
              </View>
            ))}
          </Section>
          <Section title="Experts">
            {!experts.length && <Empty title="No active experts" />}
            {experts.map(r => (
              <View key={r.userId} style={styles.card}>
                <Text style={TYPE.h3}>{r.name}</Text>
                <View style={styles.metrics}>
                  <Metric label="Consultations" value={r.consultations} /><Metric label="Answered" value={r.recommendations} />
                  <Metric label="Active now" value={r.activeConsultations} />
                  <Metric label="Avg response" value={r.avgResponseHours == null ? '—' : `${r.avgResponseHours} h`} />
                  <Metric label="Overdue tasks" value={r.overdueTasks} />
                </View>
              </View>
            ))}
          </Section>
          <AiAssistPanel feature="STAFF_INSIGHTS" title="AI productivity insights" context={{}} modes={[{ label: 'Summarise team performance' }]} />
          <KeyValue label="Period from" value={data?.since?.slice(0, 10)} />
        </>
      )}
    </Page>
  );
};

const Metric = ({ label, value }: { label: string; value: any }) => (
  <View style={styles.metric}><Text style={TYPE.caption}>{label}</Text><Text style={TYPE.h3}>{value ?? 0}</Text></View>
);

const styles = StyleSheet.create({
  card: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: TOKENS.colorSplit, gap: 6 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap' },
  metric: { width: '25%', minWidth: 80, paddingVertical: 4 },
});
