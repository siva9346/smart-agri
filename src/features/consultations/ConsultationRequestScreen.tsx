import React, { useMemo, useRef, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Camera, ImagePlus, X, Send } from 'lucide-react-native';
import { consultationApi } from '../../services/platform';
import { pickImage } from '../../utils/pickImage';
import { Page, Section, Field, Input, Select, Segmented, Button, Alert, Row, toast } from '../../ui';
import { TOKENS, TYPE } from '../../theme';

const PROBLEMS = [
  { label: 'Disease (spots, rot, wilting)', value: 'disease' },
  { label: 'Pest / insects', value: 'pest' },
  { label: 'Nutrient deficiency (yellowing, poor growth)', value: 'nutrient' },
  { label: 'Soil problem', value: 'soil' },
  { label: 'Irrigation / water', value: 'irrigation' },
  { label: 'Weeds', value: 'weed' },
  { label: 'Growth / yield', value: 'growth' },
  { label: 'Other', value: 'other' },
];
const SEVERITY = [
  { label: 'Low', value: 'LOW' }, { label: 'Medium', value: 'MEDIUM' },
  { label: 'High', value: 'HIGH' }, { label: 'Critical', value: 'CRITICAL' },
];
const CONTACT = [
  { label: 'In app', value: 'IN_APP' }, { label: 'Phone call', value: 'CALL' }, { label: 'WhatsApp', value: 'WHATSAPP' },
];
const MAX_PHOTOS = 5;

type Photo = { uri: string; key?: string; uploading: boolean };

