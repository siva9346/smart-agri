import React from 'react';
import { StyleSheet, ViewStyle, TouchableOpacity, StyleProp, View } from 'react-native';
import { BORDER_RADIUS, COLORS } from '../theme';

interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}

// Flat card: solid white surface with a real shadow for visible lift off the
// page — no blur/translucency, just a clean material-style elevation.
export const GlassCard = ({ children, style, onPress }: GlassCardProps) => {
  const content = (
    <View style={styles.shadowWrap}>
      <View style={[styles.card, style]}>
        {children}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
        {content}
      </TouchableOpacity>
    );
  }
  return content;
};

const styles = StyleSheet.create({
  shadowWrap: {
    borderRadius: BORDER_RADIUS.lg,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.09, shadowRadius: 10, elevation: 4,
  },
  card: {
    backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.primary + '20',
  },
});
