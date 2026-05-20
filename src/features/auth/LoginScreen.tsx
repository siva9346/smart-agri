import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, BORDER_RADIUS } from '../../theme';
import { mockRepository } from '../../repositories/MockRepository';
import { LoadingState } from '../../components/States';

const OTP_LENGTH = 4;

export const LoginScreen = ({ onLoginSuccess }: { onLoginSuccess: (user: any) => void }) => {
  const [phone, setPhone] = useState('1234567890');
  const [otpDigits, setOtpDigits] = useState<string[]>(['1', '2', '3', '4']);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const inputRefs = useRef<(TextInput | null)[]>([]);

  const handleOtpChange = (text: string, index: number) => {
    const digit = text.replace(/[^0-9]/g, '').slice(-1);
    const updated = [...otpDigits];
    updated[index] = digit;
    setOtpDigits(updated);
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace') {
      const updated = [...otpDigits];
      if (updated[index]) {
        updated[index] = '';
        setOtpDigits(updated);
      } else if (index > 0) {
        updated[index - 1] = '';
        setOtpDigits(updated);
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  const handleLogin = async () => {
    const otp = otpDigits.join('');
    if (!phone || otp.length < OTP_LENGTH) {
      Alert.alert('Error', 'Please enter phone number and complete OTP');
      return;
    }

    setLoading(true);
    try {
      const response = await mockRepository.login(phone, otp);
      if (response.success) {
        onLoginSuccess(response.data);
      } else {
        Alert.alert('Error', response.error || 'Login failed');
      }
    } catch {
      Alert.alert('Error', 'Something went wrong');
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
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.logoContainer}>
            <Image
              source={require('../../../assets/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <View style={styles.headerContainer}>
            <Text style={styles.title}>Naveena Uzhavan</Text>
            <Text style={styles.subtitle}>Smart Agri</Text>
          </View>

          {/* Phone */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="Enter phone number"
              placeholderTextColor="#9E9E9E"
              keyboardType="phone-pad"
            />
          </View>

          {/* OTP — 4-box */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>OTP</Text>
            <View style={styles.otpRow}>
              {Array.from({ length: OTP_LENGTH }).map((_, i) => (
                <TextInput
                  key={i}
                  ref={(ref) => { inputRefs.current[i] = ref; }}
                  style={[
                    styles.otpBox,
                    focusedIndex === i && styles.otpBoxFocused,
                    otpDigits[i] ? styles.otpBoxFilled : null,
                  ]}
                  value={otpDigits[i]}
                  onChangeText={(text) => handleOtpChange(text, i)}
                  onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
                  onFocus={() => setFocusedIndex(i)}
                  onBlur={() => setFocusedIndex(null)}
                  keyboardType="number-pad"
                  maxLength={1}
                  selectTextOnFocus
                  caretHidden={false}
                  textAlign="center"
                />
              ))}
            </View>
            <Text style={styles.otpHint}>Enter the 4-digit OTP sent to your phone</Text>
          </View>

          <TouchableOpacity style={styles.button} onPress={handleLogin}>
            <Text style={styles.buttonText}>Login</Text>
          </TouchableOpacity>

          <Text style={styles.hint}>
            Try 1234567890 for Farmer, 9999999999 for Admin
          </Text>
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
  logoContainer: {
    alignItems: 'center',
  },
  logo: {
    width: 250,
    height: 250,
  },
  headerContainer: {
    alignItems: 'stretch',
    marginBottom: SPACING.xl,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    alignSelf: 'flex-end',
    fontWeight: '600',
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
  // OTP boxes
  otpRow: {
    flexDirection: 'row',
    gap: 12,
  },
  otpBox: {
    flex: 1,
    height: 60,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#C8E6C9',
    borderRadius: BORDER_RADIUS.md,
    fontSize: 26,
    fontWeight: '700',
    color: '#212121',
    textAlign: 'center',
  },
  otpBoxFocused: {
    borderColor: COLORS.primary,
    borderWidth: 2.5,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  otpBoxFilled: {
    backgroundColor: '#F1F8E9',
    borderColor: COLORS.primary,
  },
  otpHint: {
    marginTop: 8,
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
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
  hint: {
    marginTop: SPACING.xl,
    color: COLORS.textSecondary,
    textAlign: 'center',
    fontSize: 12,
  },
});
