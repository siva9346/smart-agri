import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, SafeAreaView, Alert } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS } from '../../../theme';

export const EditSymptomScreen = ({ route, navigation }: any) => {
  const { symptom } = route.params;

  const [title, setTitle] = useState(symptom.title);
  const [description, setDescription] = useState(symptom.description);
  const [crop, setCrop] = useState(symptom.crop);
  const [severity, setSeverity] = useState(symptom.severity);

  const handleUpdate = () => {
    if (!title || !description || !crop) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    const updatedSymptom = {
      ...symptom,
      title,
      description,
      crop,
      severity
    };

    Alert.alert('Success', 'Symptom updated successfully', [
      { text: 'OK', onPress: () => navigation.navigate('SymptomsList', { updatedSymptom }) }
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>Edit {symptom.title}</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Symptom Title *</Text>
            <TextInput style={styles.input} value={title} onChangeText={setTitle} />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Target Crop *</Text>
            <TextInput style={styles.input} value={crop} onChangeText={setCrop} />
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
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              value={description}
              onChangeText={setDescription}
            />
          </View>

          <TouchableOpacity style={styles.button} onPress={handleUpdate}>
            <Text style={styles.buttonText}>Update Symptom</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  content: { padding: SPACING.md },
  card: { backgroundColor: '#FFF', padding: SPACING.lg, borderRadius: BORDER_RADIUS.lg, elevation: 2 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: SPACING.xl, textAlign: 'center' },
  field: { marginBottom: SPACING.lg },
  label: { fontSize: 14, color: '#333', marginBottom: 8, fontWeight: '500' },
  input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: BORDER_RADIUS.md, padding: 12, fontSize: 15 },
  severityRow: { flexDirection: 'row', justifyContent: 'space-between' },
  severityPill: { flex: 1, paddingVertical: 10, marginHorizontal: 4, borderRadius: BORDER_RADIUS.md, backgroundColor: '#F0F0F0', alignItems: 'center' },
  severityPillActive: { backgroundColor: COLORS.secondary },
  severityText: { color: '#666', fontWeight: 'bold' },
  severityTextActive: { color: '#FFF' },
  textArea: { height: 100 },
  button: { backgroundColor: COLORS.secondary, padding: 16, borderRadius: BORDER_RADIUS.md, alignItems: 'center', marginTop: SPACING.sm },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
});
