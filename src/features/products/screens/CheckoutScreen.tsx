import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, ScrollView, TextInput,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../../../store';
import { clearCart } from '../../../store/cartSlice';
import { productService } from '../services/productService';

export const CheckoutScreen = ({ route, navigation }: any) => {
  const { total } = route.params;
  const dispatch   = useDispatch<AppDispatch>();
  const cartItems  = useSelector((state: RootState) => state.cart.items);
  const [processing, setProcessing] = useState(false);
  const [address,    setAddress]    = useState('');

  const handlePurchase = async () => {
    if (!address.trim()) {
      Alert.alert('Validation Error', 'Please enter your delivery address');
      return;
    }
    setProcessing(true);
    try {
      const order = await productService.createOrder(address.trim(), cartItems);
      dispatch(clearCart());
      Alert.alert(
        'Order Placed!',
        `Order ${order.orderId} placed successfully.\nTotal: ₹${Number(order.totalAmount).toFixed(2)}`,
        [{ text: 'OK', onPress: () => navigation.reset({ index: 0, routes: [{ name: 'FertilizerList' }] }) }]
      );
    } catch (error: any) {
      Alert.alert('Error', error?.message ?? 'Failed to place order. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Order Summary</Text>

        {cartItems.map((item) => (
          <View key={item.productId} style={styles.row}>
            <Text style={styles.itemText}>{item.quantity} × {item.name}</Text>
            <Text style={styles.priceText}>₹{(item.price * item.quantity).toFixed(2)}</Text>
          </View>
        ))}

        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.totalLabel}>Total Amount</Text>
          <Text style={styles.totalValue}>₹{total.toFixed(2)}</Text>
        </View>

        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Delivery Address *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Enter your full delivery address"
            value={address}
            onChangeText={setAddress}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Payment Method</Text>
          <Text style={styles.infoText}>Cash on Delivery</Text>
        </View>

        <TouchableOpacity
          style={[styles.confirmBtn, processing && styles.disabledBtn]}
          onPress={handlePurchase}
          disabled={processing}
        >
          {processing
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.confirmBtnText}>Confirm Order</Text>
          }
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#f5f5f5', padding: 16 },
  card:         { backgroundColor: '#fff', borderRadius: 16, padding: 20, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, marginBottom: 40 },
  title:        { fontSize: 22, fontWeight: 'bold', marginBottom: 20, color: '#333' },
  row:          { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  itemText:     { fontSize: 16, color: '#555', flex: 1 },
  priceText:    { fontSize: 16, fontWeight: '600', color: '#333' },
  divider:      { height: 1, backgroundColor: '#eee', marginVertical: 16 },
  totalLabel:   { fontSize: 18, fontWeight: '600', color: '#333' },
  totalValue:   { fontSize: 24, fontWeight: 'bold', color: '#2e7d32' },
  inputSection: { marginTop: 24 },
  inputLabel:   { fontSize: 14, fontWeight: 'bold', color: '#666', marginBottom: 8 },
  input:        { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16, color: '#333', marginBottom: 16, backgroundColor: '#f9f9f9' },
  textArea:     { height: 80 },
  infoBox:      { backgroundColor: '#e8f5e9', padding: 16, borderRadius: 8, marginBottom: 24 },
  infoTitle:    { fontSize: 12, fontWeight: 'bold', color: '#2e7d32', textTransform: 'uppercase', marginBottom: 4 },
  infoText:     { fontSize: 15, color: '#333', fontWeight: '500' },
  confirmBtn:   { backgroundColor: '#2e7d32', paddingVertical: 18, borderRadius: 12, alignItems: 'center' },
  confirmBtnText:{ color: '#fff', fontSize: 18, fontWeight: 'bold' },
  disabledBtn:  { backgroundColor: '#9ccc9c' },
});
