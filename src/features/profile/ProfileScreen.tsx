import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, KeyboardAvoidingView, Platform, ScrollView, Modal, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch } from 'react-redux';
import { AlertTriangle, Trash2 } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS } from '../../theme';
import { api } from '../../services/api';
import { LoadingState } from '../../components/States';
import { logout } from '../../store/authSlice';
import { AppDispatch } from '../../store';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const DELETE_CONFIRM_WORD = 'DELETE';

interface Profile {
  userId: string;
  name: string;
  phone: string;
  role: string;
  email?: string;
  village?: string;
  district?: string;
  createdAt?: string;
  deletionStatus?: string;
  deletionRequestedAt?: string;
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
  const dispatch = useDispatch<AppDispatch>();
  const [profile, setProfile]   = useState<Profile | null>(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);

  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [village, setVillage]   = useState('');
  const [district, setDistrict] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword]         = useState('');
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText]   = useState('');
  const [deletingAccount, setDeletingAccount]       = useState(false);
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

  const openDeleteModal = () => { setDeleteConfirmText(''); setDeleteModalVisible(true); };
  const closeDeleteModal = () => { if (!deletingAccount) { setDeleteModalVisible(false); setDeleteConfirmText(''); } };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText.trim().toUpperCase() !== DELETE_CONFIRM_WORD) return;
    setDeletingAccount(true);
    try {
      await api.post('/account/delete', {});
      setDeleteModalVisible(false);
      Alert.alert(
        'Account Deletion Requested',
        'Your account has been scheduled for permanent deletion. You will now be signed out.',
        [{ text: 'OK', onPress: () => dispatch(logout()) }]
      );
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to request account deletion. Please try again.');
    } finally {
      setDeletingAccount(false);
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
                  <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Full name" placeholderTextColor="#9E9E9E" />
                </View>
                <View style={styles.field}>
                  <Text style={styles.label}>Email</Text>
                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="you@example.com"
                    placeholderTextColor="#9E9E9E"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                {isFarmer && (
                  <>
                    <View style={styles.field}>
                      <Text style={styles.label}>Village</Text>
                      <TextInput style={styles.input} value={village} onChangeText={setVillage} placeholder="e.g. Avadi" placeholderTextColor="#9E9E9E" />
                    </View>
                    <View style={styles.field}>
                      <Text style={styles.label}>District</Text>
                      <TextInput style={styles.input} value={district} onChangeText={setDistrict} placeholder="e.g. Chennai" placeholderTextColor="#9E9E9E" />
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
              <TextInput style={styles.input} value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry placeholder="Current password" placeholderTextColor="#9E9E9E" />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>New Password</Text>
              <TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword} secureTextEntry placeholder="At least 6 characters" placeholderTextColor="#9E9E9E" />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Confirm New Password</Text>
              <TextInput style={styles.input} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry placeholder="Re-enter new password" placeholderTextColor="#9E9E9E" />
            </View>
            <TouchableOpacity
              style={[styles.button, styles.secondaryButton, changingPassword && { opacity: 0.7 }]}
              onPress={handleChangePassword}
              disabled={changingPassword}
            >
              <Text style={styles.buttonText}>{changingPassword ? 'Updating...' : 'Change Password'}</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.section, styles.dangerSection]}>
            <Text style={[styles.sectionTitle, styles.dangerTitle]}>Danger Zone</Text>
            {profile.deletionStatus === 'PENDING' ? (
              <View style={styles.pendingBox}>
                <AlertTriangle size={18} color="#E65100" />
                <Text style={styles.pendingText}>
                  Deletion requested on {profile.deletionRequestedAt?.split('T')[0]}. Your account and data will be
                  permanently deleted after the 30-day retention period. Contact support if you'd like to cancel this.
                </Text>
              </View>
            ) : (
              <>
                <Text style={styles.hint}>
                  Permanently delete your account and all associated data. This cannot be undone once the retention
                  period ends.
                </Text>
                <TouchableOpacity style={styles.deleteBtn} onPress={openDeleteModal}>
                  <Trash2 size={16} color={COLORS.error} />
                  <Text style={styles.deleteBtnText}>Delete Account</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={deleteModalVisible} transparent animationType="slide" onRequestClose={closeDeleteModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconRow}>
              <AlertTriangle size={44} color={COLORS.error} />
            </View>
            <Text style={styles.modalTitle}>Delete your account?</Text>
            <Text style={styles.modalBody}>
              This will permanently delete your profile, lands, crop cycles, activities, expenses, photos, and
              notifications after the retention period.
            </Text>
            <Text style={styles.modalHint}>
              Your account will be deactivated immediately and permanently erased after a 30-day retention period.
            </Text>

            <Text style={styles.confirmLabel}>Type DELETE to confirm</Text>
            <TextInput
              style={styles.confirmInput}
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              placeholder="DELETE"
              placeholderTextColor="#BBB"
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!deletingAccount}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={closeDeleteModal} disabled={deletingAccount}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalConfirm,
                  (deleteConfirmText.trim().toUpperCase() !== DELETE_CONFIRM_WORD || deletingAccount) && styles.modalConfirmDisabled,
                ]}
                onPress={handleDeleteAccount}
                disabled={deleteConfirmText.trim().toUpperCase() !== DELETE_CONFIRM_WORD || deletingAccount}
              >
                {deletingAccount ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Trash2 size={16} color="#FFF" />
                )}
                <Text style={styles.modalConfirmText}>{deletingAccount ? 'Deleting…' : 'Delete Account'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  // Danger zone
  dangerSection: { borderWidth: 1, borderColor: '#FFCDD2' },
  dangerTitle:   { color: COLORS.error },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderColor: COLORS.error, borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
  },
  deleteBtnText: { color: COLORS.error, fontSize: 15, fontWeight: 'bold' },
  pendingBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#FFF3E0', borderRadius: BORDER_RADIUS.md, padding: SPACING.md,
  },
  pendingText: { flex: 1, fontSize: 13, color: '#5D4037', lineHeight: 19 },
  // Delete confirmation modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: SPACING.xl, paddingBottom: 40,
  },
  modalIconRow: { alignItems: 'center', marginBottom: SPACING.md },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text, marginBottom: 8, textAlign: 'center' },
  modalBody: {
    fontSize: 14, color: COLORS.text, textAlign: 'center',
    lineHeight: 20, marginBottom: SPACING.sm,
  },
  modalHint: {
    fontSize: 12, color: COLORS.textSecondary, textAlign: 'center',
    lineHeight: 18, marginBottom: SPACING.lg,
  },
  confirmLabel: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: SPACING.xs },
  confirmInput: {
    backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md, padding: SPACING.md, fontSize: 16, color: COLORS.text,
    marginBottom: SPACING.lg, textAlign: 'center', fontWeight: 'bold', letterSpacing: 1,
  },
  modalActions: { flexDirection: 'row', gap: SPACING.md },
  modalCancel: {
    flex: 1, padding: 14, borderRadius: BORDER_RADIUS.md,
    backgroundColor: '#F5F5F5', alignItems: 'center',
  },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: COLORS.textSecondary },
  modalConfirm: {
    flex: 2, flexDirection: 'row', padding: 14, borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.error, alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  modalConfirmDisabled: { opacity: 0.5 },
  modalConfirmText: { fontSize: 15, fontWeight: 'bold', color: '#FFF' },
});
