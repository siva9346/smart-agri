import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, BORDER_RADIUS } from '../../theme';
import { api } from '../../services/api';
import { LoadingState } from '../../components/States';

export const ForgotPasswordScreen = ({ navigation }: any) => {
  const [step, setStep] = useState<'phone' | 'reset'>('phone');
  const [phone, setPhone] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async () => {
    const p = phone.trim();
    if (p.length !== 10) {
      Alert.alert('Error', 'Enter a valid 10-digit phone number');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post<{ email: string }>('/auth/forgot-password/send-otp', { phone: p });
      setMaskedEmail(res.email);
      setStep('reset');
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not send OTP for this phone number');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    const code = otp.trim();
    if (!code) {
      Alert.alert('Error', 'Please enter the OTP sent to your email');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/forgot-password/verify-otp', {
        phone: phone.trim(),
        otp: code,
        newPassword,
      });
      Alert.alert('Success', 'Password updated. Please log in with your new password.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not reset password');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingState />;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.headerContainer}>
            <Text style={styles.title}>Forgot Password</Text>
            <Text style={styles.subtitle}>
              {step === 'phone'
                ? 'Enter the phone number on your account'
                : `Enter the OTP sent to ${maskedEmail}`}
            </Text>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={[styles.input, step === 'reset' && styles.inputDisabled]}
              value={phone}
              onChangeText={setPhone}
              placeholder="Enter 10-digit phone number"
              placeholderTextColor="#9E9E9E"
              keyboardType="phone-pad"
              maxLength={10}
              editable={step === 'phone'}
            />
          </View>

          {step === 'phone' ? (
            <TouchableOpacity style={styles.button} onPress={handleSendOtp}>
              <Text style={styles.buttonText}>Send OTP</Text>
            </TouchableOpacity>
          ) : (
            <>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>OTP</Text>
                <TextInput
                  style={styles.input}
                  value={otp}
                  onChangeText={setOtp}
                  placeholder="6-digit code"
                  placeholderTextColor="#9E9E9E"
                  keyboardType="number-pad"
                  maxLength={6}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>New Password</Text>
                <TextInput
                  style={styles.input}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="At least 6 characters"
                  placeholderTextColor="#9E9E9E"
                  secureTextEntry
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Confirm New Password</Text>
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Re-enter new password"
                  placeholderTextColor="#9E9E9E"
                  secureTextEntry
                />
              </View>

              <TouchableOpacity style={styles.button} onPress={handleReset}>
                <Text style={styles.buttonText}>Reset Password</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.linkButton} onPress={handleSendOtp}>
                <Text style={styles.linkText}>Resend OTP</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity style={styles.linkButton} onPress={() => navigation.goBack()}>
            <Text style={styles.linkText}>Back to Login</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flexGrow: 1,
    padding: SPACING.xl,
    justifyContent: 'center',
  },
  headerContainer: {
    marginBottom: SPACING.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  inputContainer: {
    marginBottom: SPACING.lg,
  },
  label: {
    fontSize: 14,
    color: COLORS.text,
    marginBottom: SPACING.xs,
    fontWeight: '600',
  },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: 16,
    color: COLORS.text,
  },
  inputDisabled: {
    backgroundColor: COLORS.background,
    color: COLORS.textSecondary,
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
    fontSize: 18,
    fontWeight: 'bold',
  },
  linkButton: {
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  linkText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },
});
