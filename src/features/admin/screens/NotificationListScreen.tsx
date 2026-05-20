import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, Alert, Platform } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS } from '../../../theme';
import { Bell, Edit2, Trash2, Plus, Calendar } from 'lucide-react-native';

const INITIAL_NOTIFS = [
  { id: '1', title: 'Heavy Rain Alert', message: 'Heavy rainfall expected tomorrow across local sectors. Secure crops accordingly.', date: new Date().toLocaleDateString() },
  { id: '2', title: 'Subsidized Urea Restocked', message: 'New stock of subsidized Urea is now available at the main distribution center.', date: new Date(Date.now() - 86400000).toLocaleDateString() },
  { id: '3', title: 'Pest Warning', message: 'Warning: Fall Armyworm sightings reported in eastern fields. Preventive spraying recommended.', date: new Date(Date.now() - 172800000).toLocaleDateString() },
  { id: '4', title: 'State Market Holiday', message: 'The local agriculture markets will remain closed tomorrow due to standard holidays.', date: new Date(Date.now() - 259200000).toLocaleDateString() },
];

export const NotificationListScreen = ({ navigation, route }: any) => {
  const [notifications, setNotifications] = useState(INITIAL_NOTIFS);

  React.useEffect(() => {
    if (route.params?.newNotification) {
      setNotifications(prev => [route.params.newNotification, ...prev]);
      navigation.setParams({ newNotification: undefined });
    }
    if (route.params?.updatedNotification) {
      setNotifications(prev => prev.map(n => n.id === route.params.updatedNotification.id ? route.params.updatedNotification : n));
      navigation.setParams({ updatedNotification: undefined });
    }
  }, [route.params?.newNotification, route.params?.updatedNotification]);

  const handleDelete = (id: string) => {
    Alert.alert('Delete Notification', 'Are you sure you want to delete this global alert?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => setNotifications(prev => prev.filter(n => n.id !== id)) }
    ]);
  };

  const renderNotification = useCallback(({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.titleRow}>
          <Bell size={18} color={COLORS.primary} style={{ marginRight: 8 }} />
          <Text style={styles.title}>{item.title}</Text>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity onPress={() => navigation.navigate('EditNotification', { notification: item })} style={styles.actionBtn}>
            <Edit2 size={16} color="#666" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.actionBtn}>
            <Trash2 size={16} color="#E53935" />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.message} numberOfLines={2}>{item.message}</Text>
      
      <View style={styles.divider} />
      
      <View style={styles.cardFooter}>
        <Calendar size={14} color="#888" style={{ marginRight: 6 }} />
        <Text style={styles.date}>{item.date}</Text>
      </View>
    </View>
  ), [navigation]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerArea}>
        <Text style={styles.headerTitle}>Global Notifications</Text>
        <TouchableOpacity 
          style={styles.addBtn}
          onPress={() => navigation.navigate('AddNotification')}
        >
          <Plus size={20} color="#FFF" />
          <Text style={styles.addBtnText}>Push Alert</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={item => item.id}
        renderItem={renderNotification}
        contentContainerStyle={styles.listContent}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={8}
        removeClippedSubviews={Platform.OS === 'android'}
        ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 40, color: '#999' }}>No active notifications.</Text>}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  headerArea: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.lg, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#EEE' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: BORDER_RADIUS.md },
  addBtnText: { color: '#FFF', fontWeight: 'bold', marginLeft: 4 },
  listContent: { padding: SPACING.md },
  card: { backgroundColor: '#FFF', padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg, marginBottom: SPACING.md, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  title: { fontSize: 16, fontWeight: 'bold', color: '#1A1A1A', flex: 1 },
  actions: { flexDirection: 'row' },
  actionBtn: { padding: 6, marginLeft: 8, backgroundColor: '#F9F9F9', borderRadius: 20 },
  message: { fontSize: 14, color: '#555', marginTop: SPACING.sm, lineHeight: 20 },
  divider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: SPACING.sm },
  cardFooter: { flexDirection: 'row', alignItems: 'center' },
  date: { fontSize: 12, color: '#888', fontStyle: 'italic' },
});
