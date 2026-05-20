import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, BORDER_RADIUS } from '../../../theme';
import { MapPin, Phone, Mail, User, Image as ImageIcon, Banknote, History, Activity, ArrowLeft, Navigation } from 'lucide-react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store';

export const CustomerDetailsScreen = ({ route, navigation }: any) => {
  const { customer } = route.params;
  
  const allLands = useSelector((state: RootState) => state.land.lands);
  const allCycles = useSelector((state: RootState) => state.crop.cropCycles);
  const allRecords = useSelector((state: RootState) => state.crop.dailyRecords);

  const lands = allLands.filter(l => l.customerId === customer.id);

  return (
    <SafeAreaView style={styles.container}>
      {/* Back Header */}
      <View style={styles.customHeader}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
            <ArrowLeft size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Farmer Profile</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        {/* Personal Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Info</Text>
          <View style={styles.detailRow}>
            <User size={18} color="#666" style={styles.icon} />
            <Text style={styles.detailText}>{customer.name}</Text>
          </View>
          <View style={styles.detailRow}>
            <MapPin size={18} color="#666" style={styles.icon} />
            <Text style={styles.detailText}>{customer.village}</Text>
          </View>
          <View style={styles.detailRow}>
            <Phone size={18} color="#666" style={styles.icon} />
            <Text style={styles.detailText}>{customer.phone}</Text>
          </View>
          {customer.email && (
            <View style={styles.detailRow}>
              <Mail size={18} color="#666" style={styles.icon} />
              <Text style={styles.detailText}>{customer.email}</Text>
            </View>
          )}
        </View>

        {/* Land Details */}
        <Text style={[styles.sectionTitle, { marginLeft: SPACING.md, marginTop: SPACING.lg, marginBottom: SPACING.sm }]}>
          Land Details ({lands.length})
        </Text>

        {lands && lands.length > 0 ? (
          lands.map((land: any, index: number) => {
            const cropCycles = allCycles.filter(cc => cc.landId === land.id);
            const currentCropObj = cropCycles.find(cc => cc.status === 'current');
            return (
              <View key={land.id} style={styles.landCard}>
              <View style={styles.landHeader}>
                <Text style={styles.landTitle}>Land {index + 1}</Text>
                <View style={styles.landHeaderRight}>
                  <View style={styles.sizeBadge}>
                    <Text style={styles.sizeText}>{land.size}</Text>
                  </View>
                  {land.latitude != null && land.longitude != null && (
                    <TouchableOpacity
                      style={styles.viewLocationBtn}
                      onPress={() =>
                        Linking.openURL(
                          `https://www.google.com/maps?q=${land.latitude},${land.longitude}`
                        )
                      }
                    >
                      <Navigation size={12} color="#fff" />
                      <Text style={styles.viewLocationText}>View Location</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <View style={styles.landDetailsGrid}>
                <View style={styles.gridItem}>
                  <Text style={styles.gridLabel}>Soil Type</Text>
                  <Text style={styles.gridValue}>{land.soil}</Text>
                </View>
                 <View style={styles.gridItem}>
                  <Text style={styles.gridLabel}>Current Crop</Text>
                  <Text style={styles.gridValue}>{currentCropObj?.cropName || 'None'}</Text>
                </View>
                <View style={styles.gridItem}>
                  <Text style={styles.gridLabel}>Total Cultivations</Text>
                  <Text style={styles.gridValue}>{cropCycles.length}</Text>
                </View>
                <View style={styles.gridItem}>
                  <Text style={styles.gridLabel}>Fertilizer Used</Text>
                  <Text style={styles.gridValue}>{land.fertilizerUsed}</Text>
                </View>
                <View style={[styles.gridItem, { borderBottomWidth: 0 }]}>
                  <Text style={styles.gridLabel}>Manure Used</Text>
                  <Text style={styles.gridValue}>{land.manureUsed}</Text>
                </View>
              </View>

              {/* Expense Summary Section */}
              <View style={styles.expenseSummarySection}>
                  <Text style={styles.expenseSectionTitle}>Cultivation History & Costs</Text>
                  
                  {cropCycles && cropCycles.length > 0 ? (
                      <View>
                          {cropCycles.map((crop: any, cidx: number) => {
                              const cropRecords = allRecords.filter(r => r.cropCycleId === crop.id);
                              const cropExpense = cropRecords.reduce((sum: number, r: any) => sum + r.expense, 0);
                              const isCurrent = crop.status === 'current';
                              
                              return (
                                  <View key={crop.id} style={[styles.cropExpenseRow, isCurrent && styles.currentCropHighlight]}>
                                      <View style={styles.cropInfo}>
                                          {isCurrent ? <Banknote size={16} color={COLORS.primary} /> : <History size={16} color="#999" />}
                                          <Text style={[styles.cropName, isCurrent && styles.boldText]}>
                                              {crop.cropName} {isCurrent && '(Current)'}
                                          </Text>
                                      </View>
                                      <View style={styles.amountArea}>
                                          <Text style={[styles.cropAmount, isCurrent && styles.boldText]}>
                                              ₹{cropExpense.toLocaleString()}
                                          </Text>
                                          <TouchableOpacity 
                                              style={styles.viewTrackBtn}
                                              onPress={() => navigation.navigate('CropTracking', { cropCycleId: crop.id, cropName: crop.cropName, readOnly: true })}
                                          >
                                              <Activity size={12} color={COLORS.primary} />
                                              <Text style={styles.viewTrackText}>View Tracking</Text>
                                          </TouchableOpacity>
                                      </View>
                                  </View>
                              );
                          })}
                          
                          <View style={styles.landTotalRow}>
                              <Text style={styles.landTotalLabel}>TOTAL (Land)</Text>
                              <Text style={styles.landTotalAmount}>
                                  ₹{(cropCycles.reduce((sum: number, crop: any) => {
                                      const cropRecords = allRecords.filter(r => r.cropCycleId === crop.id);
                                      return sum + cropRecords.reduce((s: number, r: any) => s + r.expense, 0);
                                  }, 0)).toLocaleString()}
                              </Text>
                          </View>
                      </View>
                  ) : (
                      <Text style={styles.noDataText}>No cultivation records found</Text>
                  )}
              </View>

              {/* Images placeholder section */}
              <Text style={styles.imageSectionTitle}>Land Images</Text>
              <View style={styles.imageGrid}>
                <View style={styles.imageContainer}>
                  <View style={styles.placeholderImg}>
                    <ImageIcon size={24} color="#CCC" />
                  </View>
                  <Text style={styles.imageCaption}>Previous Crop</Text>
                </View>
                <View style={styles.imageContainer}>
                  <View style={styles.placeholderImg}>
                    <ImageIcon size={24} color="#CCC" />
                  </View>
                  <Text style={styles.imageCaption}>Current Status</Text>
                </View>
              </View>
            </View>
          );
          })
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No land details available</Text>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8EDF2',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
    letterSpacing: 0.2,
  },
  content: {
    padding: SPACING.md,
  },
  section: {
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: SPACING.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  icon: {
    marginRight: 12,
  },
  detailText: {
    fontSize: 15,
    color: '#444',
    flex: 1,
  },
  landCard: {
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
  landHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  landHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  viewLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  viewLocationText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '700',
  },
  landTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  sizeBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  sizeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  landDetailsGrid: {
    marginBottom: SPACING.lg,
  },
  gridItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  gridLabel: {
    fontSize: 13,
    color: '#666',
    flex: 1,
  },
  gridValue: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  imageSectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#444',
    marginBottom: SPACING.sm,
  },
  imageGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  imageContainer: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  placeholderImg: {
    width: '100%',
    height: 100,
    backgroundColor: '#F0F0F0',
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  imageCaption: {
    fontSize: 12,
    color: '#666',
  },
  emptyCard: {
    backgroundColor: '#FFF',
    padding: SPACING.xl,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
  },
  emptyText: {
    color: '#999',
    fontStyle: 'italic',
  },
  expenseSummarySection: {
      marginTop: SPACING.md,
      paddingTop: SPACING.md,
      borderTopWidth: 1,
      borderTopColor: '#EEE',
  },
  expenseSectionTitle: {
      fontSize: 14,
      fontWeight: 'bold',
      color: '#444',
      marginBottom: SPACING.sm,
  },
  cropExpenseRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 8,
      borderRadius: 6,
  },
  currentCropHighlight: {
      backgroundColor: '#E8F5E9',
      borderLeftWidth: 3,
      borderLeftColor: COLORS.primary,
  },
  cropInfo: {
      flexDirection: 'row',
      alignItems: 'center',
  },
  cropName: {
      fontSize: 14,
      color: '#555',
      marginLeft: 8,
  },
  cropAmount: {
      fontSize: 14,
      color: '#333',
  },
  boldText: {
      fontWeight: 'bold',
      color: COLORS.primary,
  },
  amountArea: {
      alignItems: 'flex-end',
  },
  viewTrackBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#E8F5E9',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
      marginTop: 4,
      borderWidth: 1,
      borderColor: COLORS.primary,
  },
  viewTrackText: {
      fontSize: 10,
      color: COLORS.primary,
      fontWeight: 'bold',
      marginLeft: 4,
  },
  landTotalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: SPACING.md,
      paddingTop: SPACING.sm,
      borderTopWidth: 2,
      borderTopColor: COLORS.primary,
      alignItems: 'center',
  },
  landTotalLabel: {
      fontSize: 14,
      fontWeight: 'bold',
      color: COLORS.primary,
  },
  landTotalAmount: {
      fontSize: 18,
      fontWeight: 'bold',
      color: COLORS.primary,
  },
  noDataText: {
      fontSize: 12,
      color: '#999',
      fontStyle: 'italic',
      textAlign: 'center',
      paddingVertical: 10,
  }
});
