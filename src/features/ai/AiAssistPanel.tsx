import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { aiApi, AiResult, AiStatus } from '../../services/platform';
import { Section, Button, Row, Alert, Tag, toast } from '../../ui';
import { TOKENS, TYPE } from '../../theme';

let cached: { at: number; status: AiStatus } | null = null;

/** AI availability for the current user; short cache so the global switch takes effect quickly. */
export function useAiStatus() {
  const [status, setStatus] = useState<AiStatus | null>(cached?.status ?? null);
  useEffect(() => {
    if (cached && Date.now() - cached.at < 30_000) return;
    aiApi.status().then(s => { cached = { at: Date.now(), status: s }; setStatus(s); }).catch(() => {});
  }, []);
  return status;
}

export const resetAiStatusCache = () => { cached = null; };

/**
 * Inline AI helper: a row of mode buttons; the result is shown for review and
 * can be copied into a form via `onUse`. Nothing is saved or sent automatically.
 * Renders nothing when the feature is unavailable to this user.
 */
export const AiAssistPanel = ({ feature, modes, context, onUse, useLabel = 'Use this draft', title = 'AI assistant' }: {
  feature: string;
  modes: { label: string; mode?: string; prompt?: string }[];
  context: { leadId?: string; consultationId?: string };
  onUse?: (text: string, result: AiResult) => void;
  useLabel?: string;
  title?: string;
}) => {
  const status = useAiStatus();
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<AiResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const f = status?.features?.[feature];
  if (!f) return null;
  if (!f.available) {
    return status?.enabled ? null : (
      <Section title={title}><Text style={TYPE.secondary}>{f.reason}</Text></Section>
    );
  }

  const run = async (m: { label: string; mode?: string; prompt?: string }) => {
    setBusy(m.label);
    setError(null);
    try {
      setResult(await aiApi.assist({ feature, mode: m.mode, prompt: m.prompt, ...context }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Section title={title} extra={<Sparkles size={16} color={TOKENS.colorInfo} />}>
      <Row gap={8} wrap>
        {modes.map(m => (
          <Button key={m.label} title={m.label} size="sm" type="dashed" loading={busy === m.label} disabled={!!busy} onPress={() => run(m)} />
        ))}
      </Row>
      {!!error && <Alert type="error" message={error} />}
      {result && (
        <View style={styles.result}>
          <Text style={[TYPE.body, { lineHeight: 22 }]} selectable>{result.text}</Text>
          <Row gap={6} wrap style={{ marginTop: 8 }}>
            <Tag text={`AI · ${result.provider}`} color="blue" small />
            {result.fallbackUsed && <Tag text="fallback provider" color="gold" small />}
          </Row>
          {!!result.disclaimer && <Text style={[TYPE.caption, { marginTop: 6 }]}>{result.disclaimer}</Text>}
          {onUse && (
            <Button title={useLabel} size="sm" type="primary" style={{ marginTop: 10, alignSelf: 'flex-start' }}
                    onPress={() => { onUse(result.text, result); toast('Added — review and edit before sending', 'info'); }} />
          )}
        </View>
      )}
    </Section>
  );
};

const styles = StyleSheet.create({
  result: { backgroundColor: '#F5F9FF', borderRadius: TOKENS.radius, borderWidth: 1, borderColor: '#D6E4FF', padding: 12 },
});
