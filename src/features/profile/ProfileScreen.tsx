import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, BORDER_RADIUS } from '../../theme';
import { api } from '../../services/api';
import { LoadingState } from '../../components/States';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

interface Profile {
  userId: string;
  name: string;
  phone: string;
  role: string;
  email?: string;
  village?: string;
  district?: string;
  createdAt?: string;
}

const isProfileComplete = (p: Profile) => {
  if (!p.email) return false;
  if (p.role === 'FARMER' && (!p.village || !p.district)) return false;
  return true;
};

const ROLE_LABELS: Record<string, string> = {
  FARMER: 'Customer',
  ADMIN: 'Admin',
  SUPER_ADMIN: 'Super Admin',
};

export const ProfileScreen = () => {
  const [profile, setProfile]   = useState<Profile | null>(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);

  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [village, setVillage]   = useState('');
  const [district, setDistrict] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = await api.get<Profile>('/auth/me');
      setProfile(p);
      setName(p.name || '');
      setEmail(p.email || '');
      setVillage(p.village || '');
      setDistrict(p.district || '');
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }
    if (!email.trim() || !EMAIL_RE.test(email.trim())) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }
    if (profile?.role === 'FARMER' && (!village.trim() || !district.trim())) {
      Alert.alert('Error', 'Village and district are required');
      return;
    }

    setSaving(true);
    try {
      await api.put('/auth/me', {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        village: village.trim(),
        district: district.trim(),
      });
      Alert.alert('Success', 'Profile saved.');
      await load();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      Alert.alert('Error', 'Enter your current and new password');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Error', 'New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }

    setChangingPassword(true);
    try {
      await api.put('/auth/change-password', { currentPassword, newPassword });
      Alert.alert('Success', 'Password changed.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading || !profile) return <LoadingState />;

  const complete = isProfileComplete(profile);
  const isFarmer = profile.role === 'FARMER';

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account Details</Text>
            {!complete && (
              <Text style={styles.hint}>
                Fill in your details below. Once saved, these become view-only — contact support to change them later.
              </Text>
            )}

            <View style={styles.field}>
              <Text style={styles.label}>Role</Text>
              <Text style={styles.readonlyValue}>{ROLE_LABELS[profile.role] ?? profile.role}</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Phone Number</Text>
              <Text style={styles.readonlyValue}>{profile.phone}</Text>
            </View>

            {complete ? (
              <>
                <View style={styles.field}>
                  <Text style={styles.label}>Name</Text>
                  <Text style={styles.readonlyValue}>{profile.name}</Text>
                </View>
                <View style={styles.field}>
                  <Text style={styles.label}>Email</Text>
                  <Text style={styles.readonlyValue}>{profile.email}</Text>
                </View>
                {isFarmer && (
                  <>
                    <View style={styles.field}>
                      <Text style={styles.label}>Village</Text>
                      <Text style={styles.readonlyValue}>{profile.village}</Text>
                    </View>
                    <View style={styles.field}>
                      <Text style={styles.label}>District</Text>
                      <Text style={styles.readonlyValue}>{profile.district}</Text>
                    </View>
                  </>
                )}
              </>
            ) : (
              <>
                <View style={styles.field}>
                  <Text style={styles.label}>Name</Text>
                  <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Full name" />
                </View>
                <View style={styles.field}>
                  <Text style={styles.label}>Email</Text>
                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="you@example.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                {isFarmer && (
                  <>
                    <View style={styles.field}>
                      <Text style={styles.label}>Village</Text>
                      <TextInput style={styles.input} value={village} onChangeText={setVillage} placeholder="e.g. Avadi" />
                    </View>
                    <View style={styles.field}>
                      <Text style={styles.label}>District</Text>
                      <TextInput style={styles.input} value={district} onChangeText={setDistrict} placeholder="e.g. Chennai" />
                    </View>
                  </>
                )}
                <TouchableOpacity style={[styles.button, saving && { opacity: 0.7 }]} onPress={handleSaveProfile} disabled={saving}>
                  <Text style={styles.buttonText}>{saving ? 'Saving...' : 'Save Profile'}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Change Password</Text>
            <View style={styles.field}>
              <Text style={styles.label}>Current Password</Text>
              <TextInput style={styles.input} value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry placeholder="Current password" />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>New Password</Text>
              <TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword} secureTextEntry placeholder="At least 6 characters" />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Confirm New Password</Text>
              <TextInput style={styles.input} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry placeholder="Re-enter new password" />
            </View>
            <TouchableOpacity
              style={[styles.button, styles.secondaryButton, changingPassword && { opacity: 0.7 }]}
              onPress={handleChangePassword}
              disabled={changingPassword}
            >
              <Text style={styles.buttonText}>{changingPassword ? 'Updating...' : 'Change Password'}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: COLORS.background },
  container: { padding: SPACING.lg },
  section: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text, marginBottom: SPACING.sm },
  hint:         { fontSize: 12, color: COLORS.textSecondary, marginBottom: SPACING.md },
  field:        { marginBottom: SPACING.md },
  label:        { fontSize: 13, color: COLORS.text, marginBottom: SPACING.xs, fontWeight: '600' },
  readonlyValue: { fontSize: 16, color: COLORS.text, paddingVertical: SPACING.sm },
  input: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: 16,
    color: COLORS.text,
  },
  button: {
    backgroundColor: COLORS.primary,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  secondaryButton: { backgroundColor: COLORS.secondary },
  buttonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
});
