import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { productService } from '../services/productService';

export const AddProductScreen = ({ navigation }: any) => {
  const [formData, setFormData] = useState({
    name: '',
    category: 'Fertilizers',
    price: '',
    stock: '',
    description: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const { name, category, price, stock, description } = formData;

    if (!name || !price || !stock || !description) {
      Alert.alert('Validation Error', 'Please fill in all fields');
      return;
    }

    setSubmitting(true);
    try {
      await productService.addProduct({
        name,
        category,
        price: parseFloat(price),
        stock: parseInt(stock, 10),
        description,
      });
      Alert.alert('Success', 'Product added successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to add product');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.form}>
        <Text style={styles.title}>Add New Product</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Product Name</Text>
          <TextInput
            style={styles.input}
            value={formData.name}
            onChangeText={(txt) => setFormData(p => ({ ...p, name: txt }))}
            placeholder="e.g. Bio-Growth Fertilizer"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Category</Text>
          <TextInput
            style={styles.input}
            value={formData.category}
            onChangeText={(txt) => setFormData(p => ({ ...p, category: txt }))}
            placeholder="e.g. Fertilizers"
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
            <Text style={styles.label}>Price (₹)</Text>
            <TextInput
              style={styles.input}
              value={formData.price}
              onChangeText={(txt) => setFormData(p => ({ ...p, price: txt }))}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />
          </View>

          <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
            <Text style={styles.label}>Initial Stock</Text>
            <TextInput
              style={styles.input}
              value={formData.stock}
              onChangeText={(txt) => setFormData(p => ({ ...p, stock: txt }))}
              placeholder="100"
              keyboardType="number-pad"
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.description}
            onChangeText={(txt) => setFormData(p => ({ ...p, description: txt }))}
            placeholder="Describe the product benefits..."
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity 
          style={[styles.submitBtn, submitting && styles.disabledBtn]} 
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Add Product</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  form: {
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#f9f9f9',
  },
  textArea: {
    height: 120,
  },
  submitBtn: {
    backgroundColor: '#2e7d32',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  disabledBtn: {
    backgroundColor: '#9ccc9c',
  }
});
