import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, BORDER_RADIUS } from '../../../theme';
import { api } from '../../../services/api';

const PRIORITIES: { value: 'LOW' | 'MEDIUM' | 'HIGH'; label: string; color: string }[] = [
  { value: 'LOW',    label: 'Low',    color: '#388E3C' },
  { value: 'MEDIUM', label: 'Medium', color: '#F57C00' },
  { value: 'HIGH',   label: 'High',   color: '#D32F2F' },
];

export const AddAdviceScreen = ({ navigation, route }: any) => {
  const { cycleId, cropName } = route.params;
  const [title,              setTitle]              = useState('');
  const [message,            setMessage]            = useState('');
  const [recommendedAction,  setRecommendedAction]  = useState('');
  const [priority,           setPriority]           = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');
  const [loading,            setLoading]            = useState(false);

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      Alert.alert('Error', 'Title and message are required');
      return;
    }
    setLoading(true);
    try {
      await api.post('/records/advice', {
        cycleId,
        title: title.trim(),
        message: message.trim(),
        priority,
        recommendedAction: recommendedAction.trim(),
      });
      Alert.alert('Sent', 'Advice added to the customer’s crop timeline');
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to send advice');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.cropLabel}>Advice for {cropName}</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Title *</Text>
          <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="e.g. Apply fungicide soon" />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Message *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={message}
            onChangeText={setMessage}
            placeholder="Describe the observation or concern..."
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Recommended Action</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={recommendedAction}
            onChangeText={setRecommendedAction}
            placeholder="What should the farmer do next? (optional)"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Priority</Text>
          <View style={styles.priorityRow}>
            {PRIORITIES.map(p => (
              <TouchableOpacity
                key={p.value}
                style={[
                  styles.priorityBtn,
                  { borderColor: p.color },
                  priority === p.value && { backgroundColor: p.color },
                ]}
                onPress={() => setPriority(p.value)}
              >
                <Text style={[styles.priorityBtnText, { color: priority === p.value ? '#FFF' : p.color }]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity style={[styles.button, loading && { opacity: 0.7 }]} onPress={handleSend} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Sending...' : 'Send Advice'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe:             { flex: 1, backgroundColor: COLORS.background },
  container:        { padding: SPACING.lg },
  cropLabel:        { fontSize: 13, fontWeight: 'bold', color: COLORS.textSecondary, textTransform: 'uppercase', marginBottom: SPACING.lg },
  field:            { marginBottom: SPACING.lg },
  label:            { fontSize: 14, color: COLORS.text, marginBottom: SPACING.xs, fontWeight: '600' },
  input:            { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, fontSize: 16, color: COLORS.text },
  textArea:         { height: 90 },
  priorityRow:      { flexDirection: 'row', gap: 8 },
  priorityBtn:      { flex: 1, paddingVertical: 10, borderRadius: 20, borderWidth: 1.5, alignItems: 'center' },
  priorityBtnText:  { fontSize: 13, fontWeight: 'bold' },
  button:           { backgroundColor: '#5E35B1', padding: SPACING.md, borderRadius: BORDER_RADIUS.md, alignItems: 'center', marginTop: SPACING.md },
  buttonText:       { color: 'white', fontSize: 16, fontWeight: 'bold' },
});
