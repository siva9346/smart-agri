import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ScrollView, ActivityIndicator,
} from 'react-native';
import * as Location from 'expo-location';
import { MapPin, CheckCircle } from 'lucide-react-native';
import { useSelector } from 'react-redux';
import { COLORS, SPACING, BORDER_RADIUS } from '../../theme';
import { api } from '../../services/api';
import { RootState } from '../../store';

export const AddLandScreen = ({ navigation }: any) => {
  const user = useSelector((state: RootState) => state.auth.user);
  const [name,     setName]     = useState('');
  const [area,     setArea]     = useState('');
  const [village,  setVillage]  = useState('');
  const [soilType, setSoilType] = useState('');
  const [gpsCoords, setGpsCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [loading,  setLoading]  = useState(false);

  const handleGetLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location access required to capture land location.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setGpsCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
    } catch {
      Alert.alert('Error', 'Failed to get location. Please try again.');
    } finally {
      setLocating(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !area.trim() || !village.trim()) {
      Alert.alert('Error', 'Land name, area, and location are required');
      return;
    }
    setLoading(true);
    try {
      await api.post('/lands', {
        farmerId: user?.userId,
        name:     name.trim(),
        area:     area.trim(),
        areaUnit: 'acres',
        village:  village.trim(),
        soilType: soilType.trim(),
        ...(gpsCoords ?? {}),
      });
      Alert.alert('Success', 'Land added successfully');
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to save land');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.field}>
        <Text style={styles.label}>Land Name *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. North Field, Home Land"
          placeholderTextColor="#9E9E9E"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Area (acres) *</Text>
        <TextInput
          style={styles.input}
          value={area}
          onChangeText={setArea}
          placeholder="e.g. 2.5"
          placeholderTextColor="#9E9E9E"
          keyboardType="decimal-pad"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Village / Location *</Text>
        <TextInput
          style={styles.input}
          value={village}
          onChangeText={setVillage}
          placeholder="e.g. Avadi, Madurai"
          placeholderTextColor="#9E9E9E"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Soil Type</Text>
        <TextInput
          style={styles.input}
          value={soilType}
          onChangeText={setSoilType}
          placeholder="e.g. Black soil, Red soil"
          placeholderTextColor="#9E9E9E"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>GPS Location (Optional)</Text>
        <TouchableOpacity
          style={[styles.gpsBtn, locating && styles.gpsBtnDisabled]}
          onPress={handleGetLocation}
          disabled={locating}
        >
          {locating
            ? <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
            : <MapPin size={18} color="#fff" style={{ marginRight: 8 }} />
          }
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
          <Text style={styles.gpsHint}>Optional — tap to pin exact farm coordinates</Text>
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
  container:      { flex: 1, padding: SPACING.lg, backgroundColor: COLORS.background },
  field:          { marginBottom: SPACING.lg },
  label:          { fontSize: 14, color: COLORS.text, marginBottom: SPACING.xs, fontWeight: '600' },
  input:          { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, fontSize: 16, color: COLORS.text },
  gpsBtn:         { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, paddingVertical: 12, paddingHorizontal: SPACING.md, borderRadius: BORDER_RADIUS.md, alignSelf: 'flex-start' },
  gpsBtnDisabled: { opacity: 0.7 },
  gpsBtnText:     { color: '#fff', fontSize: 14, fontWeight: '600' },
  coordsRow:      { flexDirection: 'row', alignItems: 'center', marginTop: 10, backgroundColor: '#E8F5E9', padding: 10, borderRadius: BORDER_RADIUS.sm, borderLeftWidth: 3, borderLeftColor: COLORS.success },
  coordsText:     { marginLeft: 6, fontSize: 13, color: '#2E7D32', fontWeight: '500' },
  gpsHint:        { marginTop: 8, fontSize: 12, color: COLORS.textSecondary, fontStyle: 'italic' },
  button:         { backgroundColor: COLORS.primary, padding: SPACING.md, borderRadius: BORDER_RADIUS.md, alignItems: 'center', marginTop: SPACING.md, marginBottom: SPACING.xl },
  buttonDisabled: { opacity: 0.7 },
  buttonText:     { color: 'white', fontSize: 16, fontWeight: 'bold' },
});
