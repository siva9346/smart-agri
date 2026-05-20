import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  ScrollView, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, BORDER_RADIUS } from '../../theme';
import { Sprout, Calendar, Layers, Save, ArrowLeft } from 'lucide-react-native';
import { useDispatch } from 'react-redux';
import { addCropCycle } from '../../store/cropSlice';

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const AddCropCycleScreen = ({ route, navigation }: any) => {
  const dispatch = useDispatch();
  const { landId, landName } = route.params;

  const [cropName, setCropName] = useState('');
  const [startDate, setStartDate] = useState(todayStr());
  const [area, setArea] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!cropName.trim()) e.cropName = 'Please enter crop name';
    if (!area.trim()) e.area = 'Please enter area';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    dispatch(addCropCycle({
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      landId,
      cropName: cropName.trim(),
      startDate,
      area: area.trim() + (area.includes('Acre') ? '' : ' Acres'),
      cropAge: 0,
      status: 'current',
    }));
    Alert.alert('Success', `${cropName} cultivation cycle started!`, [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>New Cultivation Cycle</Text>
          <Text style={styles.headerSub}>Start tracking a new crop</Text>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">

          {/* Land badge */}
          <View style={styles.landBadge}>
            <Layers size={15} color={COLORS.primary} />
            <Text style={styles.landBadgeText}>{landName}</Text>
          </View>

          {/* Crop Name */}
          <View style={styles.field}>
            <View style={styles.fieldLabel}>
              <Sprout size={15} color={COLORS.primary} />
              <Text style={styles.labelText}>Crop Name</Text>
            </View>
            <TextInput
              style={[styles.input, errors.cropName && styles.inputError]}
              placeholder="e.g. Paddy, Banana, Groundnut"
              value={cropName}
              onChangeText={v => { setCropName(v); setErrors(p => ({ ...p, cropName: '' })); }}
            />
            {!!errors.cropName && <Text style={styles.errorText}>{errors.cropName}</Text>}
          </View>

          {/* Start Date */}
          <View style={styles.field}>
            <View style={styles.fieldLabel}>
              <Calendar size={15} color={COLORS.primary} />
              <Text style={styles.labelText}>Start Date</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              value={startDate}
              onChangeText={setStartDate}
            />
          </View>

          {/* Area */}
          <View style={styles.field}>
            <View style={styles.fieldLabel}>
              <Layers size={15} color={COLORS.primary} />
              <Text style={styles.labelText}>Area (Acres)</Text>
            </View>
            <TextInput
              style={[styles.input, errors.area && styles.inputError]}
              placeholder="e.g. 1.5"
              keyboardType="decimal-pad"
              value={area}
              onChangeText={v => { setArea(v); setErrors(p => ({ ...p, area: '' })); }}
            />
            {!!errors.area && <Text style={styles.errorText}>{errors.area}</Text>}
          </View>

          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} activeOpacity={0.85}>
            <Save size={20} color="#FFF" />
            <Text style={styles.submitBtnText}>Start Cultivation</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F0F4F8' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF', paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#E8EDF2',
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: '#F5F5F5',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A1A' },
  headerSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  form: { padding: SPACING.md, paddingBottom: 40 },
  landBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#E8F5E9', paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 20, alignSelf: 'flex-start', marginBottom: SPACING.xl,
    borderWidth: 1, borderColor: '#C8E6C9', gap: 6,
  },
  landBadgeText: { fontSize: 14, fontWeight: '600', color: COLORS.primary },
  field: {
    backgroundColor: '#FFF', borderRadius: 14, padding: SPACING.md,
    marginBottom: SPACING.md,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4,
  },
  fieldLabel: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: SPACING.sm, gap: 6,
  },
  labelText: { fontSize: 14, fontWeight: '700', color: '#2C2C2C' },
  input: {
    backgroundColor: '#F7F9FC', borderRadius: 10,
    borderWidth: 1.5, borderColor: '#E0E6EE',
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#333',
  },
  inputError: { borderColor: COLORS.error },
  errorText: { fontSize: 12, color: COLORS.error, marginTop: 4 },
  submitBtn: {
    flexDirection: 'row', backgroundColor: COLORS.primary,
    paddingVertical: 16, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
    marginTop: SPACING.lg, gap: 10,
    elevation: 4, shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
  },
  submitBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
