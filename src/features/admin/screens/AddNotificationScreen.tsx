import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, SafeAreaView, Alert } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS } from '../../../theme';
import { api } from '../../../services/api';

export const AddNotificationScreen = ({ navigation, route }: any) => {
  const [title,   setTitle]   = useState('');
  const [message, setMessage] = useState('');
  const [type,    setType]    = useState('INFO');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      Alert.alert('Error', 'Title and message are required');
      return;
    }
    setLoading(true);
    try {
      await api.post('/notifications', {
        title:   title.trim(),
        message: message.trim(),
        type:    type,
        targetRole: 'ALL',
        isActive: true,
      });
      Alert.alert('Sent', 'Notification broadcast to all farmers');
      route.params?.onAdded?.();
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to send notification');
    } finally {
      setLoading(false);
    }
  };

  const types = ['INFO', 'WARNING', 'ALERT', 'PROMOTION'];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.field}>
          <Text style={styles.label}>Title *</Text>
          <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Notification title" />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Message *</Text>
          <TextInput style={[styles.input, styles.textArea]} value={message} onChangeText={setMessage} placeholder="Write your message to farmers..." multiline numberOfLines={4} textAlignVertical="top" />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Type</Text>
          <View style={styles.typeRow}>
            {types.map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.typeBtn, type === t && styles.typeBtnActive]}
                onPress={() => setType(t)}
              >
                <Text style={[styles.typeBtnText, type === t && styles.typeBtnTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <TouchableOpacity style={[styles.button, loading && { opacity: 0.7 }]} onPress={handleSend} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Sending...' : 'Send to All Farmers'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: COLORS.background },
  container:       { padding: SPACING.lg },
  field:           { marginBottom: SPACING.lg },
  label:           { fontSize: 14, color: COLORS.text, marginBottom: SPACING.xs, fontWeight: '600' },
  input:           { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, fontSize: 16, color: COLORS.text },
  textArea:        { height: 100 },
  typeRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeBtn:         { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  typeBtnActive:   { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeBtnText:     { fontSize: 13, color: COLORS.text, fontWeight: '500' },
  typeBtnTextActive:{ color: '#fff' },
  button:          { backgroundColor: COLORS.primary, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, alignItems: 'center', marginTop: SPACING.md },
  buttonText:      { color: 'white', fontSize: 16, fontWeight: 'bold' },
});
