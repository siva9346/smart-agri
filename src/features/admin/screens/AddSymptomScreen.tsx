import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, SafeAreaView, Alert } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS } from '../../../theme';
import { api } from '../../../services/api';

export const AddSymptomScreen = ({ navigation, route }: any) => {
  const [name,        setName]        = useState('');
  const [cropName,    setCropName]    = useState('');
  const [description, setDescription] = useState('');
  const [cause,       setCause]       = useState('');
  const [remedy,      setRemedy]      = useState('');
  const [prevention,  setPrevention]  = useState('');
  const [severity,    setSeverity]    = useState('MEDIUM');
  const [loading,     setLoading]     = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !cropName.trim()) {
      Alert.alert('Error', 'Symptom name and crop name are required');
      return;
    }
    setLoading(true);
    try {
      await api.post('/symptoms', {
        name:        name.trim(),
        cropName:    cropName.trim(),
        description: description.trim(),
        cause:       cause.trim(),
        remedy:      remedy.trim(),
        prevention:  prevention.trim(),
        severity,
      });
      Alert.alert('Success', 'Symptom record added');
      route.params?.onAdded?.();
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to add symptom');
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
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Yellow leaf spots" />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Crop Name *</Text>
          <TextInput style={styles.input} value={cropName} onChangeText={setCropName} placeholder="e.g. Paddy, Banana" />
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
          <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription} placeholder="Visual symptoms..." multiline numberOfLines={3} textAlignVertical="top" />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Cause</Text>
          <TextInput style={styles.input} value={cause} onChangeText={setCause} placeholder="Fungal / bacterial / nutrient deficiency..." />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Remedy</Text>
          <TextInput style={[styles.input, styles.textArea]} value={remedy} onChangeText={setRemedy} placeholder="Treatment steps..." multiline numberOfLines={3} textAlignVertical="top" />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Prevention</Text>
          <TextInput style={styles.input} value={prevention} onChangeText={setPrevention} placeholder="Preventive measures..." />
        </View>
        <TouchableOpacity style={[styles.button, loading && { opacity: 0.7 }]} onPress={handleSave} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Saving...' : 'Add Symptom'}</Text>
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
