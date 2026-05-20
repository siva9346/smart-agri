import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, Alert } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS } from '../../../theme';
import { Thermometer, Edit2, Trash2, Plus, AlertTriangle } from 'lucide-react-native';

const INITIAL_SYMPTOMS = [
  { id: '1', title: 'Leaf Yellowing', description: 'Lower leaves turning yellow from edge to vein.', crop: 'Paddy', severity: 'Medium' },
  { id: '2', title: 'Brown Spots', description: 'Tiny brown circular spots appearing on fruit surface.', crop: 'Tomato', severity: 'High' },
  { id: '3', title: 'Stunted Growth', description: 'Plant height significantly shorter than average.', crop: 'Sugarcane', severity: 'Low' },
  { id: '4', title: 'White Powdery Mildew', description: 'Fuzzy white spots spanning across green foliage.', crop: 'Cotton', severity: 'High' },
  { id: '5', title: 'Root Rot', description: 'Blackening and decaying of primary root systems.', crop: 'Banana', severity: 'High' },
];

export const SymptomsListScreen = ({ navigation, route }: any) => {
  const [symptoms, setSymptoms] = useState(INITIAL_SYMPTOMS);

  React.useEffect(() => {
    if (route.params?.newSymptom) {
      setSymptoms(prev => [route.params.newSymptom, ...prev]);
      navigation.setParams({ newSymptom: undefined });
    }
    if (route.params?.updatedSymptom) {
      setSymptoms(prev => prev.map(s => s.id === route.params.updatedSymptom.id ? route.params.updatedSymptom : s));
      navigation.setParams({ updatedSymptom: undefined });
    }
  }, [route.params?.newSymptom, route.params?.updatedSymptom]);

  const handleDelete = (id: string) => {
    Alert.alert('Delete Symptom', 'Are you sure you want to delete this symptom?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => setSymptoms(prev => prev.filter(s => s.id !== id)) }
    ]);
  };

  const renderSymptom = ({ item }: { item: any }) => {
    const getSeverityColor = (sev: string) => {
      switch(sev) {
        case 'High': return '#E53935';
        case 'Medium': return '#FB8C00';
        default: return '#43A047';
      }
    };

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.title}>{item.title}</Text>
          <View style={styles.actions}>
            <TouchableOpacity onPress={() => navigation.navigate('EditSymptom', { symptom: item })} style={styles.actionBtn}>
              <Edit2 size={18} color="#666" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.actionBtn}>
              <Trash2 size={18} color="#E53935" />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.description} numberOfLines={2}>{item.description}</Text>

        <View style={styles.cardFooter}>
          <View style={styles.footerBadge}>
            <Thermometer size={14} color="#666" style={{ marginRight: 4 }} />
            <Text style={styles.footerText}>{item.crop}</Text>
          </View>
          <View style={[styles.severityBadge, { borderColor: getSeverityColor(item.severity) }]}>
            <AlertTriangle size={12} color={getSeverityColor(item.severity)} style={{ marginRight: 4 }} />
            <Text style={[styles.severityText, { color: getSeverityColor(item.severity) }]}>{item.severity}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerArea}>
        <Text style={styles.headerTitle}>Crop Symptoms</Text>
        <TouchableOpacity 
          style={styles.addBtn}
          onPress={() => navigation.navigate('AddSymptom')}
        >
          <Plus size={20} color="#FFF" />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={symptoms}
        keyExtractor={item => item.id}
        renderItem={renderSymptom}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 40, color: '#999' }}>No symptoms recorded.</Text>}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  headerArea: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.md,
  },
  addBtnText: {
    color: '#FFF',
    fontWeight: 'bold',
    marginLeft: 4,
  },
  listContent: {
    padding: SPACING.md,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
  },
  actionBtn: {
    padding: 6,
    marginLeft: 4,
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: SPACING.md,
    height: 40,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#EEE',
    paddingTop: SPACING.sm,
  },
  footerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    color: '#555',
    fontWeight: '500',
  },
  severityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    backgroundColor: '#FFF',
  },
  severityText: {
    fontSize: 11,
    fontWeight: 'bold',
  }
});
