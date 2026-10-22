import React from 'react';
import { Text, View } from 'react-native';
import { adminApi } from '../../services/platform';
import { useApi, useAuth } from '../../hooks/useApi';
import { AiAssistPanel } from '../ai/AiAssistPanel';
import { Page, Section, Stat, StatGrid, ListRow, Tag, Row, Button, Loading, ErrorView, formatDate, humanize } from '../../ui';
import { TOKENS, TYPE } from '../../theme';

/** Admin / Super Admin overview built from GET /dashboard (live counts, no fabricated metrics). */
export const AdminOverviewScreen = ({ navigation }: any) => {
  const { isSuper } = useAuth();
  const { data, loading, error, reload, refreshing, refresh } = useApi(() => adminApi.dashboard(), []);
  if (loading) return <Loading />;
  if (error || !data) return <ErrorView message={error ?? 'Failed'} onRetry={reload} />;

  return (
    <Page refreshing={refreshing} onRefresh={refresh}>
      {isSuper && data.users && (
        <Section title="Users">
          <StatGrid>
            {Object.entries(data.users as Record<string, { total: number; active: number }>).map(([r, v]) => (
              <Stat key={r} label={humanize(r === 'FARMER' ? 'CUSTOMER' : r) + 's'} value={v.total} hint={`${v.active} active`}
                    onPress={r !== 'FARMER' ? () => navigation.navigate('UserManagement') : () => navigation.navigate('AddCustomer')} />
            ))}
          </StatGrid>
        </Section>
      )}

      <Section title="CRM">
        <StatGrid>
          <Stat label="Total leads" value={data.leads.total} onPress={() => navigation.navigate('LeadList', { view: 'all' })} />
          <Stat label="Unassigned leads" value={data.leads.unassigned} tone={data.leads.unassigned ? TOKENS.colorWarning : undefined}
                onPress={() => navigation.navigate('LeadList', { view: 'pool' })} />
          <Stat label="Conversion" value={data.leads.conversionRate == null ? '—' : `${data.leads.conversionRate}%`} />
          <Stat label="Overdue follow-ups" value={data.overdueFollowUps} tone={data.overdueFollowUps ? TOKENS.colorError : undefined}
                onPress={() => navigation.navigate('TaskList', { overdue: true })} />
          <Stat label="Quotations awaiting approval" value={data.quotations.pendingApproval}
                tone={data.quotations.pendingApproval ? TOKENS.colorWarning : undefined}
                onPress={() => navigation.navigate('QuotationList', { status: 'PENDING_APPROVAL' })} />
          <Stat label="Accepted quotations" value={data.quotations.accepted} hint={`${data.quotations.total} total`} />
        </StatGrid>
        <Row gap={6} wrap>
          {Object.entries(data.leads.byStage as Record<string, number>).map(([s, n]) => <Tag key={s} text={`${humanize(s)}: ${n}`} small />)}
        </Row>
      </Section>

      <Section title="Consultations">
        <StatGrid>
          <Stat label="Pending" value={data.consultations.pending} onPress={() => navigation.navigate('ConsultationList')} />
          <Stat label="Unassigned" value={data.consultations.awaitingAssignment} tone={data.consultations.awaitingAssignment ? TOKENS.colorError : undefined}
                onPress={() => navigation.navigate('ConsultationList', { status: 'AWAITING_ASSIGNMENT' })} />
        </StatGrid>
        <Text style={TYPE.label}>Expert workload</Text>
        {data.expertWorkload.map((e: any) => (
          <ListRow key={e.name} title={e.name} right={<Text style={TYPE.h3}>{e.active}</Text>}
                   meta={e.available ? undefined : 'Unavailable'} />
        ))}
        <Button title="Coverage & workload" size="sm" type="text" onPress={() => navigation.navigate('ExpertCoverage')} />
      </Section>

      {isSuper && data.ai && (
        <Section title="AI" extra={<Button title="Configure" size="sm" type="text" onPress={() => navigation.navigate('AiConfig')} />}>
          <Row gap={6} wrap>
            <Tag text={data.ai.enabled ? 'AI enabled' : 'AI disabled'} color={data.ai.enabled ? 'green' : 'default'} />
            {Object.entries(data.ai.providers as Record<string, any>).map(([p, v]) => (
              <Tag key={p} text={`${p}: ${v.enabled ? 'on' : 'off'}${v.keyConfigured ? '' : ' · no key'}${v.lastTestOk === false ? ' · last test failed' : ''}`}
                   color={v.enabled && v.lastTestOk !== false ? 'green' : v.lastTestOk === false ? 'red' : 'default'} />
            ))}
          </Row>
          <StatGrid>
            <Stat label="AI requests today" value={data.ai.requestsToday} />
            <Stat label="AI errors today" value={data.ai.errorsToday} tone={data.ai.errorsToday ? TOKENS.colorWarning : undefined} />
          </StatGrid>
          {Object.entries(data.ai.providers as Record<string, any>).map(([p, v]) => v.lastTestAt ? (
            <Text key={p} style={TYPE.caption}>{p} last tested {formatDate(v.lastTestAt)}</Text>) : null)}
        </Section>
      )}

      <AiAssistPanel feature="CRM_REPORT" title="AI operational summary" context={{}}
                     modes={[{ label: 'Summarise operations' }, { label: 'Process improvements',
                               prompt: 'Suggest 5 concrete process improvements based on these metrics, ranked by impact.' }]} />
      <View style={{ height: 8 }} />
    </Page>
  );
};
