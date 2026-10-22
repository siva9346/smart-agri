import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Menu } from 'lucide-react-native';
import { useDrawer } from '../navigation/CustomDrawer';
import { COLORS } from '../theme';

interface GradientHeroProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  /** Gradient stops, darkest to lightest. Defaults to the brand green. */
  colors?: [string, string, ...string[]];
  compact?: boolean;
  showMenu?: boolean;
  /** False when this header sits below an existing native header, which already
   * reserves the safe-area inset — avoids double top padding. Default true. */
  bleedToTop?: boolean;
}

const DEFAULT_GREEN: [string, string, string] = ['#1B5E20', '#2E7D32', '#43A047'];

// Page header with a real (but restrained) gradient fill and a soft shadow for
// lift — no decorative orbs, no blur. `compact` trims vertical padding for
// sub-screens that don't need as much breathing room as the home dashboard.
// `showMenu` (default true) keeps the sidebar reachable from every screen —
// every instance renders inside CustomDrawer.
export const GradientHero = ({
  title, subtitle, onBack, right,
  colors = DEFAULT_GREEN,
  compact = false,
  showMenu = true,
  bleedToTop = true,
}: GradientHeroProps) => {
  const { openDrawer } = useDrawer();
  const insets = useSafeAreaInsets();
  const hasTopRow = !!onBack || !!right || showMenu;
  return (
    <View style={styles.shadowWrap}>
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: bleedToTop ? insets.top + 14 : 14 }, compact && styles.heroCompact]}
      >
        {hasTopRow && (
          <View style={styles.topRow}>
            {onBack ? (
              <TouchableOpacity onPress={onBack} style={styles.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <ArrowLeft size={20} color="#FFFFFF" />
              </TouchableOpacity>
            ) : <View style={styles.iconBtnSpacer} />}
            <View style={styles.rightRow}>
              {right}
              {showMenu && (
                <TouchableOpacity onPress={openDrawer} style={styles.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Menu size={20} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
        {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  shadowWrap: {
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 6,
  },
  hero: {
    paddingHorizontal: 20, paddingBottom: 18,
    borderBottomLeftRadius: 20, borderBottomRightRadius: 20,
    overflow: 'hidden',
  },
  heroCompact: { paddingBottom: 16 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  rightRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  iconBtnSpacer: { width: 34, height: 34 },
  title: { fontSize: 19, fontWeight: '700', color: '#FFFFFF', textAlign: 'center', letterSpacing: -0.2 },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 3, lineHeight: 18, textAlign: 'center' },
});
