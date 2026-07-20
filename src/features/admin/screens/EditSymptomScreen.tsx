import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, BORDER_RADIUS } from '../../../theme';
import { api } from '../../../services/api';

interface ApiSymptom {
  symptomId: string;
  name: string;
  cropName: string;
  description: string;
  cause?: string;
  remedy?: string;
  prevention?: string;
  severity: string;
}

export const EditSymptomScreen = ({ route, navigation }: any) => {
  const { symptom }: { symptom: ApiSymptom } = route.params;

  const [name,        setName]        = useState(symptom.name);
  const [cropName,    setCropName]    = useState(symptom.cropName);
  const [description, setDescription] = useState(symptom.description ?? '');
  const [cause,       setCause]       = useState(symptom.cause ?? '');
  const [remedy,      setRemedy]      = useState(symptom.remedy ?? '');
  const [prevention,  setPrevention]  = useState(symptom.prevention ?? '');
  const [severity,    setSeverity]    = useState(symptom.severity);
  const [loading,     setLoading]     = useState(false);

  const handleUpdate = async () => {
    if (!name.trim() || !cropName.trim()) {
      Alert.alert('Error', 'Symptom name and crop name are required');
      return;
    }
    setLoading(true);
    try {
      await api.put(`/symptoms/${symptom.symptomId}`, {
        name:        name.trim(),
        cropName:    cropName.trim(),
        description: description.trim(),
        cause:       cause.trim(),
        remedy:      remedy.trim(),
        prevention:  prevention.trim(),
        severity,
      });
      Alert.alert('Success', 'Symptom updated successfully');
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to update symptom');
    } finally {
      setLoading(false);
    }
  };

  const severities = ['LOW', 'MEDIUM', 'HIGH'];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.field}>
          <Text style={styles.label}>Symptom Name *</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Crop Name *</Text>
          <TextInput style={styles.input} value={cropName} onChangeText={setCropName} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Severity</Text>
          <View style={styles.severityRow}>
            {severities.map(s => (
              <TouchableOpacity key={s} style={[styles.sevBtn, severity === s && styles.sevBtnActive]} onPress={() => setSeverity(s)}>
                <Text style={[styles.sevText, severity === s && styles.sevTextActive]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Description</Text>
          <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription} multiline numberOfLines={3} textAlignVertical="top" />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Cause</Text>
          <TextInput style={styles.input} value={cause} onChangeText={setCause} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Remedy</Text>
          <TextInput style={[styles.input, styles.textArea]} value={remedy} onChangeText={setRemedy} multiline numberOfLines={3} textAlignVertical="top" />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Prevention</Text>
          <TextInput style={styles.input} value={prevention} onChangeText={setPrevention} />
        </View>
        <TouchableOpacity style={[styles.button, loading && { opacity: 0.7 }]} onPress={handleUpdate} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Saving...' : 'Update Symptom'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: COLORS.background },
  container:     { padding: SPACING.lg },
  field:         { marginBottom: SPACING.lg },
  label:         { fontSize: 14, color: COLORS.text, marginBottom: SPACING.xs, fontWeight: '600' },
  input:         { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, fontSize: 16, color: COLORS.text },
  textArea:      { height: 80 },
  severityRow:   { flexDirection: 'row', gap: 10 },
  sevBtn:        { flex: 1, padding: 10, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', backgroundColor: COLORS.surface },
  sevBtnActive:  { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  sevText:       { fontSize: 14, color: COLORS.text, fontWeight: '600' },
  sevTextActive: { color: '#fff' },
  button:        { backgroundColor: COLORS.primary, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, alignItems: 'center', marginTop: SPACING.md },
  buttonText:    { color: 'white', fontSize: 16, fontWeight: 'bold' },
});
