import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Plus, Search, Filter } from 'lucide-react-native';
import { crmApi, Lead, LEAD_STAGES, LEAD_SOURCES } from '../../services/platform';
import { usePaged, useAuth } from '../../hooks/useApi';
import { Loading, ErrorView, Empty, Segmented, Button, StatusTag, Tag, Input, Select, Sheet, Field, timeAgo, humanize } from '../../ui';
import { TOKENS, TYPE } from '../../theme';

export const LeadListScreen = ({ navigation, route }: any) => {
  const { role, can } = useAuth();
  const views = role === 'EXPERT'
    ? [{ label: 'My consultation leads', value: 'expert' }]
    : [
        { label: 'My leads', value: 'mine' },
        { label: 'Shared pool', value: 'pool' },
        ...(can('crm.view_all') ? [{ label: 'All leads', value: 'all' }] : []),
      ];
  const [view, setView] = useState<string>(route.params?.view ?? (can('crm.view_all') ? 'all' : views[0].value));
  const [stage, setStage] = useState<string>(route.params?.stage ?? '');
  const [source, setSource] = useState<string>(route.params?.source ?? '');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 400);
    return () => clearTimeout(t);
  }, [q]);

  const list = usePaged(cursor => crmApi.leads({ view, stage, source, q: query }, cursor), [view, stage, source, query]);

  const renderItem = useCallback(({ item }: { item: Lead }) => (
    <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('LeadDetail', { id: item.leadId })} activeOpacity={0.7}>
      <View style={styles.top}>
        <Text style={[TYPE.h3, { flex: 1 }]} numberOfLines={1}>{item.customerName}</Text>
        <StatusTag status={item.stage} small />
      </View>
      <Text style={TYPE.secondary} numberOfLines={2}>{item.requirement}</Text>
      <View style={styles.meta}>
        <Tag text={humanize(item.source)} small />
        {(item.priority === 'HIGH' || item.priority === 'URGENT') && <StatusTag status={item.priority} small />}
        {item.ownerId === 'UNASSIGNED' ? <Tag text="Unassigned" color="orange" small /> : !!item.ownerName && <Text style={TYPE.caption}>{item.ownerName}</Text>}
        <Text style={[TYPE.caption, { marginLeft: 'auto' }]}>{timeAgo(item.lastActivityAt || item.createdAt)}</Text>
      </View>
    </TouchableOpacity>
  ), [navigation]);

  const activeFilters = [stage, source].filter(Boolean).length;
  return (
    <View style={styles.root}>
      <View style={styles.toolbar}>
        {views.length > 1 && <Segmented value={view} options={views} onChange={setView} />}
        <View style={styles.searchRow}>
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Input value={q} onChangeText={setQ} placeholder="Search name, phone, crop, location" style={{ paddingLeft: 36 }}
                   autoCapitalize="none" accessibilityLabel="Search leads" />
            <View style={styles.searchIcon} pointerEvents="none"><Search size={16} color={TOKENS.colorTextTertiary} /></View>
          </View>
          <Button title={activeFilters ? `Filters (${activeFilters})` : 'Filters'} icon={Filter} onPress={() => setFilters(true)} />
        </View>
      </View>

      {list.loading ? <Loading /> : list.error ? <ErrorView message={list.error} onRetry={list.reload} /> : (
        <FlatList
          data={list.items}
          keyExtractor={i => i.leadId}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          onEndReached={list.loadMore}
          onEndReachedThreshold={0.4}
          refreshing={list.refreshing}
          onRefresh={list.refresh}
          removeClippedSubviews={Platform.OS === 'android'}
          initialNumToRender={12}
          ListEmptyComponent={<Empty title="No leads found" description={query || activeFilters ? 'Try clearing search or filters.' : undefined}
                                     action={can('lead.create') ? <Button title="Create lead" type="primary" icon={Plus} onPress={() => navigation.navigate('LeadForm')} /> : undefined} />}
        />
      )}
      {can('lead.create') && (
        <View style={styles.fab}><Button title="New lead" type="primary" icon={Plus} onPress={() => navigation.navigate('LeadForm')} /></View>
      )}

      <Sheet visible={filters} onClose={() => setFilters(false)} title="Filter leads"
             footer={<Button title="Clear filters" onPress={() => { setStage(''); setSource(''); setFilters(false); }} />}>
        <View style={{ gap: 12 }}>
          <Field label="Stage">
            <Select value={stage} onChange={v => { setStage(v); setFilters(false); }} title="Stage"
                    options={[{ label: 'Any stage', value: '' }, ...LEAD_STAGES.map(s => ({ label: humanize(s), value: s }))]} />
          </Field>
          <Field label="Source">
            <Select value={source} onChange={v => { setSource(v); setFilters(false); }} title="Source"
                    options={[{ label: 'Any source', value: '' }, { label: 'Manual (not consultation)', value: 'MANUAL' },
                              ...LEAD_SOURCES.map(s => ({ label: humanize(s), value: s }))]} />
          </Field>
        </View>
      </Sheet>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: TOKENS.colorBgLayout },
  toolbar: { padding: 16, paddingBottom: 4, gap: 10 },
  searchRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  searchIcon: { position: 'absolute', left: 12 },
  list: { padding: 16, gap: 10, paddingBottom: 96, flexGrow: 1 },
  card: { backgroundColor: '#FFF', borderRadius: TOKENS.radius, borderWidth: 1, borderColor: TOKENS.colorBorder, padding: 14, gap: 6 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  fab: { position: 'absolute', right: 16, bottom: 24 },
});
