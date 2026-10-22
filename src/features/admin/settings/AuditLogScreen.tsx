import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { adminApi } from '../../../services/platform';
import { usePaged } from '../../../hooks/useApi';
import { Button, Row, Tag, Loading, ErrorView, Empty, humanize, formatDate } from '../../../ui';
import { TOKENS, TYPE } from '../../../theme';

const dayStr = (d: Date) => d.toISOString().slice(0, 10);

export const AuditLogScreen = () => {
  const [day, setDay] = useState(dayStr(new Date()));
  const list = usePaged(cursor => adminApi.audit({ day }, cursor), [day]);
  const shift = (n: number) => { const d = new Date(`${day}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); setDay(dayStr(d)); };

  return (
    <View style={styles.root}>
      <Row style={styles.bar}>
        <Button title="" icon={ChevronLeft} size="sm" onPress={() => shift(-1)} accessibilityLabel="Previous day" />
        <Text style={[TYPE.h3, { flex: 1, textAlign: 'center' }]}>{day} (UTC)</Text>
        <Button title="" icon={ChevronRight} size="sm" onPress={() => shift(1)} disabled={day >= dayStr(new Date())} accessibilityLabel="Next day" />
      </Row>
      {list.loading ? <Loading /> : list.error ? <ErrorView message={list.error} onRetry={list.reload} /> : (
        <FlatList data={list.items} keyExtractor={i => i.auditId} contentContainerStyle={styles.list}
                  onEndReached={list.loadMore} refreshing={list.refreshing} onRefresh={list.refresh}
                  ListEmptyComponent={<Empty title="No audit events this day" />}
                  renderItem={({ item }) => (
                    <View style={styles.card}>
                      <Row style={{ justifyContent: 'space-between' }}>
                        <Text style={TYPE.h3}>{humanize(item.action)}</Text>
                        <Text style={TYPE.caption}>{formatDate(item.createdAt)}</Text>
                      </Row>
                      <Row gap={6} wrap>
                        <Tag text={`${item.actorName} (${humanize(item.actorRole)})`} small />
                        <Tag text={`${item.entityType}: ${String(item.entityId).slice(0, 8)}`} small color="blue" />
                      </Row>
                      {!!item.details && <Text style={TYPE.caption} selectable>{JSON.stringify(item.details)}</Text>}
                    </View>
                  )} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: TOKENS.colorBgLayout },
  bar: { padding: 12, gap: 8 },
  list: { padding: 16, gap: 8, flexGrow: 1 },
  card: { backgroundColor: '#FFF', borderRadius: TOKENS.radius, borderWidth: 1, borderColor: TOKENS.colorBorder, padding: 12, gap: 6 },
});
