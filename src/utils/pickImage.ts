import * as ImagePicker from 'expo-image-picker';
import { toast } from '../ui';

export interface PickedImage { uri: string; base64: string; mimeType: string }

const ALLOWED = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const MAX_BYTES = 5 * 1024 * 1024;

/** Camera or gallery image as base64, validated for type and size (same limits as the backend). */
export async function pickImage(source: 'camera' | 'library'): Promise<PickedImage | null> {
  const perm = source === 'camera'
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (perm.status !== 'granted') {
    toast(`Allow ${source === 'camera' ? 'camera' : 'photo library'} access in Settings to add photos.`, 'error');
    return null;
  }
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.5, base64: true };
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  const asset = !result.canceled ? result.assets?.[0] : null;
  if (!asset?.base64) return null;
  const mimeType = (asset.mimeType || 'image/jpeg').toLowerCase().replace('image/jpg', 'image/jpeg');
  if (!ALLOWED.has(mimeType)) {
    toast('Please choose a JPG, PNG or WEBP image.', 'error');
    return null;
  }
  if (Math.ceil((asset.base64.length * 3) / 4) > MAX_BYTES) {
    toast('Please choose an image smaller than 5MB.', 'error');
    return null;
  }
  return { uri: asset.uri, base64: asset.base64, mimeType };
}
