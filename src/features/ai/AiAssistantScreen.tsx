import React, { useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Send, ImagePlus, X, Sparkles, Stethoscope } from 'lucide-react-native';
import { aiApi, AiStatus } from '../../services/platform';
import { useAuth } from '../../hooks/useApi';
import { pickImage, PickedImage } from '../../utils/pickImage';
import { Loading, ErrorView, Segmented, Button, Input, Tag, Empty, Alert } from '../../ui';
import { TOKENS, TYPE } from '../../theme';

type Msg = { id: string; role: 'user' | 'ai' | 'error'; text: string; image?: string; meta?: string; disclaimer?: string | null };

// General-purpose features usable from a free-form chat (record-specific ones live on their screens).
const CHAT_FEATURES = ['CUSTOMER_ASSISTANT', 'CROP_PROBLEM', 'FOLLOWUP_SUGGEST', 'CRM_REPORT', 'STAFF_INSIGHTS'];
const IMAGE_FEATURES = ['CUSTOMER_ASSISTANT', 'CROP_PROBLEM'];
const STARTERS: Record<string, string[]> = {
  CUSTOMER_ASSISTANT: ['When should I irrigate paddy in the tillering stage?', 'How do I improve red soil fertility?'],
  CROP_PROBLEM: ['My tomato leaves are curling and yellow at the edges', 'White powder on chilli leaves'],
  FOLLOWUP_SUGGEST: ['Which follow-ups should I prioritise today?'],
  CRM_REPORT: ['Summarise CRM performance and suggest improvements'],
  STAFF_INSIGHTS: ['Who on the team is overloaded?'],
};

