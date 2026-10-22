import React from 'react';
import { Text } from 'react-native';
import { Users, Columns3, ListChecks, FileText, Stethoscope, Sparkles, Plus, Bell } from 'lucide-react-native';
import { adminApi } from '../../services/platform';
import { useApi, useAuth } from '../../hooks/useApi';
import { AiAssistPanel } from '../ai/AiAssistPanel';
import { NotificationBanner } from '../notifications/NotificationBanner';
import { Page, Section, Stat, StatGrid, ActionTile, Row, ListRow, StatusTag, SwitchRow, Loading, ErrorView, Empty, formatDate, timeAgo, humanize, toast } from '../../ui';
import { profileApi } from '../../services/platform';
import { TOKENS, TYPE } from '../../theme';

/** Home for STAFF and EXPERT users — their own work, from live backend data. */
export const WorkDashboardScreen = ({ navigation }: any) => {
  const { user, role } = useAuth();
  const { data, loading, error, reload, refreshing, refresh } = useApi(() => adminApi.dashboard(), []);
  if (loading) return <Loading />;
  if (error || !data) return <ErrorView message={error ?? 'Failed'} onRetry={reload} />;
  const t = data.tasks;
  const isExpert = role === 'EXPERT';

  const toggleAvailability = async (v: boolean) => {
    try {
      await profileApi.update({ isAvailable: v });
      toast(v ? 'You will receive new consultations' : 'New consultations will go to other experts', 'info');
      reload();
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  return (
    <Page refreshing={refreshing} onRefresh={refresh}>
      <NotificationBanner />
      <Text style={TYPE.h1}>Hello, {user?.name?.split(' ')[0]}</Text>

      <Section>
        <Row wrap gap={4} style={{ justifyContent: 'space-between' }}>
          {isExpert
            ? <ActionTile label="Consultations" icon={Stethoscope} onPress={() => navigation.navigate('ConsultationList')} />
            : <ActionTile label="New lead" icon={Plus} onPress={() => navigation.navigate('LeadForm')} />}
          <ActionTile label="Leads" icon={Users} onPress={() => navigation.navigate('LeadList')} />
          <ActionTile label="Pipeline" icon={Columns3} onPress={() => navigation.navigate('Pipeline')} />
          <ActionTile label="My tasks" icon={ListChecks} onPress={() => navigation.navigate('TaskList')} />
          {!isExpert && <ActionTile label="Quotations" icon={FileText} onPress={() => navigation.navigate('QuotationList')} />}
          <ActionTile label="AI assistant" icon={Sparkles} tone={TOKENS.colorInfo} onPress={() => navigation.navigate('AiAssistant')} />
          <ActionTile label="Notifications" icon={Bell} onPress={() => navigation.navigate('Notifications')} />
        </Row>
      </Section>

      {isExpert ? (
        <>
          <StatGrid>
            <Stat label="New requests" value={data.newRequests} tone={data.newRequests ? TOKENS.colorWarning : undefined}
                  onPress={() => navigation.navigate('ConsultationList', { status: 'ASSIGNED' })} />
            <Stat label="Awaiting my response" value={data.awaitingResponse} onPress={() => navigation.navigate('ConsultationList', { status: 'IN_PROGRESS' })} />
            <Stat label="Waiting on customer" value={data.awaitingCustomer} onPress={() => navigation.navigate('ConsultationList', { status: 'INFO_REQUIRED' })} />
            <Stat label="Completed" value={data.completed} />
            <Stat label="Workload" value={`${data.workload.active}/${data.workload.capacity}`} />
            <Stat label="Follow-ups due today" value={t.dueToday} onPress={() => navigation.navigate('TaskList')} />
          </StatGrid>
          <Section>
            <SwitchRow label="Available for new consultations" value={data.workload.isAvailable !== false} onChange={toggleAvailability} />
          </Section>
          <Section title="Active consultations">
            {!data.recent.length && <Empty title="No active consultations" />}
            {data.recent.map((c: any) => (
              <ListRow key={c.consultationId} title={`${c.cropName} · ${c.customerName}`} subtitle={humanize(c.severity) + ' severity'}
                       meta={timeAgo(c.createdAt)} right={<StatusTag status={c.status} small />}
                       onPress={() => navigation.navigate('ConsultationDetail', { id: c.consultationId })} />
            ))}
          </Section>
        </>
      ) : (
        <>
          <StatGrid>
            <Stat label="My open leads" value={data.myOpenLeads} hint={`${data.myLeads} total`} onPress={() => navigation.navigate('LeadList', { view: 'mine' })} />
            <Stat label="Shared pool" value={data.poolLeads} tone={data.poolLeads ? TOKENS.colorWarning : undefined} onPress={() => navigation.navigate('LeadList', { view: 'pool' })} />
            <Stat label="Today's calls" value={t.callsToday} onPress={() => navigation.navigate('TaskList', { kind: 'FOLLOW_UP' })} />
            <Stat label="Overdue follow-ups" value={t.overdue} tone={t.overdue ? TOKENS.colorError : undefined} onPress={() => navigation.navigate('TaskList', { overdue: true })} />
            <Stat label="Quotations to share" value={data.quotationsToShare} onPress={() => navigation.navigate('QuotationList', { status: 'APPROVED' })} />
            <Stat label="Drafts to finish" value={data.quotationsDraft} onPress={() => navigation.navigate('QuotationList', { status: 'DRAFT' })} />
          </StatGrid>
          <AiAssistPanel feature="FOLLOWUP_SUGGEST" title="AI next actions" context={{}} modes={[{ label: 'What should I do today?' }]} />
          <Section title="Recent customer activity">
            {!data.recentLeads.length && <Empty title="No leads yet" />}
            {data.recentLeads.map((l: any) => (
              <ListRow key={l.leadId} title={l.customerName} meta={timeAgo(l.lastActivityAt)} right={<StatusTag status={l.stage} small />}
                       onPress={() => navigation.navigate('LeadDetail', { id: l.leadId })} />
            ))}
          </Section>
        </>
      )}

      <Section title="Upcoming appointments">
        {!t.upcomingAppointments.length && <Text style={TYPE.secondary}>None scheduled.</Text>}
        {t.upcomingAppointments.map((a: any) => (
          <ListRow key={a.taskId} title={a.title} subtitle={a.customerName} meta={formatDate(a.dueAt)}
                   onPress={() => navigation.navigate('TaskForm', { taskId: a.taskId })} />
        ))}
      </Section>
      <Section title="Next up">
        {!t.next.length && <Text style={TYPE.secondary}>Nothing due. </Text>}
        {t.next.map((x: any) => (
          <ListRow key={x.taskId} title={x.title} subtitle={humanize(x.kind)}
                   meta={<Text style={[TYPE.caption, x.dueAt < new Date().toISOString() && { color: TOKENS.colorError }]}>{formatDate(x.dueAt)}</Text>}
                   onPress={() => navigation.navigate('TaskForm', { taskId: x.taskId })} />
        ))}
      </Section>
    </Page>
  );
};
