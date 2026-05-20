import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, SafeAreaView, Alert } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS } from '../../../theme';

export const AddSymptomScreen = ({ navigation }: any) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [crop, setCrop] = useState('');
  const [severity, setSeverity] = useState('Medium');

  const handleSubmit = () => {
    if (!title || !description || !crop) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    const newSymptom = {
      id: Math.random().toString(),
      title,
      description,
      crop,
      severity
    };

    Alert.alert('Success', 'Symptom added successfully', [
      { text: 'OK', onPress: () => navigation.navigate('SymptomsList', { newSymptom }) }
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>Record New Symptom</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Symptom Title *</Text>
            <TextInput style={styles.input} placeholder="e.g. Leaf Yellowing" value={title} onChangeText={setTitle} />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Target Crop *</Text>
            <TextInput style={styles.input} placeholder="e.g. Paddy" value={crop} onChangeText={setCrop} />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Severity Level *</Text>
            <View style={styles.severityRow}>
              {['Low', 'Medium', 'High'].map(lev => (
                <TouchableOpacity
                  key={lev}
                  style={[styles.severityPill, severity === lev && styles.severityPillActive]}
                  onPress={() => setSeverity(lev)}
                >
                  <Text style={[styles.severityText, severity === lev && styles.severityTextActive]}>{lev}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Description *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Detailed description of symptoms..."
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              value={description}
              onChangeText={setDescription}
            />
          </View>

          <TouchableOpacity style={styles.button} onPress={handleSubmit}>
            <Text style={styles.buttonText}>Save Symptom</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  content: { padding: SPACING.md },
  card: {
    backgroundColor: '#FFF', padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5
  },
  title: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: SPACING.xl, textAlign: 'center' },
  field: { marginBottom: SPACING.lg },
  label: { fontSize: 14, color: '#333', marginBottom: 8, fontWeight: '500' },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: BORDER_RADIUS.md, padding: 12, fontSize: 15 },
  severityRow: { flexDirection: 'row', justifyContent: 'space-between' },
  severityPill: { flex: 1, paddingVertical: 10, marginHorizontal: 4, borderRadius: BORDER_RADIUS.md, backgroundColor: '#F0F0F0', alignItems: 'center' },
  severityPillActive: { backgroundColor: COLORS.primary },
  severityText: { color: '#666', fontWeight: 'bold' },
  severityTextActive: { color: '#FFF' },
  textArea: { height: 100 },
  button: { backgroundColor: COLORS.primary, padding: 16, borderRadius: BORDER_RADIUS.md, alignItems: 'center', marginTop: SPACING.sm },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
});
