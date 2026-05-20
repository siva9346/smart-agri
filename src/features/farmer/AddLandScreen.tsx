import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import * as Location from 'expo-location';
import { MapPin, CheckCircle } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS } from '../../theme';
import { mockRepository } from '../../repositories/MockRepository';

export const AddLandScreen = ({ navigation }: any) => {
  const [form, setForm] = useState({ area: '', cropType: '', location: '' });
  const [gpsCoords, setGpsCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleGetLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location access required to capture land location.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setGpsCoords({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
    } catch {
      Alert.alert('Error', 'Failed to get location. Please try again.');
    } finally {
      setLocating(false);
    }
  };

  const handleSave = async () => {
    if (!form.area || !form.cropType || !form.location) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }

    setLoading(true);
    try {
      const res = await mockRepository.addLand({
        ...form,
        farmerId: '1',
        ...(gpsCoords ?? {}),
      });
      if (res.success) {
        Alert.alert('Success', 'Land added successfully');
        navigation.goBack();
      }
    } catch {
      Alert.alert('Error', 'Failed to save land');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.field}>
        <Text style={styles.label}>Land Area (e.g. 2 Acres)</Text>
        <TextInput
          style={styles.input}
          value={form.area}
          onChangeText={(val) => setForm({ ...form, area: val })}
          placeholder="Enter area"
          placeholderTextColor="#9E9E9E"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Crop Type</Text>
        <TextInput
          style={styles.input}
          value={form.cropType}
          onChangeText={(val) => setForm({ ...form, cropType: val })}
          placeholder="e.g. Rice, Wheat"
          placeholderTextColor="#9E9E9E"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Location Name</Text>
        <TextInput
          style={styles.input}
          value={form.location}
          onChangeText={(val) => setForm({ ...form, location: val })}
          placeholder="Enter field location / village"
          placeholderTextColor="#9E9E9E"
        />
      </View>

      {/* GPS Section */}
      <View style={styles.field}>
        <Text style={styles.label}>Land GPS Location</Text>

        <TouchableOpacity
          style={[styles.gpsBtn, locating && styles.gpsBtnDisabled]}
          onPress={handleGetLocation}
          disabled={locating}
        >
          {locating ? (
            <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
          ) : (
            <MapPin size={18} color="#fff" style={{ marginRight: 8 }} />
          )}
          <Text style={styles.gpsBtnText}>
            {locating ? 'Getting Location...' : '📍 Use Current Location'}
          </Text>
        </TouchableOpacity>

        {gpsCoords ? (
          <View style={styles.coordsRow}>
            <CheckCircle size={16} color={COLORS.success} />
            <Text style={styles.coordsText}>
              Location captured ✅{'  '}
              {gpsCoords.latitude.toFixed(5)}, {gpsCoords.longitude.toFixed(5)}
            </Text>
          </View>
        ) : (
          <Text style={styles.gpsHint}>
            Optional — tap to pin exact farm coordinates
          </Text>
        )}
      </View>

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleSave}
        disabled={loading}
      >
        <Text style={styles.buttonText}>{loading ? 'Saving...' : 'Save Land'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: SPACING.lg,
    backgroundColor: COLORS.background,
  },
  field: {
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
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: 16,
    color: COLORS.text,
  },
  gpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignSelf: 'flex-start',
  },
  gpsBtnDisabled: {
    opacity: 0.7,
  },
  gpsBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  coordsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    backgroundColor: '#E8F5E9',
    padding: 10,
    borderRadius: BORDER_RADIUS.sm,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.success,
  },
  coordsText: {
    marginLeft: 6,
    fontSize: 13,
    color: '#2E7D32',
    fontWeight: '500',
  },
  gpsHint: {
    marginTop: 8,
    fontSize: 12,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  button: {
    backgroundColor: COLORS.primary,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    marginTop: SPACING.md,
    marginBottom: SPACING.xl,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
