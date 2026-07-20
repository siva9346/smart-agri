import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, BORDER_RADIUS } from '../../theme';
import { api } from '../../services/api';

export const EnquiryScreen = ({ navigation }: any) => {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!subject.trim() || !message.trim()) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }
    setLoading(true);
    try {
      await api.post('/enquiries', {
        subject:  subject.trim(),
        message:  message.trim(),
        category: 'GENERAL',
      });
      Alert.alert('Success', 'Enquiry submitted successfully. We will get back to you shortly.');
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to submit enquiry');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Book an Enquiry</Text>
        <Text style={styles.subtitle}>
          Please write your enquiry clearly. Our experts will get back to you shortly.{'\n'}
          தயவுசெய்து உங்கள் கேள்வியை தெளிவாக எழுதுங்கள். எங்கள் நிபுணர்கள் விரைவில் உங்களை தொடர்புகொள்வார்கள்.
        </Text>

        <View style={styles.field}>
          <Text style={styles.label}>Subject</Text>
          <TextInput
            style={styles.input}
            value={subject}
            onChangeText={setSubject}
            placeholder="e.g. Pest control, Crop growth"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Message</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={message}
            onChangeText={setMessage}
            placeholder="Describe your issue in detail"
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity
          style={[styles.button, loading && { opacity: 0.7 }]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? 'Submitting...' : 'Submit Enquiry'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: COLORS.background },
  container:  { padding: SPACING.lg },
  title:      { fontSize: 22, fontWeight: 'bold', color: COLORS.text, marginBottom: SPACING.xs },
  subtitle:   { fontSize: 14, color: COLORS.textSecondary, marginBottom: SPACING.xl, lineHeight: 20, flexWrap: 'wrap' },
  field:      { marginBottom: SPACING.lg },
  label:      { fontSize: 14, color: COLORS.text, marginBottom: SPACING.xs, fontWeight: '500' },
  input:      { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, fontSize: 16 },
  textArea:   { height: 120 },
  button:     { backgroundColor: COLORS.primary, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, alignItems: 'center', marginTop: SPACING.md },
  buttonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
});
