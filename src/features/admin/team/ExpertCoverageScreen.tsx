import React from 'react';
import { View, Text } from 'react-native';
import { teamApi } from '../../../services/platform';
import { useApi } from '../../../hooks/useApi';
import { Page, Section, Stat, StatGrid, ListRow, Tag, Row, Alert, Button, Loading, ErrorView } from '../../../ui';
import { TOKENS, TYPE } from '../../../theme';

const TIER_COLOR: Record<string, string> = { EXACT: 'green', RELATED: 'blue', GENERAL: 'gold', NONE: 'red' };

/** Expert workload, availability and which crops would be auto-assigned at which tier. */
export const ExpertCoverageScreen = ({ navigation }: any) => {
  const { data, loading, error, reload, refreshing, refresh } = useApi(() => teamApi.experts(), []);
  if (loading) return <Loading />;
  if (error || !data) return <ErrorView message={error ?? 'Failed'} onRetry={reload} />;
  const gaps = data.coverage.filter(c => c.tier === 'NONE');

  return (
    <Page refreshing={refreshing} onRefresh={refresh}>
      <StatGrid>
        <Stat label="Experts" value={data.experts.length} />
        <Stat label="Available now" value={data.experts.filter(e => e.isActive && e.isAvailable && e.activeConsultations < e.capacity).length} />
        <Stat label="Awaiting assignment" value={data.awaitingAssignment} tone={data.awaitingAssignment ? TOKENS.colorWarning : undefined}
              onPress={() => navigation.navigate('ConsultationList', { status: 'AWAITING_ASSIGNMENT' })} />
        <Stat label="Crops without cover" value={gaps.length} tone={gaps.length ? TOKENS.colorError : TOKENS.colorSuccess} />
      </StatGrid>
      {!data.hasGeneralExpert && <Alert type="warning" message="No available general expert. Requests for unmapped crops will wait in the admin queue." />}

      <Section title="Workload">
        {data.experts.map(e => (
          <View key={e.userId} style={{ gap: 4 }}>
            <ListRow title={e.name} subtitle={e.specializations.join(', ') || 'No specializations'}
                     right={!e.isActive ? <Tag text="Inactive" color="red" small /> : !e.isAvailable ? <Tag text="Unavailable" color="gold" small /> :
                       <Text style={TYPE.h3}>{e.activeConsultations}/{e.capacity}</Text>}
                     onPress={() => navigation.navigate('UserForm', { userId: e.userId })} />
            <View style={{ height: 6, borderRadius: 3, backgroundColor: TOKENS.colorSplit, marginBottom: 6 }}>
              <View style={{ height: 6, borderRadius: 3, width: `${Math.min(100, e.utilization ?? 0)}%`,
                             backgroundColor: (e.utilization ?? 0) >= 90 ? TOKENS.colorError : (e.utilization ?? 0) >= 70 ? TOKENS.colorWarning : TOKENS.colorPrimary }} />
            </View>
          </View>
        ))}
        <Button title="Add expert" type="dashed" onPress={() => navigation.navigate('UserForm', { role: 'EXPERT' })} />
      </Section>

      <Section title="Crop coverage" extra={<Button title="Edit rules" size="sm" type="text" onPress={() => navigation.navigate('AssignmentRules')} />}>
        <Text style={TYPE.caption}>Which tier a new request for each mapped crop would be matched at, given current availability.</Text>
        <Row gap={6} wrap>
          {data.coverage.map(c => <Tag key={c.crop} text={`${c.crop} · ${c.tier.toLowerCase()}`} color={TIER_COLOR[c.tier]} />)}
        </Row>
      </Section>
    </Page>
  );
};
