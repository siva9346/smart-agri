import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Trash2, Plus } from 'lucide-react-native';
import { adminApi } from '../../../services/platform';
import { useApi, useAuth } from '../../../hooks/useApi';
import { Page, Section, Field, Input, Segmented, Button, Row, Alert, Loading, ErrorView, toast } from '../../../ui';
import { TOKENS, TYPE } from '../../../theme';

type MapRows = { key: string; values: string }[];
const toRows = (m: Record<string, string[]>): MapRows => Object.entries(m ?? {}).map(([key, v]) => ({ key, values: v.join(', ') }));
const toMap = (rows: MapRows) => Object.fromEntries(rows.filter(r => r.key.trim())
  .map(r => [r.key.trim().toLowerCase(), r.values.split(',').map(v => v.trim().toLowerCase()).filter(Boolean)]));

const MappingEditor = ({ title, help, rows, setRows, keyLabel, readOnly }: {
  title: string; help: string; rows: MapRows; setRows: (r: MapRows) => void; keyLabel: string; readOnly: boolean;
}) => (
  <Section title={title}>
    <Text style={TYPE.caption}>{help}</Text>
    {rows.map((r, i) => (
      <Row key={i} gap={8} style={{ alignItems: 'flex-start' }}>
        <View style={{ width: 110 }}>
          <Input value={r.key} editable={!readOnly} placeholder={keyLabel}
                 onChangeText={v => setRows(rows.map((x, j) => (j === i ? { ...x, key: v } : x)))} />
        </View>
        <View style={{ flex: 1 }}>
          <Input value={r.values} editable={!readOnly} placeholder="comma-separated specializations"
                 onChangeText={v => setRows(rows.map((x, j) => (j === i ? { ...x, values: v } : x)))} />
        </View>
        {!readOnly && (
          <TouchableOpacity onPress={() => setRows(rows.filter((_, j) => j !== i))} style={{ padding: 12 }} accessibilityLabel={`Remove ${r.key}`}>
            <Trash2 size={18} color={TOKENS.colorError} />
          </TouchableOpacity>
        )}
      </Row>
    ))}
    {!readOnly && <Button title={`Add ${keyLabel}`} type="dashed" size="sm" icon={Plus} onPress={() => setRows([...rows, { key: '', values: '' }])} />}
  </Section>
);

/** Crop → specialization mapping and assignment behaviour (Super Admin edits; Admins can view). */
export const AssignmentRulesScreen = () => {
  const { can } = useAuth();
  const readOnly = !can('settings.assignment');
  const { data, loading, error, reload } = useApi(() => adminApi.setting('assignment'), [], { focus: false });
  const [crops, setCrops] = useState<MapRows>([]);
  const [problems, setProblems] = useState<MapRows>([]);
  const [general, setGeneral] = useState('general');
  const [cap, setCap] = useState('15');
  const [escalate, setEscalate] = useState('24');
  const [owner, setOwner] = useState('ROUND_ROBIN');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    setCrops(toRows(data.cropCategories));
    setProblems(toRows(data.problemCategories));
    setGeneral(data.generalSpecialization);
    setCap(String(data.defaultMaxActiveConsultations));
    setEscalate(String(data.escalateAfterHours));
    setOwner(data.leadOwnerStrategy);
  }, [data]);

  if (loading) return <Loading />;
  if (error) return <ErrorView message={error} onRetry={reload} />;

  const save = async () => {
    setSaving(true);
    try {
      await adminApi.saveSetting('assignment', {
        cropCategories: toMap(crops), problemCategories: toMap(problems), generalSpecialization: general,
        defaultMaxActiveConsultations: Number(cap), escalateAfterHours: Number(escalate), leadOwnerStrategy: owner,
      });
      toast('Assignment rules saved');
      reload();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page keyboard>
      {readOnly && <Alert type="info" message="Only a Super Admin can change assignment rules." />}
      <Section title="How assignment works">
        <Text style={TYPE.secondary}>
          1. Expert whose specializations include the crop{'\n'}2. Expert with a related category for the crop or problem{'\n'}
          3. Expert with the general specialization{'\n'}4. Admin queue (Awaiting assignment){'\n'}
          Within a tier, the expert with the lowest workload is chosen. Inactive, unavailable or full experts are skipped.
        </Text>
      </Section>
      <MappingEditor title="Related categories by crop" keyLabel="crop" rows={crops} setRows={setCrops} readOnly={readOnly}
                     help="Priority 2 matches for each crop, e.g. tomato → vegetables, horticulture" />
      <MappingEditor title="Related categories by problem" keyLabel="problem" rows={problems} setRows={setProblems} readOnly={readOnly}
                     help="Problem types: pest, disease, nutrient, soil, irrigation, weed, growth, other" />
      <Section title="Rules">
        <Field label="General specialization keyword"><Input value={general} onChangeText={setGeneral} editable={!readOnly} /></Field>
        <Row gap={10} style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}><Field label="Default capacity per expert"><Input value={cap} onChangeText={setCap} keyboardType="number-pad" editable={!readOnly} /></Field></View>
          <View style={{ flex: 1 }}><Field label="Escalate after (hours)"><Input value={escalate} onChangeText={setEscalate} keyboardType="number-pad" editable={!readOnly} /></Field></View>
        </Row>
        <Field label="Owner for new consultation leads">
          <Segmented value={owner} onChange={readOnly ? () => {} : setOwner}
                     options={[{ label: 'Round-robin staff', value: 'ROUND_ROBIN' }, { label: 'Shared pool', value: 'UNASSIGNED' }]} />
        </Field>
      </Section>
      {!readOnly && <Button title="Save rules" type="primary" block loading={saving} onPress={save} />}
    </Page>
  );
};
