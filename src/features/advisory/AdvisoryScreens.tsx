import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS } from '../../theme';
import { mockRepository } from '../../repositories/MockRepository';
import { RainData, Symptom } from '../../types/domain';
import { Card } from '../../components/Card';
import { LoadingState, EmptyState, ErrorState } from '../../components/States';

export const RainUpdates = () => {
  const [data, setData] = useState<RainData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    mockRepository.getRainUpdates().then(res => {
      if (res.success) setData(res.data);
      setLoading(false);
    });
  }, []);

  if (loading) return <LoadingState />;

  return (
    <FlatList
      data={data}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.container}
      renderItem={({ item }) => (
        <Card>
          <Text style={styles.title}>{item.date}</Text>
          <Text style={styles.detail}>Rainfall: {item.rainfall}</Text>
          <Text style={styles.detail}>Location: {item.location}</Text>
        </Card>
      )}
      ListEmptyComponent={<EmptyState />}
    />
  );
};

export const SymptomsView = () => {
  const [data, setData] = useState<Symptom[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    mockRepository.getSymptoms().then(res => {
      if (res.success) setData(res.data);
      setLoading(false);
    });
  }, []);

  if (loading) return <LoadingState />;

  return (
    <FlatList
      data={data}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.container}
      renderItem={({ item }) => (
        <Card>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.desc}>{item.description}</Text>
          <View style={styles.solutionContainer}>
            <Text style={styles.solutionLabel}>Solution:</Text>
            <Text style={styles.solutionText}>{item.solution}</Text>
          </View>
        </Card>
      )}
      ListEmptyComponent={<EmptyState />}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    padding: SPACING.md,
    backgroundColor: COLORS.background,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  detail: {
    fontSize: 14,
    color: COLORS.text,
  },
  desc: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  solutionContainer: {
    backgroundColor: COLORS.primary + '10',
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
  },
  solutionLabel: {
    fontWeight: 'bold',
    color: COLORS.primary,
    fontSize: 12,
  },
  solutionText: {
    color: COLORS.text,
    fontSize: 14,
  }
});
