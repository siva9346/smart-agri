import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Stethoscope, ClipboardList, Sparkles, FileText, ChevronRight } from 'lucide-react-native';
import { adminApi } from '../../services/platform';
import { useAiStatus } from '../ai/AiAssistPanel';
import { StatusTag, formatMoney } from '../../ui';
import { TOKENS, TYPE } from '../../theme';

/**
 * Customer dashboard block: expert help, consultations, quotations, AI assistant.
 * Rendered inside the existing FarmerDashboard so the current home layout stays intact.
 */
export const CustomerHubCard = ({ navigation }: { navigation: any }) => {
  const [d, setD] = useState<any>(null);
  const ai = useAiStatus();
  useFocusEffect(useCallback(() => { adminApi.dashboard().then(setD).catch(() => {}); }, []));
  const aiOn = !!(ai?.features?.CUSTOMER_ASSISTANT?.available || ai?.features?.CROP_PROBLEM?.available);
  const latest = d?.recentConsultations?.[0];

  return (
    <View style={styles.wrap}>
      <TouchableOpacity style={styles.cta} onPress={() => navigation.navigate('ConsultationRequest')} activeOpacity={0.8}
                        accessibilityRole="button" accessibilityLabel="Get suggestions from experts">
        <View style={styles.ctaIcon}><Stethoscope size={22} color="#FFF" /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.ctaTitle}>Get Suggestions from Experts</Text>
          <Text style={styles.ctaSub}>Crop problem? Send photos to an agricultural expert.</Text>
        </View>
        <ChevronRight size={20} color="#FFF" />
      </TouchableOpacity>

      <View style={styles.row}>
        <Tile icon={ClipboardList} label="My consultations" value={d?.openConsultations ? `${d.openConsultations} open` : undefined}
              onPress={() => navigation.navigate('ConsultationList')} />
        <Tile icon={FileText} label="Quotations" value={d?.pendingQuotations?.length ? `${d.pendingQuotations.length} to review` : undefined}
              onPress={() => navigation.navigate('QuotationList')} />
        {aiOn && <Tile icon={Sparkles} label="AI assistant" tone={TOKENS.colorInfo} onPress={() => navigation.navigate('AiAssistant')} />}
      </View>

      {latest && (
        <TouchableOpacity style={styles.latest} onPress={() => navigation.navigate('ConsultationDetail', { id: latest.consultationId })}>
          <View style={{ flex: 1 }}>
            <Text style={TYPE.caption}>Latest request</Text>
            <Text style={TYPE.h3} numberOfLines={1}>{latest.cropName}{latest.expertName ? ` · ${latest.expertName}` : ''}</Text>
          </View>
          <StatusTag status={latest.status} small />
        </TouchableOpacity>
      )}
      {!!d?.recommendationsReady && (
        <Text style={styles.ready}>{d.recommendationsReady} recommendation(s) ready to read</Text>
      )}
      {d?.pendingQuotations?.[0] && (
        <TouchableOpacity style={styles.latest} onPress={() => navigation.navigate('QuotationDetail', { id: d.pendingQuotations[0].quotationId })}>
          <View style={{ flex: 1 }}>
            <Text style={TYPE.caption}>Quotation awaiting your reply</Text>
            <Text style={TYPE.h3}>{d.pendingQuotations[0].quotationNumber} · {formatMoney(d.pendingQuotations[0].grandTotal)}</Text>
          </View>
          <ChevronRight size={18} color={TOKENS.colorTextTertiary} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const Tile = ({ icon: Icon, label, value, onPress, tone = TOKENS.colorPrimary }: any) => (
  <TouchableOpacity style={styles.tile} onPress={onPress} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={label}>
    <Icon size={20} color={tone} />
    <Text style={styles.tileLabel} numberOfLines={1}>{label}</Text>
    {!!value && <Text style={TYPE.caption}>{value}</Text>}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 16, marginTop: 16, gap: 10 },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: TOKENS.radiusLg, backgroundColor: TOKENS.colorPrimary },
  ctaIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  ctaTitle: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  ctaSub: { color: 'rgba(255,255,255,0.88)', fontSize: 12.5, marginTop: 2 },
  row: { flexDirection: 'row', gap: 10 },
  tile: { flex: 1, backgroundColor: '#FFF', borderRadius: TOKENS.radius, borderWidth: 1, borderColor: TOKENS.colorBorder, padding: 12, gap: 4, minHeight: 76 },
  tileLabel: { fontSize: 13, fontWeight: '600', color: TOKENS.colorText },
  latest: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFF', borderRadius: TOKENS.radius, borderWidth: 1, borderColor: TOKENS.colorBorder, padding: 12 },
  ready: { fontSize: 13, color: TOKENS.colorSuccess, fontWeight: '600', paddingHorizontal: 4 },
});
