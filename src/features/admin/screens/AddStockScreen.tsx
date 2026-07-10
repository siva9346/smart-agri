import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, SafeAreaView, Alert } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS } from '../../../theme';
import { api } from '../../../services/api';

export const AddStockScreen = ({ navigation }: any) => {
  const [name,        setName]        = useState('');
  const [category,    setCategory]    = useState('Fertilizers');
  const [price,       setPrice]       = useState('');
  const [unit,        setUnit]        = useState('kg');
  const [stock,       setStock]       = useState('');
  const [description, setDescription] = useState('');
  const [loading,     setLoading]     = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !price || !stock) {
      Alert.alert('Error', 'Name, price, and stock quantity are required');
      return;
    }
    setLoading(true);
    try {
      await api.post('/products', {
        name:        name.trim(),
        category:    category.trim(),
        price:       Number(price),
        unit:        unit.trim() || 'kg',
        stock:       Number(stock),
        description: description.trim(),
        isActive:    true,
      });
      Alert.alert('Success', 'Product added to inventory');
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to add product');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.field}>
          <Text style={styles.label}>Product Name *</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Urea Fertilizer" />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Category</Text>
          <TextInput style={styles.input} value={category} onChangeText={setCategory} placeholder="e.g. Fertilizers, Pesticides" />
        </View>
        <View style={styles.row}>
          <View style={[styles.field, { flex: 1, marginRight: 8 }]}>
            <Text style={styles.label}>Price (₹) *</Text>
            <TextInput style={styles.input} value={price} onChangeText={setPrice} placeholder="0.00" keyboardType="decimal-pad" />
          </View>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Unit</Text>
            <TextInput style={styles.input} value={unit} onChangeText={setUnit} placeholder="kg / litre / bag" />
          </View>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Stock Quantity *</Text>
          <TextInput style={styles.input} value={stock} onChangeText={setStock} placeholder="Available quantity" keyboardType="number-pad" />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Description</Text>
          <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription} placeholder="Product details..." multiline numberOfLines={3} textAlignVertical="top" />
        </View>
        <TouchableOpacity style={[styles.button, loading && { opacity: 0.7 }]} onPress={handleSave} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Adding...' : 'Add to Inventory'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: COLORS.background },
  container:  { padding: SPACING.lg },
  field:      { marginBottom: SPACING.lg },
  row:        { flexDirection: 'row' },
  label:      { fontSize: 14, color: COLORS.text, marginBottom: SPACING.xs, fontWeight: '600' },
  input:      { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, fontSize: 16, color: COLORS.text },
  textArea:   { height: 80 },
  button:     { backgroundColor: COLORS.primary, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, alignItems: 'center', marginTop: SPACING.md },
  buttonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
});
