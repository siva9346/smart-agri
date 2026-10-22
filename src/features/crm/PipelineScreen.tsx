import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { crmApi, Lead, LEAD_STAGES } from '../../services/platform';
import { useApi, useAuth } from '../../hooks/useApi';
import { Loading, ErrorView, Sheet, Button, Field, Input, Tag, StatusTag, Row, humanize, timeAgo, toast } from '../../ui';
import { TOKENS, TYPE } from '../../theme';

/**
 * Kanban pipeline. Columns scroll horizontally; tap a card to open it, long-press
 * (or use "Move") to change stage. Moving to Lost requires a reason, and only
 * admins can reopen Won/Lost leads — both enforced by the backend as well.
 */
export const PipelineScreen = ({ navigation }: any) => {
  const { can } = useAuth();
  const { width } = useWindowDimensions();
  const colWidth = Math.min(300, Math.max(240, width * 0.78));
  const { data, setData, loading, error, reload } = useApi(() => crmApi.pipeline(), []);
  const [moving, setMoving] = useState<Lead | null>(null);
  const [target, setTarget] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  if (loading) return <Loading />;
  if (error || !data) return <ErrorView message={error ?? 'Failed to load'} onRetry={reload} />;

  const move = async () => {
    if (!moving) return;
    setSaving(true);
    try {
      await crmApi.stage(moving.leadId, target, reason || undefined);
      // optimistic local move so the board doesn't jump while reloading
      setData(d => d && ({
        stages: d.stages.map(col => col.stage === moving.stage
          ? { ...col, count: col.count - 1, items: col.items.filter(i => i.leadId !== moving.leadId) }
          : col.stage === target ? { ...col, count: col.count + 1, items: [{ ...moving, stage: target }, ...col.items] } : col),
      }));
      toast(`Moved to ${humanize(target)}`);
      setMoving(null);
      reload();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView horizontal contentContainerStyle={{ padding: 12, gap: 12 }} showsHorizontalScrollIndicator>
        {data.stages.map(col => (
          <View key={col.stage} style={[styles.column, { width: colWidth }]}>
            <View style={styles.colHead}>
              <StatusTag status={col.stage} />
              <Text style={TYPE.h3}>{col.count}</Text>
            </View>
            <ScrollView contentContainerStyle={{ gap: 8, paddingBottom: 16 }} nestedScrollEnabled>
              {col.items.map(l => (
                <TouchableOpacity key={l.leadId} style={styles.card} activeOpacity={0.7}
                                  onPress={() => navigation.navigate('LeadDetail', { id: l.leadId })}
                                  onLongPress={() => can('lead.edit') && (setMoving(l), setTarget(''), setReason(''))}
                                  accessibilityHint="Long press to move to another stage">
                  <Text style={TYPE.h3} numberOfLines={1}>{l.customerName}</Text>
                  <Text style={TYPE.secondary} numberOfLines={2}>{l.requirement}</Text>
                  <Row gap={6} wrap>
                    {(l.priority === 'HIGH' || l.priority === 'URGENT') && <StatusTag status={l.priority} small />}
                    {l.ownerId === 'UNASSIGNED' ? <Tag text="Unassigned" color="orange" small /> : <Text style={TYPE.caption}>{l.ownerName}</Text>}
                    <Text style={[TYPE.caption, { marginLeft: 'auto' }]}>{timeAgo(l.updatedAt)}</Text>
                  </Row>
                  {can('lead.edit') && (
                    <Button title="Move" size="sm" type="text" style={{ alignSelf: 'flex-start', minHeight: 32, paddingHorizontal: 0 }}
                            onPress={() => { setMoving(l); setTarget(''); setReason(''); }} />
                  )}
                </TouchableOpacity>
              ))}
              {!col.items.length && <Text style={[TYPE.caption, { textAlign: 'center', paddingVertical: 20 }]}>No leads</Text>}
              {col.count > col.items.length && <Text style={TYPE.caption}>Showing {col.items.length} of {col.count}</Text>}
            </ScrollView>
          </View>
        ))}
      </ScrollView>

      <Sheet visible={!!moving} onClose={() => setMoving(null)} title={`Move ${moving?.customerName ?? ''}`}
             footer={<Button title="Move" type="primary" block loading={saving}
                             disabled={!target || (target === 'LOST' && !reason.trim())} onPress={move} />}>
        <View style={{ gap: 8 }}>
          <Row gap={8} wrap>
            {LEAD_STAGES.filter(s => s !== moving?.stage).map(s => (
              <TouchableOpacity key={s} onPress={() => setTarget(s)} style={[styles.stageChip, target === s && styles.stageChipOn]}>
                <Text style={[TYPE.secondary, target === s && { color: TOKENS.colorPrimary, fontWeight: '700' }]}>{humanize(s)}</Text>
              </TouchableOpacity>
            ))}
          </Row>
          {target === 'LOST' && (
            <Field label="Reason" required><Input value={reason} onChangeText={setReason} placeholder="Why was it lost?" /></Field>
          )}
        </View>
      </Sheet>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: TOKENS.colorBgLayout },
  column: { backgroundColor: '#F0F3F0', borderRadius: TOKENS.radiusLg, padding: 10, maxHeight: '100%' },
  colHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  card: { backgroundColor: '#FFF', borderRadius: TOKENS.radius, padding: 12, gap: 6, borderWidth: 1, borderColor: TOKENS.colorBorder },
  stageChip: { paddingHorizontal: 12, minHeight: 38, justifyContent: 'center', borderRadius: 19, borderWidth: 1, borderColor: TOKENS.colorBorder },
  stageChipOn: { borderColor: TOKENS.colorPrimary, backgroundColor: TOKENS.colorPrimaryBg },
});
