import React from 'react';
import { View, Text } from 'react-native';
import { crmApi } from '../../services/platform';
import { useApi, useAuth } from '../../hooks/useApi';
import { AiAssistPanel } from '../ai/AiAssistPanel';
import { Page, Section, Stat, StatGrid, Row, Loading, ErrorView, formatMoney, humanize } from '../../ui';
import { TOKENS, TYPE } from '../../theme';

type Bucket = { total: number; won: number; lost: number; open: number; conversionRate: number | null };

const BucketTable = ({ rows }: { rows: Record<string, Bucket> }) => {
  const entries = Object.entries(rows).sort((a, b) => b[1].total - a[1].total);
  if (!entries.length) return <Text style={TYPE.secondary}>No data yet.</Text>;
  return (
    <View>
      <Row style={{ paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: TOKENS.colorBorder }}>
        <Text style={[TYPE.label, { flex: 1 }]}>Name</Text>
        {['Total', 'Open', 'Won', 'Lost', 'Conv.'].map(h => <Text key={h} style={[TYPE.label, { width: 48, textAlign: 'right' }]}>{h}</Text>)}
      </Row>
      {entries.map(([k, b]) => (
        <Row key={k} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: TOKENS.colorSplit }}>
          <Text style={[TYPE.body, { flex: 1 }]} numberOfLines={1}>{humanize(k) || k}</Text>
          {[b.total, b.open, b.won, b.lost].map((v, i) => <Text key={i} style={[TYPE.body, { width: 48, textAlign: 'right' }]}>{v}</Text>)}
          <Text style={[TYPE.body, { width: 48, textAlign: 'right' }]}>{b.conversionRate === null ? '—' : `${b.conversionRate}%`}</Text>
        </Row>
      ))}
    </View>
  );
};

export const CrmReportsScreen = () => {
  const { can } = useAuth();
  const { data, loading, error, reload, refreshing, refresh } = useApi(() => crmApi.reports(), []);
  if (loading) return <Loading />;
  if (error || !data) return <ErrorView message={error ?? 'Failed'} onRetry={reload} />;
  const f = data.quotationFunnel;
  return (
    <Page refreshing={refreshing} onRefresh={refresh}>
      <Section title="Quotation funnel">
        <StatGrid>
          <Stat label="Created" value={f.created} />
          <Stat label="Approved" value={f.approved} />
          <Stat label="Shared" value={f.shared} />
          <Stat label="Accepted" value={f.accepted} tone={TOKENS.colorSuccess} hint={formatMoney(f.acceptedValue)} />
        </StatGrid>
      </Section>
      <Section title="Conversion by lead source"><BucketTable rows={data.bySource} /></Section>
      {data.byOwner && <Section title="By staff owner"><BucketTable rows={data.byOwner} /></Section>}
      {data.byExpert && <Section title="By expert"><BucketTable rows={data.byExpert} /></Section>}
      {can('reports.team') && (
        <>
          <AiAssistPanel feature="CRM_REPORT" title="AI CRM insights" context={{}}
                         modes={[{ label: 'Performance summary' }, { label: 'Pending follow-ups',
                                   prompt: 'Analyse overdue and pending follow-ups and suggest how to clear them this week.' }]} />
          <AiAssistPanel feature="STAFF_INSIGHTS" title="AI team workload" context={{}} modes={[{ label: 'Workload summary' }]} />
        </>
      )}
    </Page>
  );
};
