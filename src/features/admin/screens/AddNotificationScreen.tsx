import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, SafeAreaView, Alert } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS } from '../../../theme';

export const AddNotificationScreen = ({ navigation }: any) => {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = () => {
    if (!title || !message) {
      Alert.alert('Error', 'Please enter a title and message.');
      return;
    }

    const newNotification = {
      id: Math.random().toString(),
      title,
      message,
      date: new Date().toLocaleDateString()
    };

    Alert.alert('Alert Broadcasted', 'The notification has been pushed globally.', [
      { text: 'OK', onPress: () => navigation.navigate('NotificationList', { newNotification }) }
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>Broadcast Alert</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Alert Title *</Text>
            <TextInput style={styles.input} placeholder="e.g. Weather Warning" value={title} onChangeText={setTitle} />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Detailed Message *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Important details..."
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              value={message}
              onChangeText={setMessage}
            />
          </View>

          <TouchableOpacity style={styles.button} onPress={handleSubmit}>
            <Text style={styles.buttonText}>Push Notification</Text>
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
  button: { backgroundColor: COLORS.primary, padding: 16, borderRadius: BORDER_RADIUS.md, alignItems: 'center', marginTop: SPACING.sm },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
});
