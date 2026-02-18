import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS } from '../../theme';
import { mockRepository } from '../../repositories/MockRepository';

export const AddLandScreen = ({ navigation }: any) => {
  const [form, setForm] = useState({
    area: '',
    cropType: '',
    location: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!form.area || !form.cropType || !form.location) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }

    setLoading(true);
    try {
      const res = await mockRepository.addLand({
        ...form,
        farmerId: '1'
      });
      if (res.success) {
        Alert.alert('Success', 'Land added successfully');
        navigation.goBack();
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to save land');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.field}>
        <Text style={styles.label}>Land Area (e.g. 2 Acres)</Text>
        <TextInput
          style={styles.input}
          value={form.area}
          onChangeText={(val) => setForm({ ...form, area: val })}
          placeholder="Enter area"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Crop Type</Text>
        <TextInput
          style={styles.input}
          value={form.cropType}
          onChangeText={(val) => setForm({ ...form, cropType: val })}
          placeholder="e.g. Rice, Wheat"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Location</Text>
        <TextInput
          style={styles.input}
          value={form.location}
          onChangeText={(val) => setForm({ ...form, location: val })}
          placeholder="Enter field location"
        />
      </View>

      <TouchableOpacity 
        style={[styles.button, loading ? { opacity: 0.7 } : null]} 
        onPress={handleSave}
        disabled={Boolean(loading)}
      >
        <Text style={styles.buttonText}>{loading ? 'Saving...' : 'Save Land'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: SPACING.lg,
    backgroundColor: COLORS.background,
  },
  field: {
    marginBottom: SPACING.lg,
  },
  label: {
    fontSize: 14,
    color: COLORS.text,
    marginBottom: SPACING.xs,
    fontWeight: '500',
  },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: 16,
  },
  button: {
    backgroundColor: COLORS.primary,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