const newKey = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** "Get Suggestions from Experts" — opened from a crop (prefilled) or from the dashboard. */
export const ConsultationRequestScreen = ({ navigation, route }: any) => {
  const p = route.params ?? {};
  // One idempotency key per form instance: a retried submit can't create a second request/lead.
  const idempotencyKey = useRef(newKey()).current;
  const [form, setForm] = useState({
    cropName: p.cropName ?? '', variety: p.variety ?? '', growthStage: '', problemCategory: '', symptoms: p.symptoms ?? '',
    severity: 'MEDIUM', affectedArea: '', farmLocation: p.farmLocation ?? '', soilInfo: '', irrigationInfo: '',
    previousTreatments: '', comments: '', preferredContact: 'IN_APP',
  });
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [more, setMore] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const set = (k: keyof typeof form) => (v: string) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: '' })); };

  const addPhoto = async (source: 'camera' | 'library') => {
    if (photos.length >= MAX_PHOTOS) return toast(`Up to ${MAX_PHOTOS} photos`, 'info');
    const img = await pickImage(source);
    if (!img) return;
    setPhotos(prev => [...prev, { uri: img.uri, uploading: true }]);
    try {
      const res = await consultationApi.uploadPhoto(img.base64, img.mimeType);
      setPhotos(prev => prev.map(ph => ph.uri === img.uri ? { ...ph, key: res.key, uploading: false } : ph));
    } catch (e: any) {
      setPhotos(prev => prev.filter(ph => ph.uri !== img.uri));
      toast(e.message ?? 'Photo upload failed', 'error');
    }
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.cropName.trim()) e.cropName = 'Which crop needs help?';
    if (!form.problemCategory) e.problemCategory = 'Choose the closest problem type';
    if (form.symptoms.trim().length < 10) e.symptoms = 'Describe what you see (at least a few words)';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const uploading = photos.some(ph => ph.uploading);
  const submit = async (saveAsDraft = false) => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const c = await consultationApi.create({
        ...form, idempotencyKey, saveAsDraft, cycleId: p.cycleId, landId: p.landId,
        photoKeys: photos.filter(ph => ph.key).map(ph => ph.key),
      });
      toast(saveAsDraft ? 'Draft saved' : c.expertName ? `Sent — ${c.expertName} will review it` : 'Request sent to our expert team');
      navigation.replace('ConsultationDetail', { id: c.consultationId });
    } catch (e: any) {
      toast(e.message ?? 'Could not send your request', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const severityHelp = useMemo(() => ({
    LOW: 'A few plants affected, not spreading',
    MEDIUM: 'Noticeable damage, spreading slowly',
    HIGH: 'Spreading fast or large area affected',
    CRITICAL: 'Crop loss likely within days',
  } as Record<string, string>)[form.severity], [form.severity]);

  return (
    <Page keyboard>
      <Alert type="info" message="Tell us what's happening. An agricultural expert who specialises in your crop will review it and reply here." />

      <Section title="Crop">
        <Field label="Crop name" required error={errors.cropName}>
          <Input value={form.cropName} onChangeText={set('cropName')} placeholder="e.g. Tomato" error={!!errors.cropName} />
        </Field>
        <Row gap={10}>
          <View style={{ flex: 1 }}><Field label="Variety"><Input value={form.variety} onChangeText={set('variety')} placeholder="Optional" /></Field></View>
          <View style={{ flex: 1 }}><Field label="Growth stage"><Input value={form.growthStage} onChangeText={set('growthStage')} placeholder="e.g. Flowering" /></Field></View>
        </Row>
      </Section>

      <Section title="Problem">
        <Field label="Problem type" required error={errors.problemCategory}>
          <Select value={form.problemCategory} options={PROBLEMS} onChange={set('problemCategory')} placeholder="Choose problem type" error={!!errors.problemCategory} />
        </Field>
        <Field label="What do you see?" required error={errors.symptoms} help="Leaf colour, spots, insects, which part of the plant, since when">
          <Input value={form.symptoms} onChangeText={set('symptoms')} multiline placeholder="e.g. Lower leaves turning yellow with brown rings, started 5 days ago" error={!!errors.symptoms} />
        </Field>
        <Field label="Severity" help={severityHelp}>
          <Segmented value={form.severity} options={SEVERITY} onChange={set('severity')} />
        </Field>
        <Field label="Photos" help={`Clear photos help the expert most (up to ${MAX_PHOTOS})`}>
          <Row gap={8} wrap>
            {photos.map(ph => (
              <View key={ph.uri} style={styles.thumbWrap}>
                <Image source={{ uri: ph.uri }} style={[styles.thumb, ph.uploading && { opacity: 0.4 }]} />
                {!ph.uploading && (
                  <TouchableOpacity style={styles.thumbX} onPress={() => setPhotos(prev => prev.filter(x => x.uri !== ph.uri))}
                                    accessibilityLabel="Remove photo">
                    <X size={12} color="#FFF" />
                  </TouchableOpacity>
                )}
              </View>
            ))}
            {photos.length < MAX_PHOTOS && (
              <>
                <TouchableOpacity style={styles.addPhoto} onPress={() => addPhoto('camera')} accessibilityLabel="Take photo">
                  <Camera size={20} color={TOKENS.colorPrimary} /><Text style={styles.addText}>Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.addPhoto} onPress={() => addPhoto('library')} accessibilityLabel="Choose photo">
                  <ImagePlus size={20} color={TOKENS.colorPrimary} /><Text style={styles.addText}>Gallery</Text>
                </TouchableOpacity>
              </>
            )}
          </Row>
        </Field>
      </Section>

      <Section title="More details" extra={<Button title={more ? 'Hide' : 'Add'} type="text" size="sm" onPress={() => setMore(m => !m)} />}>
        {!more ? <Text style={TYPE.secondary}>Optional: affected area, location, soil, irrigation, treatments already tried.</Text> : (
          <>
            <Row gap={10}>
              <View style={{ flex: 1 }}><Field label="Affected area"><Input value={form.affectedArea} onChangeText={set('affectedArea')} placeholder="e.g. 0.5 acre" /></Field></View>
              <View style={{ flex: 1 }}><Field label="Farm location"><Input value={form.farmLocation} onChangeText={set('farmLocation')} placeholder="Village" /></Field></View>
            </Row>
            <Field label="Soil"><Input value={form.soilInfo} onChangeText={set('soilInfo')} placeholder="e.g. Red soil, last tested 2025" /></Field>
            <Field label="Irrigation"><Input value={form.irrigationInfo} onChangeText={set('irrigationInfo')} placeholder="e.g. Drip, every 2 days" /></Field>
            <Field label="Treatments already tried"><Input value={form.previousTreatments} onChangeText={set('previousTreatments')} multiline placeholder="Product, dose, date" /></Field>
            <Field label="Anything else"><Input value={form.comments} onChangeText={set('comments')} multiline /></Field>
          </>
        )}
        <Field label="How should the expert contact you?">
          <Segmented value={form.preferredContact} options={CONTACT} onChange={set('preferredContact')} />
        </Field>
      </Section>

      <Button title={uploading ? 'Uploading photos…' : 'Send to expert'} type="primary" icon={Send} block
              loading={submitting} disabled={uploading} onPress={() => submit(false)} />
      <Button title="Save as draft" type="text" block disabled={submitting || uploading} onPress={() => submit(true)} />
    </Page>
  );
};

const styles = StyleSheet.create({
  thumbWrap: { width: 72, height: 72 },
  thumb: { width: 72, height: 72, borderRadius: 8, backgroundColor: TOKENS.colorSplit },
  thumbX: { position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center' },
  addPhoto: { width: 72, height: 72, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: TOKENS.colorPrimaryBorder, alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: TOKENS.colorPrimaryBg },
  addText: { fontSize: 11, color: TOKENS.colorPrimary, fontWeight: '600' },
});
