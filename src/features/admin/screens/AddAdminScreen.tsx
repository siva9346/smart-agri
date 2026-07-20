import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, BORDER_RADIUS } from '../../../theme';
import { api } from '../../../services/api';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

type AdminRole = 'ADMIN' | 'SUPER_ADMIN';

const ROLE_OPTIONS: { value: AdminRole; label: string; hint: string }[] = [
  { value: 'ADMIN', label: 'Admin', hint: 'Full operational access. Cannot add more admins.' },
  { value: 'SUPER_ADMIN', label: 'Super Admin', hint: 'Full access, and can also add admins. Limited to 5 super admin accounts total.' },
];

export const AddAdminScreen = ({ navigation }: any) => {
  const [name,     setName]     = useState('');
  const [phone,    setPhone]    = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [role,     setRole]     = useState<AdminRole>('ADMIN');
  const [loading,  setLoading]  = useState(false);

  const handleSave = async () => {
    const trimmedName  = name.trim();
    const trimmedPhone = phone.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName || !trimmedPhone || !trimmedEmail || !password) {
      Alert.alert('Error', 'All fields are required');
      return;
    }
    if (trimmedPhone.length !== 10) {
      Alert.alert('Error', 'Phone must be 10 digits');
      return;
    }
    if (!EMAIL_RE.test(trimmedEmail)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/register-admin', {
        name: trimmedName,
        phone: trimmedPhone,
        email: trimmedEmail,
        password,
        role,
      });
      Alert.alert('Success', `${role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'} ${trimmedName} was created.`);
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to create admin');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.hint}>
          Any number of Admin accounts can be created. Only 5 Super Admin accounts are allowed in total.
        </Text>

        <View style={styles.field}>
          <Text style={styles.label}>Role *</Text>
          <View style={styles.roleList}>
            {ROLE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.roleOption, role === opt.value && styles.roleOptionSelected]}
                onPress={() => setRole(opt.value)}
              >
                <Text style={[styles.roleOptionTitle, role === opt.value && styles.roleOptionTitleSelected]}>
                  {opt.label}
                </Text>
                <Text style={styles.roleOptionHint}>{opt.hint}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Full Name *</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Priya Raman" />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Phone Number *</Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="10-digit mobile number" keyboardType="phone-pad" maxLength={10} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Email *</Text>
          <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="admin@example.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Password *</Text>
          <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="At least 6 characters" secureTextEntry />
        </View>
        <TouchableOpacity style={[styles.button, loading && { opacity: 0.7 }]} onPress={handleSave} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Creating...' : `Create ${role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'}`}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: COLORS.background },
  container:  { padding: SPACING.lg },
  hint:       { fontSize: 13, color: COLORS.textSecondary, marginBottom: SPACING.lg },
  field:      { marginBottom: SPACING.lg },
  label:      { fontSize: 14, color: COLORS.text, marginBottom: SPACING.xs, fontWeight: '600' },
  input:      { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, fontSize: 16, color: COLORS.text },
  roleList:   { gap: SPACING.sm },
  roleOption: {
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
  },
  roleOptionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: '#E8F5E9',
  },
  roleOptionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 2 },
  roleOptionTitleSelected: { color: COLORS.primary },
  roleOptionHint: { fontSize: 12, color: COLORS.textSecondary },
  button:     { backgroundColor: COLORS.primary, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, alignItems: 'center', marginTop: SPACING.md },
  buttonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
});
