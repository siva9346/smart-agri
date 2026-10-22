import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ChevronLeft, ChevronRight, Pencil } from 'lucide-react-native';
import { crmApi } from '../../services/platform';
import { useApi, useAuth } from '../../hooks/useApi';
import { Page, Section, Row, Button, Sheet, Field, Input, Loading, ErrorView, Empty, formatMoney, toast } from '../../ui';
import { TOKENS, TYPE } from '../../theme';

const shiftMonth = (m: string, n: number) => { const d = new Date(`${m}-01T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 7); };

const Bar = ({ pct }: { pct: number | null }) => (
  <View style={styles.track}>
    <View style={[styles.fill, { width: `${Math.min(100, pct ?? 0)}%`, backgroundColor: (pct ?? 0) >= 100 ? TOKENS.colorSuccess : TOKENS.colorPrimary }]} />
  </View>
);

/** Monthly sales targets per staff member; progress is computed live from accepted quotations and won leads. */
export const TargetsScreen = () => {
  const { can } = useAuth();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const { data, loading, error, reload, refreshing, refresh } = useApi(() => crmApi.targets(month), [month]);
  const [editing, setEditing] = useState<any>(null);
  const [revenue, setRevenue] = useState('');
  const [won, setWon] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await crmApi.setTarget({ month, userId: editing.userId, revenue: Number(revenue || 0), wonLeads: Number(won || 0) });
      toast('Target saved');
      setEditing(null);
      reload();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page refreshing={refreshing} onRefresh={refresh}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Button title="" icon={ChevronLeft} size="sm" onPress={() => setMonth(shiftMonth(month, -1))} accessibilityLabel="Previous month" />
        <Text style={TYPE.h2}>{new Date(`${month}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</Text>
        <Button title="" icon={ChevronRight} size="sm" onPress={() => setMonth(shiftMonth(month, 1))} accessibilityLabel="Next month" />
      </Row>
      {loading ? <Loading /> : error || !data ? <ErrorView message={error ?? 'Failed'} onRetry={reload} /> : (
        <>
          <Section>
            {!data.items.length && <Empty title="No staff members" />}
            {data.items.map(r => (
              <View key={r.userId} style={styles.row}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text style={TYPE.h3}>{r.name}</Text>
                  {can('reports.team') && (
                    <Button title="Set" icon={Pencil} size="sm" type="text" onPress={() => {
                      setEditing(r); setRevenue(r.target.revenue ? String(r.target.revenue) : ''); setWon(r.target.wonLeads ? String(r.target.wonLeads) : '');
                    }} />
                  )}
                </Row>
                <Text style={TYPE.secondary}>Revenue {formatMoney(r.achieved.revenue)} of {r.target.revenue ? formatMoney(r.target.revenue) : 'no target'}
                  {r.revenuePct != null ? ` · ${r.revenuePct}%` : ''}</Text>
                <Bar pct={r.revenuePct} />
                <Text style={TYPE.secondary}>Won leads {r.achieved.wonLeads} of {r.target.wonLeads || 'no target'}{r.wonPct != null ? ` · ${r.wonPct}%` : ''}</Text>
                <Bar pct={r.wonPct} />
              </View>
            ))}
          </Section>
          <Text style={TYPE.caption}>{data.note}</Text>
        </>
      )}
      <Sheet visible={!!editing} onClose={() => setEditing(null)} title={`Target · ${editing?.name ?? ''}`}
             footer={<Button title="Save target" type="primary" block loading={saving} onPress={save} />}>
        <View style={{ gap: 12 }}>
          <Field label="Revenue target (₹)"><Input value={revenue} onChangeText={v => setRevenue(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" /></Field>
          <Field label="Won leads target"><Input value={won} onChangeText={v => setWon(v.replace(/\D/g, ''))} keyboardType="number-pad" /></Field>
        </View>
      </Sheet>
    </Page>
  );
};

const styles = StyleSheet.create({
  row: { gap: 6, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: TOKENS.colorSplit },
  track: { height: 8, borderRadius: 4, backgroundColor: TOKENS.colorSplit, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
});
