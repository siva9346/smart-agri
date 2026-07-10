import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, SafeAreaView, Alert } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS } from '../../../theme';
import { api } from '../../../services/api';

export const EditStockScreen = ({ route, navigation }: any) => {
  const { product } = route.params;
  const [name,        setName]        = useState(product.name ?? '');
  const [price,       setPrice]       = useState(String(product.price ?? ''));
  const [stock,       setStock]       = useState(String(product.stock ?? ''));
  const [unit,        setUnit]        = useState(product.unit ?? 'kg');
  const [description, setDescription] = useState(product.description ?? '');
  const [loading,     setLoading]     = useState(false);

  const handleSave = async () => {
    if (!price || !stock) {
      Alert.alert('Error', 'Price and stock are required');
      return;
    }
    setLoading(true);
    try {
      await api.put(`/products/${product.productId}`, {
        name:        name.trim(),
        price:       Number(price),
        stock:       Number(stock),
        unit:        unit.trim(),
        description: description.trim(),
      });
      Alert.alert('Success', 'Product updated successfully');
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to update product');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.field}>
          <Text style={styles.label}>Product Name</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} />
        </View>
        <View style={styles.row}>
          <View style={[styles.field, { flex: 1, marginRight: 8 }]}>
            <Text style={styles.label}>Price (₹)</Text>
            <TextInput style={styles.input} value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
          </View>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Unit</Text>
            <TextInput style={styles.input} value={unit} onChangeText={setUnit} />
          </View>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Stock Quantity</Text>
          <TextInput style={styles.input} value={stock} onChangeText={setStock} keyboardType="number-pad" />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Description</Text>
          <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription} multiline numberOfLines={3} textAlignVertical="top" />
        </View>
        <TouchableOpacity style={[styles.button, loading && { opacity: 0.7 }]} onPress={handleSave} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Saving...' : 'Save Changes'}</Text>
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
