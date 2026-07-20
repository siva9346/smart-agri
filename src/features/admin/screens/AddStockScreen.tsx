import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, BORDER_RADIUS } from '../../../theme';
import { api } from '../../../services/api';
import { ProductImagePicker, PickedImage } from '../components/ProductImagePicker';

export const AddStockScreen = ({ navigation }: any) => {
  const [name,        setName]        = useState('');
  const [category,    setCategory]    = useState('Fertilizers');
  const [price,       setPrice]       = useState('');
  const [unit,        setUnit]        = useState('kg');
  const [stock,       setStock]       = useState('');
  const [description, setDescription] = useState('');
  const [image,        setImage]        = useState<PickedImage | null>(null);
  const [imageError,   setImageError]   = useState<string | undefined>();
  const [uploadingImg, setUploadingImg] = useState(false);
  const [loading,     setLoading]     = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !price || !stock) {
      Alert.alert('Error', 'Name, price, and stock quantity are required');
      return;
    }
    if (!image) {
      setImageError('Product image is required');
      return;
    }
    setImageError(undefined);
    setLoading(true);
    try {
      let imageUrl = '';
      setUploadingImg(true);
      try {
        const uploadRes = await api.post<{ url: string }>('/products/upload-photo', {
          image: image.base64,
          contentType: image.mimeType,
        });
        imageUrl = uploadRes.url;
      } catch (err: any) {
        Alert.alert('Photo Upload Failed', err?.message ?? 'Could not upload the image. Please try again.');
        return;
      } finally {
        setUploadingImg(false);
      }

      await api.post('/products', {
        name:        name.trim(),
        category:    category.trim(),
        price:       Number(price),
        unit:        unit.trim() || 'kg',
        stock:       Number(stock),
        description: description.trim(),
        imageUrl,
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
        <ProductImagePicker
          imageUri={image?.uri}
          uploading={uploadingImg}
          error={imageError}
          onPick={(img) => { setImage(img); setImageError(undefined); }}
          onRemove={() => setImage(null)}
        />
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
