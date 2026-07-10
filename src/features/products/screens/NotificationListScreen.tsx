import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { productService } from '../services/productService';

interface ApiNotification {
  notificationId: string;
  title: string;
  message: string;
  type: string;
  createdAt: string;
}

const TYPE_COLOR: Record<string, string> = {
  INFO: '#2980b9', WARNING: '#e67e22', ALERT: '#e74c3c', PROMOTION: '#27ae60',
};

export const NotificationListScreen = () => {
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    productService.getNotifications()
      .then(res => setNotifications((res as any).items ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2e7d32" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.notificationId}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={[styles.typeDot, { backgroundColor: TYPE_COLOR[item.type] ?? '#888' }]} />
            <View style={styles.content}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.message}>{item.message}</Text>
              <Text style={styles.time}>{item.createdAt.split('T')[0]}</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No notifications yet.</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#fff' },
  centered:       { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent:    { padding: 16 },
  card:           { flexDirection: 'row', alignItems: 'flex-start', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  typeDot:        { width: 10, height: 10, borderRadius: 5, marginRight: 16, marginTop: 4 },
  content:        { flex: 1 },
  title:          { fontSize: 15, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  message:        { fontSize: 14, color: '#555', marginBottom: 4 },
  time:           { fontSize: 12, color: '#999' },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText:      { fontSize: 16, color: '#999' },
});
