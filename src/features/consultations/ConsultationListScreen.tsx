import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Plus } from 'lucide-react-native';
import { consultationApi, Consultation } from '../../services/platform';
import { usePaged, useAuth } from '../../hooks/useApi';
import { Loading, ErrorView, Empty, Segmented, Button, StatusTag, Tag, timeAgo, humanize } from '../../ui';
import { TOKENS, TYPE } from '../../theme';

const FILTERS: Record<string, { label: string; value: string }[]> = {
  FARMER: [{ label: 'All', value: '' }, { label: 'Awaiting expert', value: 'ASSIGNED' },
           { label: 'Needs my reply', value: 'INFO_REQUIRED' }, { label: 'Answered', value: 'RECOMMENDATION_PROVIDED' },
           { label: 'Resolved', value: 'RESOLVED' }],
  EXPERT: [{ label: 'All', value: '' }, { label: 'New', value: 'ASSIGNED' }, { label: 'Accepted', value: 'ACCEPTED' },
           { label: 'In progress', value: 'IN_PROGRESS' }, { label: 'Waiting on customer', value: 'INFO_REQUIRED' },
           { label: 'Answered', value: 'RECOMMENDATION_PROVIDED' }, { label: 'Follow-up', value: 'FOLLOW_UP_SCHEDULED' }],
  ADMIN: [{ label: 'All', value: '' }, { label: 'Unassigned', value: 'AWAITING_ASSIGNMENT' }, { label: 'Submitted', value: 'SUBMITTED' },
          { label: 'Assigned', value: 'ASSIGNED' }, { label: 'In progress', value: 'IN_PROGRESS' },
          { label: 'Answered', value: 'RECOMMENDATION_PROVIDED' }, { label: 'Resolved', value: 'RESOLVED' }],
};

/** "My Consultations" for customers, assigned queue for experts, full list for admins/staff. */
export const ConsultationListScreen = ({ navigation, route }: any) => {
  const { role, isCustomer } = useAuth();
  const filters = FILTERS[role === 'SUPER_ADMIN' || role === 'STAFF' ? 'ADMIN' : (role ?? 'FARMER')] ?? FILTERS.ADMIN;
  const [status, setStatus] = useState<string>(route.params?.status ?? '');
  const list = usePaged(cursor => consultationApi.list(status || undefined, cursor), [status]);

  const renderItem = useCallback(({ item }: { item: Consultation }) => (
    <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('ConsultationDetail', { id: item.consultationId })} activeOpacity={0.7}>
      <View style={styles.cardTop}>
        <Text style={[TYPE.h3, { flex: 1 }]} numberOfLines={1}>{item.cropName} · {humanize(item.problemCategory)}</Text>
        <StatusTag status={item.status} small />
      </View>
      <Text style={TYPE.secondary} numberOfLines={2}>{item.symptoms}</Text>
      <View style={styles.meta}>
        {!isCustomer && <Text style={TYPE.caption}>{item.customerName}</Text>}
        {!!item.expertName && <Text style={TYPE.caption}>Expert: {item.expertName}</Text>}
        {(item.severity === 'HIGH' || item.severity === 'CRITICAL') && <Tag text={humanize(item.severity)} color="red" small />}
        <Text style={[TYPE.caption, { marginLeft: 'auto' }]}>{timeAgo(item.updatedAt || item.createdAt)}</Text>
      </View>
    </TouchableOpacity>
  ), [navigation, isCustomer]);

  return (
    <View style={styles.root}>
      <View style={styles.toolbar}>
        <Segmented value={status} options={filters} onChange={setStatus} />
      </View>
      {list.loading ? <Loading /> : list.error ? <ErrorView message={list.error} onRetry={list.reload} /> : (
        <FlatList
          data={list.items}
          keyExtractor={i => i.consultationId}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          onEndReached={list.loadMore}
          onEndReachedThreshold={0.4}
          refreshing={list.refreshing}
          onRefresh={list.refresh}
          removeClippedSubviews={Platform.OS === 'android'}
          ListEmptyComponent={<Empty
            title={isCustomer ? 'No consultations yet' : 'No consultations here'}
            description={isCustomer ? 'Ask an agricultural expert about a crop problem — include photos for faster help.' : undefined}
            action={isCustomer ? <Button title="Get suggestions from experts" type="primary" icon={Plus}
                                         onPress={() => navigation.navigate('ConsultationRequest')} /> : undefined} />}
        />
      )}
      {isCustomer && list.items.length > 0 && (
        <View style={styles.fab}>
          <Button title="New request" type="primary" icon={Plus} onPress={() => navigation.navigate('ConsultationRequest')} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: TOKENS.colorBgLayout },
  toolbar: { paddingHorizontal: 16, paddingTop: 12 },
  list: { padding: 16, gap: 10, paddingBottom: 96, flexGrow: 1 },
  card: { backgroundColor: '#FFF', borderRadius: TOKENS.radius, borderWidth: 1, borderColor: TOKENS.colorBorder, padding: 14, gap: 6 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  fab: { position: 'absolute', right: 16, bottom: 24 },
});
