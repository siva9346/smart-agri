import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  Image,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, SPACING, BORDER_RADIUS } from '../../theme';
import {
  ArrowLeft,
  Camera,
  Save,
  Calendar,
  FileText,
  Tag,
  CheckCircle2,
  ImagePlus,
  Trash2,
  Activity,
} from 'lucide-react-native';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../../store';
import { addRecord } from '../../store/cropSlice';
import { api } from '../../services/api';

// ─── Activity Types ───────────────────────────────────────────────────────────

interface ActivityTypeConfig {
  value: string;
  label: string;
  emoji: string;
  showCost: boolean;
  showIncome: boolean;
  notesRequired: boolean;
  notesLabel: string;
  notesPlaceholder: string;
}

const ACTIVITY_TYPES: ActivityTypeConfig[] = [
  {
    value: 'Expense',
    label: 'Expense',
    emoji: '💰',
    showCost: true,
    showIncome: false,
    notesRequired: false,
    notesLabel: 'Notes',
    notesPlaceholder: 'Describe the expense — materials, vendor, quantity…',
  },
  {
    value: 'Weekly Condition',
    label: 'Weekly Condition',
    emoji: '📅',
    showCost: false,
    showIncome: false,
    notesRequired: false,
    notesLabel: 'Field Condition',
    notesPlaceholder: 'e.g. Heavy rain this week, good growth observed, soil dry…',
  },
  {
    value: 'Symptom',
    label: 'Symptom',
    emoji: '🔍',
    showCost: false,
    showIncome: false,
    notesRequired: false,
    notesLabel: 'Symptom Description',
    notesPlaceholder: 'Describe what you observed — leaf colour, pest, damage…',
  },
  {
    value: 'Enquiry',
    label: 'Enquiry',
    emoji: '❓',
    showCost: false,
    showIncome: false,
    notesRequired: true,
    notesLabel: 'Enquiry Details',
    notesPlaceholder: 'Describe your question or problem in detail…',
  },
  {
    value: 'Advice Received',
    label: 'Advice Received',
    emoji: '🎓',
    showCost: false,
    showIncome: false,
    notesRequired: false,
    notesLabel: 'Solution / Recommendation',
    notesPlaceholder: 'Write the expert advice or solution received…',
  },
  {
    value: 'Fertilizer Applied',
    label: 'Fertilizer Applied',
    emoji: '💉',
    showCost: true,
    showIncome: false,
    notesRequired: false,
    notesLabel: 'Application Notes',
    notesPlaceholder: 'Type of fertilizer, quantity applied, field area…',
  },
  {
    value: 'Irrigation',
    label: 'Irrigation',
    emoji: '💧',
    showCost: true,
    showIncome: false,
    notesRequired: false,
    notesLabel: 'Irrigation Notes',
    notesPlaceholder: 'Method used, duration, source of water…',
  },
  {
    value: 'Labour Work',
    label: 'Labour Work',
    emoji: '👷',
    showCost: true,
    showIncome: false,
    notesRequired: false,
    notesLabel: 'Work Description',
    notesPlaceholder: 'Number of workers, hours worked, task performed…',
  },
  {
    value: 'Harvest / Income',
    label: 'Harvest / Income',
    emoji: '🌾',
    showCost: false,
    showIncome: true,
    notesRequired: false,
    notesLabel: 'Harvest Notes',
    notesPlaceholder: 'Batch details, quality, market destination…',
  },
  {
    value: 'Other',
    label: 'Other',
    emoji: '📝',
    showCost: false,
    showIncome: false,
    notesRequired: false,
    notesLabel: 'Notes',
    notesPlaceholder: 'Describe the activity…',
  },
];

// Expense categories — stored as uppercase enums for backend compatibility
const EXPENSE_SUB_TYPES: { value: string; label: string; emoji: string }[] = [
  { value: 'PLOUGHING',  label: 'Ploughing',  emoji: '🚜' },
  { value: 'SEED',       label: 'Seed',       emoji: '🌱' },
  { value: 'LABOUR',     label: 'Labour',     emoji: '👷' },
  { value: 'WEEDING',    label: 'Weeding',    emoji: '🌿' },
  { value: 'FERTILIZER', label: 'Fertilizer', emoji: '💊' },
  { value: 'PESTICIDE',  label: 'Pesticide',  emoji: '🧴' },
  { value: 'IRRIGATION', label: 'Irrigation', emoji: '💧' },
  { value: 'TRANSPORT',  label: 'Transport',  emoji: '🚚' },
  { value: 'HARVESTING', label: 'Harvesting', emoji: '🌾' },
  { value: 'OTHER',      label: 'Others',     emoji: '📦' },
];

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// ─── Component ───────────────────────────────────────────────────────────────

