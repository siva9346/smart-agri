import React from 'react';
import { Text } from 'react-native';
import { crmApi } from '../../services/platform';
import { useApi } from '../../hooks/useApi';
import { Page, Section, KeyValue, ListRow, StatusTag, Tag, Avatar, Row, Loading, ErrorView, formatDate, formatMoney, humanize, timeAgo } from '../../ui';
import { TYPE } from '../../theme';

/** Customer Care: one customer's leads, consultations, quotations and communication history. */
export const CustomerProfileScreen = ({ navigation, route }: any) => {
  const customerId: string = route.params.customerId;
  const { data, loading, error, reload, refreshing, refresh } = useApi(() => crmApi.customer(customerId), [customerId]);
  if (loading) return <Loading />;
  if (error || !data) return <ErrorView message={error ?? 'Not found'} onRetry={reload} />;
  const c = data.customer;
  return (
    <Page refreshing={refreshing} onRefresh={refresh}>
      <Section>
        <Row gap={12}>
          <Avatar name={c.name} size={48} />
          <Text style={[TYPE.h2, { flex: 1 }]}>{c.name}</Text>
        </Row>
        <KeyValue label="Phone" value={c.phone} />
        <KeyValue label="Email" value={c.email} />
        <KeyValue label="Village" value={[c.village, c.district].filter(Boolean).join(', ')} />
        <KeyValue label="Prefers" value={c.preferredContactMethod ? humanize(c.preferredContactMethod) : undefined} />
        <KeyValue label="Customer since" value={formatDate(c.createdAt, false)} />
      </Section>

      {!!data.lands.length && (
        <Section title="Farm">
          {data.lands.map((l: any) => <ListRow key={l.landId} title={l.name ?? 'Land'} subtitle={[l.area != null ? `${l.area} ${l.areaUnit ?? 'acres'}` : null, l.village, l.soilType].filter(Boolean).join(' · ')} />)}
        </Section>
      )}

      <Section title={`Leads (${data.leads.length})`}>
        {data.leads.map((l: any) => (
          <ListRow key={l.leadId} title={l.requirement} subtitle={`${humanize(l.source)} · ${l.ownerName ?? 'Unassigned'}`}
                   right={<StatusTag status={l.stage} small />} onPress={() => navigation.navigate('LeadDetail', { id: l.leadId })} />
        ))}
      </Section>

      <Section title={`Consultation history (${data.consultations.length})`}>
        {!data.consultations.length && <Text style={TYPE.secondary}>None.</Text>}
        {data.consultations.map((c: any) => (
          <ListRow key={c.consultationId} title={c.cropName} subtitle={c.expertName ? `Expert: ${c.expertName}` : undefined}
                   meta={formatDate(c.createdAt, false)} right={<StatusTag status={c.status} small />}
                   onPress={() => navigation.navigate('ConsultationDetail', { id: c.consultationId })} />
        ))}
      </Section>

      {!!data.quotations.length && (
        <Section title="Quotations">
          {data.quotations.map((q: any) => (
            <ListRow key={q.quotationId} title={q.quotationNumber} subtitle={formatMoney(q.grandTotal)} right={<StatusTag status={q.status} small />}
                     onPress={() => navigation.navigate('QuotationDetail', { id: q.quotationId })} />
          ))}
        </Section>
      )}

      <Section title="Communication history">
        {!data.communications.length && <Text style={TYPE.secondary}>No calls, WhatsApp messages or notes yet.</Text>}
        {data.communications.map((a: any) => (
          <ListRow key={a.activityId} left={<Tag text={humanize(a.type)} small color={a.type === 'CALL' ? 'blue' : a.type === 'WHATSAPP' ? 'green' : 'gold'} />}
                   title={<Text style={TYPE.body}>{a.text}</Text>} meta={`${a.actorName} · ${timeAgo(a.createdAt)}`} />
        ))}
      </Section>
    </Page>
  );
};
