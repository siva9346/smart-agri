import React from 'react';
import { crmApi } from '../../services/platform';
import { useApi } from '../../hooks/useApi';
import { Page, Section, ListRow, Tag, Loading, ErrorView, Empty, humanize, timeAgo } from '../../ui';

export const ActivityFeedScreen = ({ navigation }: any) => {
  const { data, loading, error, reload, refreshing, refresh } = useApi(() => crmApi.activities(), []);
  if (loading) return <Loading />;
  if (error || !data) return <ErrorView message={error ?? 'Failed'} onRetry={reload} />;
  return (
    <Page refreshing={refreshing} onRefresh={refresh}>
      <Section title="Recent CRM activity">
        {!data.items.length && <Empty title="No activity yet" />}
        {data.items.map(a => (
          <ListRow key={a.activityId} left={<Tag text={humanize(a.type)} small />} title={a.text}
                   meta={`${a.actorName} · ${timeAgo(a.createdAt)}`} onPress={() => navigation.navigate('LeadDetail', { id: a.leadId })} />
        ))}
      </Section>
    </Page>
  );
};
