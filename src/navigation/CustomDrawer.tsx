import React, { createContext, useContext, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, Animated, Pressable, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = Math.min(320, SCREEN_WIDTH * 0.78);

interface DrawerContextValue {
  openDrawer: () => void;
  closeDrawer: () => void;
}

const DrawerContext = createContext<DrawerContextValue | null>(null);

// Lets a header button deep inside the Stack (which renders as a child of
// CustomDrawer) open/close the panel without prop-drilling.
export const useDrawer = () => {
  const ctx = useContext(DrawerContext);
  if (!ctx) throw new Error('useDrawer must be used within a CustomDrawer');
  return ctx;
};

interface CustomDrawerProps {
  children: React.ReactNode;
  renderContent: (close: () => void) => React.ReactNode;
}

// Hand-rolled slide-out drawer using RN's built-in Animated API — deliberately
// avoids react-native-reanimated/@react-navigation/drawer, which crash this
// project's Expo Go client on launch (see session notes). No native deps
// beyond core RN, so it works identically in Expo Go and any custom build.
export const CustomDrawer = ({ children, renderContent }: CustomDrawerProps) => {
  const [visible, setVisible] = useState(false);
  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  const openDrawer = useCallback(() => {
    setVisible(true);
    Animated.parallel([
      Animated.timing(translateX, { toValue: 0, duration: 260, useNativeDriver: true }),
      Animated.timing(backdropOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
    ]).start();
  }, [translateX, backdropOpacity]);

  const closeDrawer = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateX, { toValue: -DRAWER_WIDTH, duration: 220, useNativeDriver: true }),
      Animated.timing(backdropOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(() => setVisible(false));
  }, [translateX, backdropOpacity]);

  return (
    <DrawerContext.Provider value={{ openDrawer, closeDrawer }}>
      <View style={styles.root}>
        {children}
        {visible && (
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
              <Pressable style={StyleSheet.absoluteFill} onPress={closeDrawer} />
            </Animated.View>
            <Animated.View style={[styles.panel, { width: DRAWER_WIDTH, transform: [{ translateX }] }]}>
              {renderContent(closeDrawer)}
            </Animated.View>
          </View>
        )}
      </View>
    </DrawerContext.Provider>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  panel: { position: 'absolute', top: 0, bottom: 0, left: 0, elevation: 16, shadowColor: '#000', shadowOffset: { width: 2, height: 0 }, shadowOpacity: 0.3, shadowRadius: 10 },
});
