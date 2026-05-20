import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, BORDER_RADIUS } from '../../../theme';
import { User, Phone, MapPin, Calendar, MessageSquare, CheckCircle, ArrowLeft } from 'lucide-react-native';

export const EnquiryDetailsScreen = ({ route, navigation }: any) => {
  const { enquiry } = route.params;
  const [isPending, setIsPending] = useState(enquiry.status === 'Pending');

  const handleMarkCompleted = () => {
    Alert.alert('Confirm', 'Mark this enquiry as completed?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Yes', 
        onPress: () => {
          setIsPending(false);
          const updatedEnquiry = { ...enquiry, status: 'Completed' };
          Alert.alert('Success', 'Enquiry marked as completed.', [
            { text: 'OK', onPress: () => navigation.navigate('EnquiryList', { updatedEnquiry }) }
          ]);
        }
      }
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Back Header */}
      <View style={styles.screenHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ArrowLeft size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Enquiry Info</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        <View style={styles.headerCard}>
          <Text style={styles.enquiryId}>ID: {enquiry.id}</Text>
          <View style={[styles.statusBadge, { backgroundColor: isPending ? '#FFF3E0' : '#E8F5E9' }]}>
            <Text style={[styles.statusText, { color: isPending ? '#E65100' : '#2E7D32' }]}>
              {isPending ? 'Pending' : 'Completed'}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Farmer Info</Text>
          <View style={styles.detailRow}>
            <User size={18} color="#666" style={styles.icon} />
            <Text style={styles.detailText}>{enquiry.userName}</Text>
          </View>
          <View style={styles.detailRow}>
            <Phone size={18} color="#666" style={styles.icon} />
            <Text style={styles.detailText}>{enquiry.phone}</Text>
          </View>
          <View style={styles.detailRow}>
            <MapPin size={18} color="#666" style={styles.icon} />
            <Text style={styles.detailText}>{enquiry.village}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Enquiry Details</Text>
          <View style={styles.detailRow}>
            <Calendar size={18} color="#666" style={styles.icon} />
            <Text style={styles.detailText}>Submitted on: {enquiry.date}</Text>
          </View>
          <View style={styles.messageBox}>
            <MessageSquare size={18} color="#999" style={{ marginBottom: 8 }} />
            <Text style={styles.messageText}>{enquiry.fullMessage}</Text>
          </View>
        </View>

        {isPending && (
          <TouchableOpacity style={styles.completeBtn} onPress={handleMarkCompleted}>
            <CheckCircle size={20} color="#FFF" style={{ marginRight: 8 }} />
            <Text style={styles.completeBtnText}>Mark as Completed</Text>
          </TouchableOpacity>
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
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  backBtn: {
    marginRight: SPACING.md,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    padding: SPACING.md,
  },
  headerCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  enquiryId: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
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
    fontSize: 16,
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
    marginRight: 10,
  },
  detailText: {
    fontSize: 15,
    color: '#444',
  },
  messageBox: {
    backgroundColor: '#F9FAFB',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: SPACING.sm,
  },
  messageText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
  },
  completeBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.success,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    marginTop: SPACING.lg,
    elevation: 2,
  },
  completeBtnText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
