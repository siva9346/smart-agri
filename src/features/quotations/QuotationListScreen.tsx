import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { quotationApi, Quotation } from '../../services/platform';
import { usePaged, useAuth } from '../../hooks/useApi';
import { Loading, ErrorView, Empty, Segmented, StatusTag, formatMoney, timeAgo } from '../../ui';
import { TOKENS, TYPE } from '../../theme';

const INTERNAL = [
  { label: 'All', value: '' }, { label: 'Drafts', value: 'DRAFT' }, { label: 'Awaiting approval', value: 'PENDING_APPROVAL' },
  { label: 'Approved', value: 'APPROVED' }, { label: 'Shared', value: 'SHARED' }, { label: 'Viewed', value: 'VIEWED' },
  { label: 'Accepted', value: 'ACCEPTED' }, { label: 'Rejected', value: 'REJECTED' }, { label: 'Expired', value: 'EXPIRED' },
];
const CUSTOMER = [
  { label: 'All', value: '' }, { label: 'Awaiting my reply', value: 'SHARED' }, { label: 'Accepted', value: 'ACCEPTED' },
  { label: 'Declined', value: 'REJECTED' }, { label: 'Expired', value: 'EXPIRED' },
];

export const QuotationListScreen = ({ navigation, route }: any) => {
  const { isCustomer } = useAuth();
  const [status, setStatus] = useState<string>(route.params?.status ?? '');
  const list = usePaged(cursor => quotationApi.list({ status: status || undefined }, cursor), [status]);

  const renderItem = useCallback(({ item }: { item: Quotation }) => (
    <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={() => navigation.navigate('QuotationDetail', { id: item.quotationId })}>
      <View style={styles.top}>
        <Text style={[TYPE.h3, { flex: 1 }]}>{item.quotationNumber}</Text>
        <StatusTag status={item.status} small />
      </View>
      {!isCustomer && <Text style={TYPE.secondary}>{item.customerName}</Text>}
      <View style={styles.top}>
        <Text style={[TYPE.h3, { color: TOKENS.colorPrimary, flex: 1 }]}>{formatMoney(item.grandTotal)}</Text>
        <Text style={TYPE.caption}>{item.items.length} item(s) · valid until {item.validUntil} · {timeAgo(item.createdAt)}</Text>
      </View>
    </TouchableOpacity>
  ), [navigation, isCustomer]);

  return (
    <View style={styles.root}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <Segmented value={status} options={isCustomer ? CUSTOMER : INTERNAL} onChange={setStatus} />
      </View>
      {list.loading ? <Loading /> : list.error ? <ErrorView message={list.error} onRetry={list.reload} /> : (
        <FlatList data={list.items} keyExtractor={i => i.quotationId} renderItem={renderItem}
                  contentContainerStyle={styles.list} onEndReached={list.loadMore} onEndReachedThreshold={0.4}
                  refreshing={list.refreshing} onRefresh={list.refresh} removeClippedSubviews={Platform.OS === 'android'}
                  ListEmptyComponent={<Empty title="No quotations" description={isCustomer ? 'Quotations shared with you will appear here.' : 'Create one from a lead.'} />} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: TOKENS.colorBgLayout },
  list: { padding: 16, gap: 10, flexGrow: 1 },
  card: { backgroundColor: '#FFF', borderRadius: TOKENS.radius, borderWidth: 1, borderColor: TOKENS.colorBorder, padding: 14, gap: 6 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
