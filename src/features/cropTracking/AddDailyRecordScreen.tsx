import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS } from '../../theme';
import { Camera, Save, ArrowLeft } from 'lucide-react-native';
import { useDispatch } from 'react-redux';
import { addRecord } from '../../store/cropSlice';
import { Stage, CostType } from './types';

const STAGES: Stage[] = ['cleaning', 'planting', 'fertilizer', 'harvesting'];
const COST_TYPES: CostType[] = [
  'Ploughing', 'Seed', 'Labour', 'Weeding', 'Fertilizer', 
  'Pesticide', 'Irrigation', 'Transport', 'Harvesting', 'Others'
];

export const AddDailyRecordScreen = ({ route, navigation }: any) => {
  const dispatch = useDispatch();
  const { cropCycleId, date } = route.params;
  
  const [stage, setStage] = useState<Stage>('fertilizer');
  const [costType, setCostType] = useState<CostType>('Fertilizer');
  const [expense, setExpense] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = () => {
    if (!expense || isNaN(Number(expense))) {
      Alert.alert('Error', 'Please enter a valid expense amount');
      return;
    }

    const newRecord = {
      id: Math.random().toString(36).substr(2, 9),
      cropCycleId,
      date,
      stage,
      costType,
      expense: Number(expense),
      notes,
    };

    dispatch(addRecord(newRecord));
    Alert.alert('Success', 'Record added successfully', [
      { text: 'OK', onPress: () => navigation.goBack() }
    ]);
  };

  return (
    <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container}>
        <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
                <ArrowLeft size={22} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Add Daily Record</Text>
        </View>

        <View style={styles.formContainer}>
            <Text style={styles.dateLabel}>Date: {date}</Text>

            <View style={styles.fieldGroup}>
                <Text style={styles.label}>Stage</Text>
                <View style={styles.pickerContainer}>
                    {STAGES.map(s => (
                        <TouchableOpacity 
                            key={s} 
                            style={[styles.chip, stage === s && styles.activeChip]}
                            onPress={() => setStage(s)}
                        >
                            <Text style={[styles.chipText, stage === s && styles.activeChipText]}>
                                {s.charAt(0).toUpperCase() + s.slice(1)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <View style={styles.fieldGroup}>
                <Text style={styles.label}>Cost Type</Text>
                <View style={styles.gridContainer}>
                    {COST_TYPES.map(ct => (
                        <TouchableOpacity 
                            key={ct} 
                            style={[styles.smallChip, costType === ct && styles.activeChip]}
                            onPress={() => setCostType(ct)}
                        >
                            <Text style={[styles.smallChipText, costType === ct && styles.activeChipText]}>
                                {ct}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <View style={styles.fieldGroup}>
                <Text style={styles.label}>Expense Amount (₹)</Text>
                <TextInput
                    style={styles.input}
                    placeholder="e.g. 2500"
                    keyboardType="numeric"
                    value={expense}
                    onChangeText={setExpense}
                />
            </View>

            <View style={styles.fieldGroup}>
                <Text style={styles.label}>Notes</Text>
                <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Enter details about the activity..."
                    multiline
                    numberOfLines={4}
                    value={notes}
                    onChangeText={setNotes}
                    textAlignVertical="top"
                />
            </View>

            <View style={styles.fieldGroup}>
                <Text style={styles.label}>Attached Image</Text>
                <TouchableOpacity style={styles.imagePlaceholder}>
                    <Camera size={40} color={COLORS.textSecondary} />
                    <Text style={styles.placeholderLabel}>Tap to upload photo (Placeholder)</Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
                <Save size={20} color={COLORS.surface} />
                <Text style={styles.submitBtnText}>Save Record</Text>
            </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: '#E8EDF2',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
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
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
    letterSpacing: 0.2,
  },
  formContainer: {
    padding: SPACING.md,
  },
  dateLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: SPACING.lg,
  },
  fieldGroup: {
    marginBottom: SPACING.xl,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  input: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    fontSize: 16,
  },
  textArea: {
      height: 100,
  },
  pickerContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
  },
  chip: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: BORDER_RADIUS.xl,
      backgroundColor: '#F0F0F0',
      marginRight: 8,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: '#DDD',
  },
  activeChip: {
      backgroundColor: COLORS.primary,
      borderColor: COLORS.primary,
  },
  chipText: {
      fontSize: 14,
      color: COLORS.textSecondary,
  },
  activeChipText: {
      color: COLORS.surface,
      fontWeight: 'bold',
  },
  gridContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
  },
  smallChip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: BORDER_RADIUS.md,
      backgroundColor: '#F5F5F5',
      marginRight: 6,
      marginBottom: 6,
      borderWidth: 1,
      borderColor: '#EEE',
  },
  smallChipText: {
      fontSize: 12,
      color: COLORS.textSecondary,
  },
  imagePlaceholder: {
      height: 150,
      backgroundColor: COLORS.surface,
      borderRadius: BORDER_RADIUS.md,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderStyle: 'dashed',
      justifyContent: 'center',
      alignItems: 'center',
  },
  placeholderLabel: {
      fontSize: 14,
      color: COLORS.textSecondary,
      marginTop: 8,
  },
  submitBtn: {
      flexDirection: 'row',
      backgroundColor: COLORS.primary,
      padding: 16,
      borderRadius: BORDER_RADIUS.md,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: SPACING.lg,
      marginBottom: 40,
  },
  submitBtnText: {
      color: COLORS.surface,
      fontSize: 18,
      fontWeight: 'bold',
      marginLeft: 8,
  }
});
