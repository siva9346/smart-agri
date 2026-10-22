import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { Plus } from 'lucide-react-native';
import { teamApi, TeamUser } from '../../../services/platform';
import { useApi, useAuth } from '../../../hooks/useApi';
import { Segmented, ListRow, Avatar, Tag, Button, Loading, ErrorView, Empty, Input, Row, humanize } from '../../../ui';
import { TOKENS, TYPE } from '../../../theme';

export const UserManagementScreen = ({ navigation }: any) => {
  const { isSuper } = useAuth();
  const roles = [
    { label: 'Staff', value: 'STAFF' }, { label: 'Experts', value: 'EXPERT' },
    ...(isSuper ? [{ label: 'Admins', value: 'ADMIN' }, { label: 'Super admins', value: 'SUPER_ADMIN' }] : []),
  ];
  const [role, setRole] = useState('STAFF');
  const [q, setQ] = useState('');
  const { data, loading, error, reload, refreshing, refresh } = useApi(() => teamApi.list(role), [role]);
  const items = (data?.items ?? []).filter(u => !q || `${u.name} ${u.phone}`.toLowerCase().includes(q.toLowerCase()));

  const renderItem = ({ item }: { item: TeamUser }) => (
    <View style={styles.card}>
      <ListRow
        left={<Avatar name={item.name} color={item.isActive ? TOKENS.colorPrimary : TOKENS.colorTextTertiary} />}
        title={item.name}
        subtitle={[item.phone, item.jobTitle, item.department].filter(Boolean).join(' · ')}
        meta={item.role === 'EXPERT'
          ? <Row gap={4} wrap>{(item.specializations ?? []).slice(0, 4).map(s => <Tag key={s} text={s} small color="green" />)}
              <Text style={TYPE.caption}>{item.activeConsultationCount ?? 0} active</Text></Row>
          : undefined}
        right={!item.isActive ? <Tag text="Inactive" color="red" small /> : item.role === 'EXPERT' && item.isAvailable === false ? <Tag text="Unavailable" color="gold" small /> : undefined}
        onPress={role !== 'SUPER_ADMIN' ? () => navigation.navigate('UserForm', { userId: item.userId }) : undefined}
      />
    </View>
  );

  return (
    <View style={styles.root}>
      <View style={{ padding: 16, paddingBottom: 4, gap: 10 }}>
        <Segmented value={role} options={roles} onChange={setRole} />
        <Input value={q} onChangeText={setQ} placeholder="Search by name or phone" />
      </View>
      {loading ? <Loading /> : error ? <ErrorView message={error} onRetry={reload} /> : (
        <FlatList data={items} keyExtractor={u => u.userId} renderItem={renderItem} contentContainerStyle={styles.list}
                  refreshing={refreshing} onRefresh={refresh}
                  ListEmptyComponent={<Empty title={`No ${humanize(role).toLowerCase()} accounts`} />} />
      )}
      {role !== 'SUPER_ADMIN' && (
        <View style={styles.fab}>
          <Button title={`Add ${role === 'EXPERT' ? 'expert' : role === 'ADMIN' ? 'admin' : 'staff'}`} type="primary" icon={Plus}
                  onPress={() => navigation.navigate('UserForm', { role })} />
        </View>
      )}
      {role === 'SUPER_ADMIN' && <Text style={[TYPE.caption, { textAlign: 'center', padding: 12 }]}>Super admins are added from the Add Admin screen (limited number).</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: TOKENS.colorBgLayout },
  list: { padding: 16, gap: 8, paddingBottom: 96, flexGrow: 1 },
  card: { backgroundColor: '#FFF', borderRadius: TOKENS.radius, borderWidth: 1, borderColor: TOKENS.colorBorder, paddingHorizontal: 12 },
  fab: { position: 'absolute', right: 16, bottom: 24 },
});
