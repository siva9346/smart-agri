import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, BORDER_RADIUS } from '../../../theme';
import { CheckCircle } from 'lucide-react-native';
import { api } from '../../../services/api';
import { LoadingState, ErrorState } from '../../../components/States';

interface ApiEnquiry {
  enquiryId: string;
  farmerId: string;
  subject: string;
  message: string;
  status: string;
  response?: string;
  respondedAt?: string;
  createdAt: string;
}

const STATUS_COLOR: Record<string, string> = { OPEN: '#e67e22', IN_PROGRESS: '#2980b9', RESOLVED: '#27ae60', CLOSED: '#7f8c8d' };
const STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

export const EnquiryDetailsScreen = ({ route }: any) => {
  const { enquiryId, onUpdate } = route.params;
  const [enquiry,  setEnquiry]  = useState<ApiEnquiry | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [response, setResponse] = useState('');
  const [saving,   setSaving]   = useState(false);

  useEffect(() => {
    api.get<ApiEnquiry>(`/enquiries/${enquiryId}`)
      .then(data => { setEnquiry(data); setResponse(data.response ?? ''); })
      .catch(err => setError(err?.message ?? 'Failed to load enquiry'))
      .finally(() => setLoading(false));
  }, [enquiryId]);

  const handleUpdate = async (status?: string) => {
    if (!enquiry) return;
    setSaving(true);
    try {
      const updated = await api.put<ApiEnquiry>(`/enquiries/${enquiryId}`, {
        ...(response.trim() ? { response: response.trim() } : {}),
        ...(status ? { status } : {}),
      });
      setEnquiry(updated);
      Alert.alert('Success', 'Enquiry updated');
      onUpdate?.();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState />;
  if (error || !enquiry) return <ErrorState error={error ?? 'Not found'} />;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.subject}>{enquiry.subject}</Text>
          <View style={[styles.badge, { backgroundColor: (STATUS_COLOR[enquiry.status] ?? '#666') + '20' }]}>
            <Text style={[styles.badgeText, { color: STATUS_COLOR[enquiry.status] ?? '#666' }]}>{enquiry.status}</Text>
          </View>
        </View>

        <Text style={styles.date}>{enquiry.createdAt.split('T')[0]}</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Enquiry</Text>
          <Text style={styles.message}>{enquiry.message}</Text>
        </View>

        {enquiry.response ? (
          <View style={[styles.section, styles.responseSection]}>
            <Text style={styles.sectionTitle}>Admin Response</Text>
            <Text style={styles.responseText}>{enquiry.response}</Text>
            {enquiry.respondedAt ? <Text style={styles.date}>Responded: {enquiry.respondedAt.split('T')[0]}</Text> : null}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Update Status</Text>
          <View style={styles.statusRow}>
            {STATUSES.map(s => (
              <TouchableOpacity
                key={s}
                style={[styles.statusBtn, enquiry.status === s && styles.statusBtnActive]}
                onPress={() => handleUpdate(s)}
                disabled={saving}
              >
                <Text style={[styles.statusBtnText, enquiry.status === s && styles.statusBtnTextActive]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Admin Reply</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={response}
            onChangeText={setResponse}
            placeholder="Write your response to the farmer..."
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
          <TouchableOpacity
            style={[styles.button, saving && { opacity: 0.7 }]}
            onPress={() => handleUpdate()}
            disabled={saving}
          >
            <CheckCircle size={18} color="#fff" />
            <Text style={styles.buttonText}>{saving ? 'Saving...' : 'Send Response'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe:             { flex: 1, backgroundColor: COLORS.background },
  container:        { padding: SPACING.lg },
  header:           { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 10 },
  subject:          { flex: 1, fontSize: 20, fontWeight: 'bold', color: COLORS.text },
  badge:            { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText:        { fontSize: 12, fontWeight: 'bold' },
  date:             { fontSize: 12, color: COLORS.textSecondary, marginBottom: SPACING.md },
  section:          { backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md },
  sectionTitle:     { fontSize: 13, fontWeight: 'bold', color: COLORS.textSecondary, textTransform: 'uppercase', marginBottom: 8 },
  message:          { fontSize: 15, color: COLORS.text, lineHeight: 22 },
  responseSection:  { borderLeftWidth: 3, borderLeftColor: COLORS.primary },
  responseText:     { fontSize: 14, color: COLORS.text, lineHeight: 22 },
  statusRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusBtn:        { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, backgroundColor: '#f5f5f5' },
  statusBtnActive:  { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  statusBtnText:    { fontSize: 12, color: COLORS.text, fontWeight: '600' },
  statusBtnTextActive:{ color: '#fff' },
  input:            { borderWidth: 1, borderColor: COLORS.border, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, fontSize: 15, color: COLORS.text, backgroundColor: '#f9f9f9' },
  textArea:         { height: 100, marginBottom: SPACING.md },
  button:           { backgroundColor: COLORS.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: SPACING.md, borderRadius: BORDER_RADIUS.md, gap: 8 },
  buttonText:       { color: 'white', fontSize: 15, fontWeight: 'bold' },
});
