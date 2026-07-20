import React from 'react';
import { Image, View, StyleSheet, DimensionValue } from 'react-native';
import { ImageIcon } from 'lucide-react-native';
import { COLORS, BORDER_RADIUS } from '../theme';

interface ProductImageProps {
  uri?: string;
  size?: number;
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  iconSize?: number;
}

export const ProductImage: React.FC<ProductImageProps> = ({
  uri, size = 60, width, height, borderRadius = BORDER_RADIUS.md, iconSize,
}) => {
  const boxStyle = { width: width ?? size, height: height ?? size, borderRadius };

  if (uri) {
    return <Image source={{ uri }} style={[styles.image, boxStyle]} resizeMode="cover" />;
  }

  return (
    <View style={[styles.placeholder, boxStyle]}>
      <ImageIcon size={iconSize ?? Math.round((height ?? size) * 0.4)} color="#BBB" />
    </View>
  );
};

const styles = StyleSheet.create({
  image: {
    backgroundColor: '#EAEDF1',
  },
  placeholder: {
    backgroundColor: '#F0F2F5',
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
