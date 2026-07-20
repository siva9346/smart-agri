import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Modal, Alert, Linking, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Trash2, ImagePlus } from 'lucide-react-native';
import { COLORS, SPACING, BORDER_RADIUS } from '../../../theme';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

export interface PickedImage {
  uri: string;
  base64: string;
  mimeType: string;
}

interface ProductImagePickerProps {
  imageUri?: string;          // freshly-picked local image (preview)
  existingImageUrl?: string;  // already-uploaded image (edit mode)
  uploading?: boolean;
  error?: string;
  onPick: (img: PickedImage) => void;
  onRemove: () => void;
}

export const ProductImagePicker: React.FC<ProductImagePickerProps> = ({
  imageUri, existingImageUrl, uploading, error, onPick, onRemove,
}) => {
  const [sheetVisible, setSheetVisible] = useState(false);

  const openSheet = () => setSheetVisible(true);
  const closeSheet = () => setSheetVisible(false);

  const showPermissionDeniedAlert = (source: 'camera' | 'photo library') => {
    Alert.alert(
      'Permission Needed',
      `Please allow ${source} access in Settings to upload a product image.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]
    );
  };

  const validateAndEmit = (asset: ImagePicker.ImagePickerAsset) => {
    if (!asset.base64) return;
    const mimeType = (asset.mimeType || 'image/jpeg').toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      Alert.alert('Unsupported Format', 'Please choose a JPG, JPEG, PNG, or WEBP image.');
      return;
    }
    const approxBytes = Math.ceil((asset.base64.length * 3) / 4);
    if (approxBytes > MAX_BYTES) {
      Alert.alert('Image Too Large', 'Please choose an image smaller than 5MB.');
      return;
    }
    onPick({ uri: asset.uri, base64: asset.base64, mimeType });
  };

  const pickFromCamera = async () => {
    closeSheet();
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      showPermissionDeniedAlert('camera');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.5, base64: true });
    if (!result.canceled && result.assets?.[0]) validateAndEmit(result.assets[0]);
  };

  const pickFromGallery = async () => {
    closeSheet();
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showPermissionDeniedAlert('photo library');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.5, base64: true });
    if (!result.canceled && result.assets?.[0]) validateAndEmit(result.assets[0]);
  };

  const previewUri = imageUri || existingImageUrl;

  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>Product Image *</Text>
        {error ? <Text style={styles.inlineError}>{error}</Text> : null}
      </View>

      {previewUri ? (
        <View>
          <View style={styles.previewWrap}>
            <Image source={{ uri: previewUri }} style={styles.previewImage} />
            {uploading && (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator color="#FFF" />
              </View>
            )}
          </View>
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionBtn} onPress={openSheet} disabled={uploading}>
              <ImagePlus size={15} color={COLORS.primary} />
              <Text style={styles.actionBtnText}>Change Image</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.removeBtn]} onPress={onRemove} disabled={uploading}>
              <Trash2 size={15} color={COLORS.error} />
              <Text style={[styles.actionBtnText, styles.removeBtnText]}>Remove Image</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={styles.uploadBox} onPress={openSheet} activeOpacity={0.8}>
          <View style={styles.cameraCircle}>
            <Camera size={28} color={COLORS.textSecondary} />
          </View>
          <Text style={styles.uploadLabel}>📷 Upload / Take Photo</Text>
          <Text style={styles.uploadHint}>JPG, PNG, or WEBP · up to 5MB</Text>
        </TouchableOpacity>
      )}

      <Modal visible={sheetVisible} transparent animationType="slide" onRequestClose={closeSheet}>
        <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={closeSheet}>
          <View style={styles.sheetContainer}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Product Image</Text>
            <TouchableOpacity style={styles.sheetOption} onPress={pickFromCamera} activeOpacity={0.7}>
              <Text style={styles.sheetOptionEmoji}>📷</Text>
              <Text style={styles.sheetOptionText}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetOption} onPress={pickFromGallery} activeOpacity={0.7}>
              <Text style={styles.sheetOptionEmoji}>🖼</Text>
              <Text style={styles.sheetOptionText}>Choose from Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetCancel} onPress={closeSheet} activeOpacity={0.7}>
              <Text style={styles.sheetCancelText}>❌ Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  field:      { marginBottom: SPACING.lg },
  labelRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.xs, gap: 8 },
  label:      { fontSize: 14, color: COLORS.text, fontWeight: '600' },
  inlineError:{ fontSize: 12, color: COLORS.error, flex: 1 },
  uploadBox: {
    height: 160,
    backgroundColor: '#F7F9FC',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1.5,
    borderColor: '#D0D9E4',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  cameraCircle: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#EAEDF1',
    justifyContent: 'center', alignItems: 'center', marginBottom: 10,
  },
  uploadLabel: { fontSize: 14, fontWeight: '700', color: '#555', marginBottom: 4 },
  uploadHint:  { fontSize: 12, color: '#999', textAlign: 'center' },
  previewWrap: { borderRadius: BORDER_RADIUS.lg, overflow: 'hidden' },
  previewImage: { width: '100%', height: 180, borderRadius: BORDER_RADIUS.lg, backgroundColor: '#EAEDF1' },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center',
  },
  actionRow:  { flexDirection: 'row', gap: 10, marginTop: 10 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, borderRadius: BORDER_RADIUS.md, gap: 6,
    borderWidth: 1, borderColor: COLORS.primary,
  },
  actionBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  removeBtn:     { borderColor: COLORS.error },
  removeBtnText: { color: COLORS.error },
  // Bottom sheet
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheetContainer: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#DDD', alignSelf: 'center', marginBottom: 16 },
  sheetTitle:  { fontSize: 16, fontWeight: '700', color: '#1A1A1A', marginBottom: 16, textAlign: 'center' },
  sheetOption: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 8,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0', gap: 14,
  },
  sheetOptionEmoji: { fontSize: 22 },
  sheetOptionText:  { fontSize: 16, fontWeight: '600', color: '#2C2C2C' },
  sheetCancel: { marginTop: 12, paddingVertical: 14, alignItems: 'center', backgroundColor: '#F2F4F7', borderRadius: 12 },
  sheetCancelText: { fontSize: 15, fontWeight: '700', color: '#555' },
});