export const AiAssistantScreen = ({ navigation }: any) => {
  const { isCustomer } = useAuth();
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [feature, setFeature] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [image, setImage] = useState<PickedImage | null>(null);
  const [busy, setBusy] = useState(false);
  const listRef = useRef<FlatList>(null);

  const load = () => aiApi.status().then(s => {
    setStatus(s);
    const first = CHAT_FEATURES.find(f => s.features[f]?.available);
    if (first) setFeature(first);
  }).catch(e => setLoadErr(e.message));
  useEffect(() => { load(); }, []);

  if (loadErr) return <ErrorView message={loadErr} onRetry={() => { setLoadErr(null); load(); }} />;
  if (!status) return <Loading />;

  const options = CHAT_FEATURES.filter(f => status.features[f]).map(f => ({ label: status.features[f].label, value: f }));
  const current = status.features[feature];
  if (!status.anyAvailable || !options.some(o => status.features[o.value].available)) {
    return (
      <View style={styles.root}>
        <Empty title="AI assistant unavailable"
               description={status.message ?? Object.values(status.features)[0]?.reason ?? 'AI features are not enabled for your account.'}
               action={isCustomer ? <Button title="Ask a human expert instead" type="primary" icon={Stethoscope}
                                            onPress={() => navigation.navigate('ConsultationRequest')} /> : undefined} />
      </View>
    );
  }

  const send = async (prompt = text) => {
    if (!prompt.trim() && !image) return;
    const userMsg: Msg = { id: `${Date.now()}u`, role: 'user', text: prompt.trim() || '(photo)', image: image?.uri };
    setMsgs(m => [...m, userMsg]);
    setText('');
    const img = image;
    setImage(null);
    setBusy(true);
    try {
      const res = await aiApi.assist({ feature, prompt: prompt.trim() || undefined,
                                       imageBase64: img?.base64, imageType: img?.mimeType });
      setMsgs(m => [...m, { id: `${Date.now()}a`, role: 'ai', text: res.text, meta: `${res.provider}${res.fallbackUsed ? ' (fallback)' : ''}`,
                            disclaimer: res.disclaimer }]);
    } catch (e: any) {
      setMsgs(m => [...m, { id: `${Date.now()}e`, role: 'error', text: e.message }]);
    } finally {
      setBusy(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      {options.length > 1 && (
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <Segmented value={feature} options={options} onChange={f => { setFeature(f); setMsgs([]); }} />
        </View>
      )}
      <FlatList
        ref={listRef}
        data={msgs}
        keyExtractor={m => m.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={(
          <View style={{ gap: 10 }}>
            {current && !current.available && <Alert type="warning" message={current.reason ?? 'Unavailable'} />}
            {isCustomer && (
              <Alert type="info" message="AI answers are general guidance and can be wrong. For serious or spreading problems, ask a Smart Agri expert." />
            )}
            {!msgs.length && (
              <View style={{ gap: 8 }}>
                <Text style={TYPE.label}>Try asking</Text>
                {(STARTERS[feature] ?? []).map(s => (
                  <TouchableOpacity key={s} style={styles.starter} onPress={() => send(s)} disabled={busy}>
                    <Sparkles size={14} color={TOKENS.colorInfo} />
                    <Text style={[TYPE.body, { flex: 1 }]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.role === 'user' ? styles.user : item.role === 'error' ? styles.error : styles.ai]}>
            {item.image && <Image source={{ uri: item.image }} style={styles.img} />}
            <Text style={[TYPE.body, { lineHeight: 22 }]} selectable>{item.text}</Text>
            {item.meta && <Tag text={`AI · ${item.meta}`} color="blue" small />}
            {!!item.disclaimer && <Text style={TYPE.caption}>{item.disclaimer}</Text>}
          </View>
        )}
        ListFooterComponent={busy ? <Text style={[TYPE.secondary, { padding: 8 }]}>Thinking…</Text> : null}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
      />
      {isCustomer && msgs.some(m => m.role === 'ai') && (
        <View style={{ paddingHorizontal: 16 }}>
          <Button title="Get advice from a human expert" type="dashed" icon={Stethoscope} size="sm"
                  onPress={() => navigation.navigate('ConsultationRequest', { symptoms: msgs.find(m => m.role === 'user')?.text })} />
        </View>
      )}
      <View style={styles.composer}>
        {image && (
          <View style={styles.preview}>
            <Image source={{ uri: image.uri }} style={{ width: 48, height: 48, borderRadius: 6 }} />
            <TouchableOpacity onPress={() => setImage(null)} accessibilityLabel="Remove photo"><X size={16} color={TOKENS.colorTextSecondary} /></TouchableOpacity>
          </View>
        )}
        <View style={styles.inputRow}>
          {IMAGE_FEATURES.includes(feature) && (
            <TouchableOpacity onPress={async () => setImage(await pickImage('library'))} style={styles.iconBtn} accessibilityLabel="Attach crop photo">
              <ImagePlus size={20} color={TOKENS.colorPrimary} />
            </TouchableOpacity>
          )}
          <Input value={text} onChangeText={setText} placeholder="Ask a question…" multiline style={{ flex: 1, minHeight: 44, maxHeight: 120 }} />
          <TouchableOpacity onPress={() => send()} disabled={busy || (!text.trim() && !image)} style={[styles.iconBtn, styles.sendBtn,
                            (busy || (!text.trim() && !image)) && { opacity: 0.4 }]} accessibilityLabel="Send">
            <Send size={18} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: TOKENS.colorBgLayout },
  list: { padding: 16, gap: 10, flexGrow: 1 },
  starter: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: '#FFF', borderRadius: TOKENS.radius, borderWidth: 1, borderColor: TOKENS.colorBorder },
  bubble: { borderRadius: 14, padding: 12, gap: 6, maxWidth: '92%' },
  user: { alignSelf: 'flex-end', backgroundColor: TOKENS.colorPrimaryBg },
  ai: { alignSelf: 'flex-start', backgroundColor: '#FFF', borderWidth: 1, borderColor: TOKENS.colorBorder },
  error: { alignSelf: 'flex-start', backgroundColor: '#FFF1F0', borderWidth: 1, borderColor: '#FFA39E' },
  img: { width: 180, height: 140, borderRadius: 8 },
  composer: { padding: 12, borderTopWidth: 1, borderTopColor: TOKENS.colorBorder, backgroundColor: '#FFF', gap: 8 },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: TOKENS.colorPrimaryBg },
  sendBtn: { backgroundColor: TOKENS.colorPrimary },
});
