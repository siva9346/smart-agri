import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, SafeAreaView, Alert } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS } from '../../../theme';
import { api } from '../../../services/api';

export const EditNotificationScreen = ({ route, navigation }: any) => {
  const { notification } = route.params;

  const [title, setTitle]     = useState(notification.title);
  const [message, setMessage] = useState(notification.message);
  const [saving, setSaving]   = useState(false);

  const handleUpdate = async () => {
    if (!title.trim() || !message.trim()) {
      Alert.alert('Error', 'Please enter a title and message.');
      return;
    }

    setSaving(true);
    try {
      await api.put(`/notifications/${notification.notifId}`, {
        title: title.trim(),
        message: message.trim(),
      });
      Alert.alert('Notification Updated', 'The broadcast has been updated.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to update notification');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>Edit Broadcast</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Alert Title *</Text>
            <TextInput style={styles.input} value={title} onChangeText={setTitle} />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Detailed Message *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              value={message}
              onChangeText={setMessage}
            />
          </View>

          <TouchableOpacity style={[styles.button, saving && { opacity: 0.7 }]} onPress={handleUpdate} disabled={saving}>
            <Text style={styles.buttonText}>{saving ? 'Updating...' : 'Update Notification'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  content: { padding: SPACING.md },
  card: { backgroundColor: '#FFF', padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: SPACING.xl, textAlign: 'center' },
  field: { marginBottom: SPACING.lg },
  label: { fontSize: 14, color: '#333', marginBottom: 8, fontWeight: '500' },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: BORDER_RADIUS.md, padding: 12, fontSize: 15 },
  textArea: { height: 120 },
  button: { backgroundColor: COLORS.secondary, padding: 16, borderRadius: BORDER_RADIUS.md, alignItems: 'center', marginTop: SPACING.sm },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
});
