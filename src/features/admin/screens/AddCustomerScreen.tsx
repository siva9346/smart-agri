import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, BORDER_RADIUS } from '../../../theme';
import { api } from '../../../services/api';

export const AddCustomerScreen = ({ navigation }: any) => {
  const [name,     setName]     = useState('');
  const [phone,    setPhone]    = useState('');
  const [village,  setVillage]  = useState('');
  const [district, setDistrict] = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !phone.trim()) {
      Alert.alert('Error', 'Name and phone are required');
      return;
    }
    if (phone.length !== 10) {
      Alert.alert('Error', 'Phone must be 10 digits');
      return;
    }
    setLoading(true);
    try {
      await api.post('/farmers', {
        name:     name.trim(),
        phone:    phone.trim(),
        village:  village.trim(),
        district: district.trim(),
        password: password.trim() || 'Welcome@123',
      });
      Alert.alert('Success', `Farmer ${name} registered successfully.\nDefault password: ${password.trim() || 'Welcome@123'}`);
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to register farmer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.field}>
          <Text style={styles.label}>Full Name *</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Murugan Kumar" />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Phone Number *</Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="10-digit mobile number" keyboardType="phone-pad" maxLength={10} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Village</Text>
          <TextInput style={styles.input} value={village} onChangeText={setVillage} placeholder="e.g. Avadi" />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>District</Text>
          <TextInput style={styles.input} value={district} onChangeText={setDistrict} placeholder="e.g. Chennai" />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Password (optional)</Text>
          <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Default: Welcome@123" secureTextEntry />
        </View>
        <TouchableOpacity style={[styles.button, loading && { opacity: 0.7 }]} onPress={handleSave} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Registering...' : 'Register Farmer'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: COLORS.background },
  container:  { padding: SPACING.lg },
  field:      { marginBottom: SPACING.lg },
  label:      { fontSize: 14, color: COLORS.text, marginBottom: SPACING.xs, fontWeight: '600' },
  input:      { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, fontSize: 16, color: COLORS.text },
  button:     { backgroundColor: COLORS.primary, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, alignItems: 'center', marginTop: SPACING.md },
  buttonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
});
