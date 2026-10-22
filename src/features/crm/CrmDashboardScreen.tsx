import React from 'react';
import { Text, View } from 'react-native';
import { Plus, Columns3, ListChecks, FileText, BarChart3, Users, Activity as ActivityIcon, CalendarClock } from 'lucide-react-native';
import { crmApi } from '../../services/platform';
import { useApi, useAuth } from '../../hooks/useApi';
import { Page, Section, Stat, StatGrid, ActionTile, Row, ListRow, Loading, ErrorView, Empty, humanize, timeAgo } from '../../ui';
import { TOKENS, TYPE } from '../../theme';

export const CrmDashboardScreen = ({ navigation }: any) => {
  const { can } = useAuth();
  const { data, loading, error, reload, refreshing, refresh } = useApi(() => crmApi.dashboard(), []);
  if (loading) return <Loading />;
  if (error || !data) return <ErrorView message={error ?? 'Failed to load'} onRetry={reload} />;
  const { leads, tasks, quotations } = data;
  const scopeLabel = data.scope === 'all' ? 'All leads' : data.scope === 'expert' ? 'Leads you are advising on' : 'Your leads + shared pool';

  return (
    <Page refreshing={refreshing} onRefresh={refresh}>
      <Text style={TYPE.secondary}>{scopeLabel}</Text>
      <Section title="Quick actions" padded>
        <Row wrap gap={4} style={{ justifyContent: 'space-between' }}>
          {can('lead.create') && <ActionTile label="New lead" icon={Plus} onPress={() => navigation.navigate('LeadForm')} />}
          <ActionTile label="Leads" icon={Users} onPress={() => navigation.navigate('LeadList')} />
          <ActionTile label="Pipeline" icon={Columns3} onPress={() => navigation.navigate('Pipeline')} />
          <ActionTile label="Follow-ups" icon={ListChecks} onPress={() => navigation.navigate('TaskList')} />
          {can('quotation.view') && <ActionTile label="Quotations" icon={FileText} onPress={() => navigation.navigate('QuotationList')} />}
          <ActionTile label="Appointments" icon={CalendarClock} onPress={() => navigation.navigate('TaskList', { kind: 'APPOINTMENT' })} />
          <ActionTile label="Reports" icon={BarChart3} onPress={() => navigation.navigate('CrmReports')} />
          <ActionTile label="Activities" icon={ActivityIcon} onPress={() => navigation.navigate('ActivityFeed')} />
        </Row>
      </Section>

      <StatGrid>
        <Stat label="Total leads" value={leads.total} onPress={() => navigation.navigate('LeadList')} />
        <Stat label="New" value={leads.new} hint={`${leads.createdLast7Days} in last 7 days`} onPress={() => navigation.navigate('LeadList', { stage: 'NEW' })} />
        <Stat label="Unassigned" value={leads.unassigned} tone={leads.unassigned ? TOKENS.colorWarning : undefined}
              onPress={() => navigation.navigate('LeadList', { view: 'pool' })} />
        <Stat label="Conversion" value={leads.conversionRate === null ? '—' : `${leads.conversionRate}%`} hint={`${leads.won} won · ${leads.lost} lost`} />
        <Stat label="Consultation leads" value={leads.expertConsultation} onPress={() => navigation.navigate('LeadList', { source: 'EXPERT_CONSULTATION' })} />
        <Stat label="Manual leads" value={leads.manual} onPress={() => navigation.navigate('LeadList', { source: 'MANUAL' })} />
      </StatGrid>

      <Section title="Follow-ups & appointments">
        <StatGrid>
          <Stat label="Due today" value={tasks.followUpsDueToday} onPress={() => navigation.navigate('TaskList')} />
          <Stat label="Overdue" value={tasks.overdue} tone={tasks.overdue ? TOKENS.colorError : undefined}
                onPress={() => navigation.navigate('TaskList', { overdue: true })} />
          <Stat label="Upcoming appointments" value={tasks.upcomingAppointments} onPress={() => navigation.navigate('TaskList', { kind: 'APPOINTMENT' })} />
          <Stat label="Open tasks" value={tasks.openTotal} />
        </StatGrid>
      </Section>

      {can('quotation.view') && (
        <Section title="Quotations">
          <StatGrid>
            <Stat label="Created" value={quotations.created} onPress={() => navigation.navigate('QuotationList')} />
            <Stat label="Awaiting approval" value={quotations.pendingApproval} tone={quotations.pendingApproval ? TOKENS.colorWarning : undefined}
                  onPress={() => navigation.navigate('QuotationList', { status: 'PENDING_APPROVAL' })} />
            <Stat label="Shared" value={quotations.shared} />
            <Stat label="Accepted" value={quotations.accepted} tone={TOKENS.colorSuccess} onPress={() => navigation.navigate('QuotationList', { status: 'ACCEPTED' })} />
          </StatGrid>
        </Section>
      )}

      <Section title="Leads by stage">
        {Object.entries(leads.byStage).map(([stage, n]) => (
          <View key={stage} style={{ gap: 4 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={TYPE.body}>{humanize(stage)}</Text>
              <Text style={TYPE.h3}>{n}</Text>
            </Row>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: TOKENS.colorSplit }}>
              <View style={{ height: 6, borderRadius: 3, width: `${leads.total ? (n * 100) / leads.total : 0}%`,
                             backgroundColor: stage === 'LOST' ? '#FF7875' : stage === 'WON' ? TOKENS.colorSuccess : TOKENS.colorPrimary }} />
            </View>
          </View>
        ))}
      </Section>

      <Section title="Recent activity">
        {!data.recentActivities.length && <Empty title="No activity yet" />}
        {data.recentActivities.map(a => (
          <ListRow key={a.activityId} title={a.text} subtitle={`${a.actorName} · ${humanize(a.type)}`} meta={timeAgo(a.createdAt)}
                   onPress={() => navigation.navigate('LeadDetail', { id: a.leadId })} />
        ))}
      </Section>
    </Page>
  );
};
