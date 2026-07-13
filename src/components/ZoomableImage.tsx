import React, { useRef } from 'react';
import { Animated, PanResponder, Dimensions, StyleSheet } from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_MS = 280;

/**
 * Full-bleed zoomable image: pinch-to-zoom, pan-when-zoomed, double-tap to
 * toggle 1x/2.5x. Built on PanResponder + Animated only (both ship with core
 * React Native) so it works in Expo Go without adding a gesture library.
 */
export const ZoomableImage = ({ uri }: { uri: string }) => {
  const scale      = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  const lastScale     = useRef(1);
  const lastDistance  = useRef(0);
  const lastTranslate = useRef({ x: 0, y: 0 });
  const lastTap       = useRef(0);

  const getDistance = (touches: any[]) => {
    const [a, b] = touches;
    return Math.sqrt((a.pageX - b.pageX) ** 2 + (a.pageY - b.pageY) ** 2);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        if (evt.nativeEvent.touches.length === 2) {
          lastDistance.current = getDistance(evt.nativeEvent.touches);
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        const touches = evt.nativeEvent.touches;
        if (touches.length === 2) {
          const dist = getDistance(touches);
          if (lastDistance.current > 0) {
            const next = Math.min(Math.max(lastScale.current * (dist / lastDistance.current), MIN_SCALE), MAX_SCALE);
            scale.setValue(next);
          }
        } else if (touches.length === 1 && lastScale.current > 1) {
          translateX.setValue(lastTranslate.current.x + gestureState.dx);
          translateY.setValue(lastTranslate.current.y + gestureState.dy);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (evt.nativeEvent.touches.length === 0) {
          scale.stopAnimation((v: number) => { lastScale.current = v; });
          lastTranslate.current = {
            x: lastTranslate.current.x + gestureState.dx,
            y: lastTranslate.current.y + gestureState.dy,
          };
          lastDistance.current = 0;

          const now = Date.now();
          if (now - lastTap.current < DOUBLE_TAP_MS) {
            const target = lastScale.current > 1 ? 1 : 2.5;
            lastScale.current = target;
            lastTranslate.current = { x: 0, y: 0 };
            Animated.parallel([
              Animated.spring(scale, { toValue: target, useNativeDriver: true }),
              Animated.spring(translateX, { toValue: 0, useNativeDriver: true }),
              Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
            ]).start();
          }
          lastTap.current = now;
        }
      },
    })
  ).current;

  return (
    <Animated.Image
      source={{ uri }}
      style={[styles.image, { transform: [{ scale }, { translateX }, { translateY }] }]}
      resizeMode="contain"
      {...panResponder.panHandlers}
    />
  );
};

const styles = StyleSheet.create({
  image: { width: SCREEN_W, height: SCREEN_H * 0.8 },
});
