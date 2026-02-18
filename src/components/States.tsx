import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING } from '../theme';

export const LoadingState = () => (
  <View style={styles.container}>
    <ActivityIndicator size="large" color={COLORS.primary} />
    <Text style={styles.text}>Loading...</Text>
  </View>
);

export const EmptyState = ({ message = 'No data available' }: { message?: string }) => (
  <View style={styles.container}>
    <Text style={styles.message}>{message}</Text>
  </View>
);

export const ErrorState = ({ error }: { error: string }) => (
  <View style={styles.container}>
    <Text style={[styles.message, { color: COLORS.error }]}>Error: {error}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  text: {
    marginTop: SPACING.sm,
    color: COLORS.textSecondary,
  },
  message: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});