const adaptRecord = (r: any) => ({
  id:           r.recordId,
  cropCycleId:  r.cycleId,
  date:         r.date,
  stage:        r.stage || r.activityType || '',
  costType:     r.costType || '',
  activityType: r.activityType || undefined,
  expense:      typeof r.expense === 'number' ? r.expense : parseFloat(r.expense ?? '0') || 0,
  incomeAmount: r.incomeAmount != null ? (typeof r.incomeAmount === 'number' ? r.incomeAmount : parseFloat(r.incomeAmount)) : undefined,
  quantity:     r.quantity || undefined,
  notes:        r.notes || '',
  image:        r.image || undefined,
});

export const AddExpenseEntryScreen = ({ route, navigation }: any) => {
  const dispatch = useDispatch<AppDispatch>();
  const { cropCycleId } = route.params || {};

  const [date, setDate] = useState(todayStr());
  const [activityType, setActivityType] = useState('');
  const [expenseSubType, setExpenseSubType] = useState('');
  const [amount, setAmount] = useState('');
  const [incomeAmount, setIncomeAmount] = useState('');
  const [quantityInput, setQuantityInput] = useState('');
  const [notes, setNotes] = useState('');
  const [image, setImage] = useState<{ uri: string; base64: string } | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const selectedActivity = ACTIVITY_TYPES.find(a => a.value === activityType);
  const showCostField = selectedActivity?.showCost ?? false;
  const showIncomeField = selectedActivity?.showIncome ?? false;
  const notesRequired = selectedActivity?.notesRequired ?? false;

  const validate = (): boolean => {
    const e: Record<string, string> = {};

    if (!activityType) {
      e.activityType = 'Please select an activity type';
    }

    if (activityType === 'Expense' && !expenseSubType) {
      e.expenseSubType = 'Please select the expense category';
    }

    if (amount.trim() !== '' && isNaN(Number(amount))) {
      e.amount = 'Please enter a valid number';
    }

    if (showIncomeField) {
      if (!incomeAmount.trim()) {
        e.incomeAmount = 'Income amount is required';
      } else if (isNaN(Number(incomeAmount)) || Number(incomeAmount) < 0) {
        e.incomeAmount = 'Please enter a valid amount';
      }
    }

    if (notesRequired && !notes.trim()) {
      e.notes = `${selectedActivity?.notesLabel ?? 'Notes'} is required`;
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const openPickerSheet = () => setPickerVisible(true);
  const closePickerSheet = () => setPickerVisible(false);
  const removeImage = () => setImage(null);

  const showPermissionDeniedAlert = (source: 'camera' | 'photo library') => {
    Alert.alert(
      'Permission Needed',
      `Please allow ${source} access in Settings to attach a photo.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]
    );
  };

  const pickFromCamera = async () => {
    closePickerSheet();
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      showPermissionDeniedAlert('camera');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled && result.assets?.[0]?.base64) {
      setImage({ uri: result.assets[0].uri, base64: result.assets[0].base64 });
    }
  };

  const pickFromGallery = async () => {
    closePickerSheet();
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showPermissionDeniedAlert('photo library');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled && result.assets?.[0]?.base64) {
      setImage({ uri: result.assets[0].uri, base64: result.assets[0].base64 });
    }
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    const costTypeValue = activityType === 'Expense' ? expenseSubType : activityType;
    setSaving(true);
    try {
      let imageUrl: string | undefined;
      if (image) {
        try {
          const uploadRes = await api.post<{ url: string }>('/records/upload-photo', {
            image: image.base64,
            contentType: 'image/jpeg',
          });
          imageUrl = uploadRes.url;
        } catch (err: any) {
          Alert.alert('Photo Upload Failed', err?.message ?? 'Could not upload the photo. Please try again.');
          setSaving(false);
          return;
        }
      }

      const res = await api.post<any>('/records', {
        cycleId:      cropCycleId,
        date,
        stage:        activityType,
        costType:     costTypeValue,
        activityType,
        expense:      showIncomeField ? 0 : (amount.trim() ? Number(amount) : 0),
        incomeAmount: showIncomeField && incomeAmount.trim() ? Number(incomeAmount) : undefined,
        quantity:     showIncomeField && quantityInput.trim() ? quantityInput.trim() : undefined,
        notes,
        image:        imageUrl,
      });
      dispatch(addRecord(adaptRecord(res)));
      Alert.alert('Saved!', 'Activity record added successfully.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to save record. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Add Activity Record</Text>
          <Text style={styles.headerSubtitle}>Track any farming activity</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── Date ── */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionLabelRow}>
              <Calendar size={16} color={COLORS.primary} />
              <Text style={styles.sectionLabel}>Date</Text>
            </View>
            <View style={styles.dateInputRow}>
              <View style={styles.dateIconBox}>
                <Calendar size={20} color={COLORS.primary} />
              </View>
              <TextInput
                style={styles.dateInput}
                value={date}
                onChangeText={setDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#BDBDBD"
              />
            </View>
          </View>

          {/* ── Activity Type ── */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionLabelRow}>
              <Activity size={16} color={COLORS.primary} />
              <Text style={styles.sectionLabel}>Activity Type</Text>
              {errors.activityType && (
                <Text style={styles.inlineError}>{errors.activityType}</Text>
              )}
            </View>
            <View style={styles.chipsGrid}>
              {ACTIVITY_TYPES.map((at) => {
                const active = activityType === at.value;
                return (
                  <TouchableOpacity
                    key={at.value}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => {
                      setActivityType(at.value);
                      setExpenseSubType('');
                      setIncomeAmount('');
                      setQuantityInput('');
                      setErrors(prev => ({ ...prev, activityType: undefined as any, incomeAmount: undefined as any }));
                    }}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.chipEmoji}>{at.emoji}</Text>
                    <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
                      {at.label}
                    </Text>
                    {active && <CheckCircle2 size={12} color="#FFF" style={styles.chipCheck} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ── Expense Category (2-column fixed grid) ── */}
          {activityType === 'Expense' && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionLabelRow}>
                <Tag size={16} color={COLORS.primary} />
                <Text style={styles.sectionLabel}>Expense Category</Text>
                {errors.expenseSubType && (
                  <Text style={styles.inlineError}>{errors.expenseSubType}</Text>
                )}
              </View>
              <View style={styles.subTypeGrid}>
                {EXPENSE_SUB_TYPES.map((st) => {
                  const active = expenseSubType === st.value;
                  return (
                    <TouchableOpacity
                      key={st.value}
                      style={[styles.subTypeChip, active && styles.subTypeChipActive]}
                      onPress={() => {
                        setExpenseSubType(st.value);
                        setErrors(prev => ({ ...prev, expenseSubType: undefined as any }));
                      }}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.subTypeEmoji}>{st.emoji}</Text>
                      <Text style={[styles.subTypeLabel, active && styles.subTypeLabelActive]}>
                        {st.label}
                      </Text>
                      {active && (
                        <CheckCircle2 size={14} color="#FFF" style={styles.subTypeCheck} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* ── Harvest / Income fields ── */}
          {showIncomeField && (
            <>
              <View style={styles.sectionCard}>
                <View style={styles.sectionLabelRow}>
                  <Text style={styles.rupeeIcon}>₹</Text>
                  <Text style={styles.sectionLabel}>Income Amount</Text>
                  {errors.incomeAmount && (
                    <Text style={styles.inlineError}>{errors.incomeAmount}</Text>
                  )}
                </View>
                <View style={[styles.amountRow, errors.incomeAmount ? styles.amountRowError : null]}>
                  <View style={styles.rupeeBadge}>
                    <Text style={styles.rupeeSymbol}>₹</Text>
                  </View>
                  <TextInput
                    style={styles.amountInput}
                    placeholder="Enter income received"
                    placeholderTextColor="#BDBDBD"
                    keyboardType="numeric"
                    value={incomeAmount}
                    onChangeText={(v) => {
                      setIncomeAmount(v);
                      setErrors(prev => ({ ...prev, incomeAmount: undefined as any }));
                    }}
                  />
                  {!!incomeAmount && !isNaN(Number(incomeAmount)) && Number(incomeAmount) > 0 && (
                    <Text style={styles.amountPreview}>
                      ₹{Number(incomeAmount).toLocaleString('en-IN')}
                    </Text>
                  )}
                </View>
              </View>

              <View style={styles.sectionCard}>
                <View style={styles.sectionLabelRow}>
                  <Tag size={16} color={COLORS.primary} />
                  <Text style={styles.sectionLabel}>
                    Quantity <Text style={styles.optionalTag}>(optional)</Text>
                  </Text>
                </View>
                <View style={styles.dateInputRow}>
                  <View style={styles.dateIconBox}>
                    <Tag size={20} color={COLORS.primary} />
                  </View>
                  <TextInput
                    style={styles.dateInput}
                    value={quantityInput}
                    onChangeText={setQuantityInput}
                    placeholder="e.g. 500 kg, 85 bunches, 3 tons…"
                    placeholderTextColor="#BDBDBD"
                  />
                </View>
              </View>
            </>
          )}

          {/* ── Cost Amount (shown for cost-bearing activities) ── */}
          {showCostField && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionLabelRow}>
                <Text style={styles.rupeeIcon}>₹</Text>
                <Text style={styles.sectionLabel}>
                  Cost Amount <Text style={styles.optionalTag}>(optional)</Text>
                </Text>
                {errors.amount && (
                  <Text style={styles.inlineError}>{errors.amount}</Text>
                )}
              </View>
              <View style={[styles.amountRow, errors.amount ? styles.amountRowError : null]}>
                <View style={styles.rupeeBadge}>
                  <Text style={styles.rupeeSymbol}>₹</Text>
                </View>
                <TextInput
                  style={styles.amountInput}
                  placeholder="Enter amount (optional)"
                  placeholderTextColor="#BDBDBD"
                  keyboardType="numeric"
                  value={amount}
                  onChangeText={(v) => {
                    setAmount(v);
                    setErrors(prev => ({ ...prev, amount: undefined as any }));
                  }}
                />
                {!!amount && !isNaN(Number(amount)) && Number(amount) > 0 && (
                  <Text style={styles.amountPreview}>
                    ₹{Number(amount).toLocaleString('en-IN')}
                  </Text>
                )}
              </View>
            </View>
          )}

          {/* ── Notes ── */}
          {!!activityType && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionLabelRow}>
                <FileText size={16} color={COLORS.primary} />
                <Text style={styles.sectionLabel}>
                  {selectedActivity?.notesLabel ?? 'Notes'}
                  {!notesRequired && <Text style={styles.optionalTag}> (optional)</Text>}
                </Text>
                {errors.notes && (
                  <Text style={styles.inlineError}>{errors.notes}</Text>
                )}
              </View>
              <TextInput
                style={[styles.notesInput, errors.notes ? styles.notesInputError : null]}
                placeholder={selectedActivity?.notesPlaceholder ?? 'Add notes…'}
                placeholderTextColor="#BDBDBD"
                multiline
                numberOfLines={4}
                value={notes}
                onChangeText={(v) => {
                  setNotes(v);
                  setErrors(prev => ({ ...prev, notes: undefined as any }));
                }}
                textAlignVertical="top"
              />
            </View>
          )}

          {/* ── Image ── */}
          {!!activityType && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionLabelRow}>
                <ImagePlus size={16} color={COLORS.primary} />
                <Text style={styles.sectionLabel}>Photo</Text>
                <Text style={styles.optionalTag}>(optional)</Text>
              </View>
              {image ? (
                <View style={styles.imagePreviewWrap}>
                  <TouchableOpacity onPress={openPickerSheet} activeOpacity={0.85}>
                    <Image source={{ uri: image.uri }} style={styles.imagePreview} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.removeImageBtn}
                    onPress={removeImage}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Trash2 size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.imageBox} onPress={openPickerSheet} activeOpacity={0.8}>
                  <View style={styles.imageEmptyContent}>
                    <View style={styles.cameraCircle}>
                      <Camera size={30} color={COLORS.textSecondary} />
                    </View>
                    <Text style={styles.imageEmptyLabel}>Tap to attach a photo</Text>
                    <Text style={styles.imageEmptyHint}>
                      Capture crop condition, damage, or activity
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ── No activity selected placeholder ── */}
          {!activityType && (
            <View style={styles.selectHint}>
              <Text style={styles.selectHintEmoji}>👆</Text>
              <Text style={styles.selectHintText}>Select an activity type above to continue</Text>
            </View>
          )}

          {/* ── Submit ── */}
          {!!activityType && (
            <TouchableOpacity
              style={[styles.submitBtn, saving && { opacity: 0.7 }]}
              onPress={handleSubmit}
              activeOpacity={0.85}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#FFF" /> : <Save size={20} color="#FFF" />}
              <Text style={styles.submitBtnText}>{saving ? 'Saving…' : 'Save Record'}</Text>
            </TouchableOpacity>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={pickerVisible} transparent animationType="slide" onRequestClose={closePickerSheet}>
        <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={closePickerSheet}>
          <View style={styles.sheetContainer}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Add Photo</Text>
            <TouchableOpacity style={styles.sheetOption} onPress={pickFromCamera} activeOpacity={0.7}>
              <Text style={styles.sheetOptionEmoji}>📷</Text>
              <Text style={styles.sheetOptionText}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetOption} onPress={pickFromGallery} activeOpacity={0.7}>
              <Text style={styles.sheetOptionEmoji}>🖼</Text>
              <Text style={styles.sheetOptionText}>Choose from Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetCancel} onPress={closePickerSheet} activeOpacity={0.7}>
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F0F4F8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E8EDF2',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerCenter: { flex: 1 },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
    letterSpacing: 0.2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  scroll: { flex: 1 },
  scrollContent: {
    padding: 16,
    paddingTop: 20,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 6,
    flexWrap: 'wrap',
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2C2C2C',
    flex: 1,
    marginLeft: 2,
  },
  inlineError: {
    fontSize: 11,
    color: COLORS.error,
    fontWeight: '500',
  },
  optionalTag: {
    fontSize: 11,
    color: '#AAAAAA',
    fontStyle: 'italic',
    fontWeight: '400',
  },
  rupeeIcon: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.primary,
  },
  // Date
  dateInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F9FC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E6EE',
    overflow: 'hidden',
  },
  dateIconBox: {
    width: 46,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#EBF5EB',
    borderRightWidth: 1,
    borderRightColor: '#DCE8DC',
  },
  dateInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  // Activity type chips (variable width — auto-sized to label)
  chipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F2F4F7',
    borderWidth: 1.5,
    borderColor: '#E2E6EA',
  },
  chipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipEmoji: { fontSize: 13, marginRight: 5 },
  chipLabel: { fontSize: 13, fontWeight: '500', color: '#555' },
  chipLabelActive: { color: '#FFFFFF', fontWeight: '700' },
  chipCheck: { marginLeft: 4 },
  // Expense category grid — 2 equal-width columns
  subTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  subTypeChip: {
    width: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#F2F4F7',
    borderWidth: 1.5,
    borderColor: '#E2E6EA',
    gap: 8,
  },
  subTypeChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
    elevation: 2,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  subTypeEmoji: { fontSize: 18 },
  subTypeLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#444',
  },
  subTypeLabelActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  subTypeCheck: { marginLeft: 'auto' as any },
  // Amount
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F9FC',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E0E6EE',
    overflow: 'hidden',
  },
  amountRowError: { borderColor: COLORS.error },
  rupeeBadge: {
    width: 46,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#EBF5EB',
    borderRightWidth: 1,
    borderRightColor: '#DCE8DC',
  },
  rupeeSymbol: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.primary,
  },
  amountInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  amountPreview: {
    fontSize: 12,
    color: COLORS.textSecondary,
    paddingRight: 14,
    fontWeight: '500',
  },
  // Notes
  notesInput: {
    backgroundColor: '#F7F9FC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E6EE',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#333',
    minHeight: 110,
    lineHeight: 22,
  },
  notesInputError: { borderColor: COLORS.error },
  // Image
  imageBox: {
    minHeight: 130,
    backgroundColor: '#F7F9FC',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#D0D9E4',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  imageEmptyContent: { alignItems: 'center' },
  cameraCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#EAEDF1',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  imageEmptyLabel: { fontSize: 14, fontWeight: '600', color: '#555', marginBottom: 4 },
  imageEmptyHint: { fontSize: 12, color: '#999', textAlign: 'center' },
  // Real image preview + remove button
  imagePreviewWrap: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'visible',
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: '#EAEDF1',
  },
  removeImageBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#D32F2F',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  // Photo bottom sheet
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DDD',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 16,
    textAlign: 'center',
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    gap: 14,
  },
  sheetOptionEmoji: { fontSize: 22 },
  sheetOptionText: { fontSize: 16, fontWeight: '600', color: '#2C2C2C' },
  sheetCancel: {
    marginTop: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#F2F4F7',
    borderRadius: 12,
  },
  sheetCancelText: { fontSize: 15, fontWeight: '700', color: '#555' },
  // Hint
  selectHint: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#FFF',
    borderRadius: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#EEE',
    borderStyle: 'dashed',
  },
  selectHintEmoji: { fontSize: 28, marginBottom: 8 },
  selectHintText: { fontSize: 14, color: '#AAA', textAlign: 'center' },
  // Submit
  submitBtn: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    elevation: 4,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    gap: 10,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
