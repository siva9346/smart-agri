import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { Sparkles, PlugZap, KeyRound } from 'lucide-react-native';
import { aiApi } from '../../../services/platform';
import { useApi } from '../../../hooks/useApi';
import { resetAiStatusCache } from '../../ai/AiAssistPanel';
import {
  Page, Section, Field, Input, Select, Segmented, SwitchRow, Button, Row, Tag, Alert, KeyValue, ConfirmDialog, Loading,
  ErrorView, StatGrid, Stat, formatDate, toast,
} from '../../../ui';
import { TOKENS, TYPE } from '../../../theme';

const PROVIDERS = [
  { id: 'openai', name: 'OpenAI', placeholder: 'sk-…' },
  { id: 'gemini', name: 'Google Gemini', placeholder: 'AIza…' },
] as const;

/**
 * Super Admin AI configuration. Keys are sent once to the backend, stored in
 * AWS SSM as SecureString and never returned — the UI only ever shows "••••last4".
 * Leaving the key field empty keeps the saved key.
 */
export const AiConfigScreen = () => {
  const { data, setData, loading, error, reload } = useApi(() => aiApi.config(), [], { focus: false });
  const usage = useApi(() => aiApi.usage(), [], { focus: false });
  const [keys, setKeys] = useState<Record<string, string>>({ openai: '', gemini: '' });
  const [models, setModels] = useState<Record<string, string>>({ openai: '', gemini: '' });
  const [busy, setBusy] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, any>>({});
  const [removeKey, setRemoveKey] = useState<string | null>(null);

  useEffect(() => {
    if (data) setModels({ openai: data.providers.openai.model ?? '', gemini: data.providers.gemini.model ?? '' });
  }, [data]);

  if (loading) return <Loading />;
  if (error || !data) return <ErrorView message={error ?? 'Failed'} onRetry={reload} />;

  const save = async (body: object, label: string, done: string) => {
    setBusy(label);
    try {
      const cfg = await aiApi.saveConfig(body);
      setData(cfg);
      resetAiStatusCache();
      toast(done);
      return true;
    } catch (e: any) {
      toast(e.message, 'error');
      return false;
    } finally {
      setBusy(null);
    }
  };

  const saveProvider = async (id: string) => {
    const body: any = { model: models[id] };
    if (keys[id].trim()) body.apiKey = keys[id].trim();
    if (await save({ providers: { [id]: body } }, `save-${id}`, keys[id] ? 'Key saved securely' : 'Saved')) {
      setKeys(k => ({ ...k, [id]: '' }));
    }
  };

  const test = async (id: string) => {
    setBusy(`test-${id}`);
    try {
      const unsaved = keys[id].trim();
      const res = await aiApi.test(id, { apiKey: unsaved || undefined, model: models[id] || undefined });
      setTestResult(t => ({ ...t, [id]: { ...res, unsaved: !!unsaved } }));
      if (!unsaved) reload();
      toast(res.ok ? 'Connection works' : 'Connection failed', res.ok ? 'success' : 'error');
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const configured = PROVIDERS.filter(p => data.providers[p.id].enabled && data.providers[p.id].keyConfigured && data.providers[p.id].model);
  const effective = !data.enabled ? 'All AI features are OFF for every user.'
    : !configured.length ? 'AI is ON, but no provider is enabled and configured — users will see “AI unavailable”.'
    : `AI is ON using ${configured.map(p => p.name).join(' + ')}${configured.length > 1 ? ` (${data.strategy === 'GEMINI_PREFERRED' ? 'Gemini' : 'OpenAI'} preferred${data.fallbackOnError ? ', automatic fallback' : ''})` : ''}.`;
  const today = usage.data?.days?.[0];

  return (
    <>
      <Page keyboard>
        <Section>
          <Row gap={10} style={{ alignItems: 'flex-start' }}>
            <Sparkles size={22} color={TOKENS.colorInfo} />
            <Text style={[TYPE.h2, { flex: 1 }]}>AI Enabled</Text>
            <Tag text={data.enabled ? 'ON' : 'OFF'} color={data.enabled ? 'green' : 'default'} />
          </Row>
          <SwitchRow label="Enable AI across the platform" description="Turning this off stops every AI request on the server immediately"
                     value={!!data.enabled} disabled={!!busy} onChange={v => save({ enabled: v }, 'global', v ? 'AI enabled' : 'AI disabled for everyone')} />
          <Alert type={data.enabled && configured.length ? 'success' : 'warning'} message={effective} />
        </Section>

        {PROVIDERS.map(p => {
          const pc = data.providers[p.id];
          const tr = testResult[p.id];
          const modelOptions = [...new Set([...(tr?.models ?? []), ...(pc.availableModels ?? []), ...(models[p.id] ? [models[p.id]] : [])])]
            .map((m: string) => ({ label: m, value: m }));
          return (
            <Section key={p.id} title={p.name} extra={<Tag text={pc.enabled ? 'Enabled' : 'Disabled'} color={pc.enabled ? 'green' : 'default'} />}>
              <KeyValue label="API key" value={pc.keyConfigured ? <Row gap={6}><KeyRound size={14} color={TOKENS.colorSuccess} /><Text style={TYPE.body}>{pc.keyHint}</Text></Row> : 'Not set'} />
              <KeyValue label="Last test" value={pc.lastTestAt ? `${pc.lastTestOk ? '✓ OK' : '✕ Failed'} · ${formatDate(pc.lastTestAt)}` : 'Never'} />
              <KeyValue label="Last success" value={pc.lastSuccessAt ? formatDate(pc.lastSuccessAt) : undefined} />
              {!!pc.lastTestError && !pc.lastTestOk && !tr && <Alert type="error" message={pc.lastTestError} />}

              <Field label={pc.keyConfigured ? 'Rotate API key' : 'API key'} help={pc.keyConfigured ? 'Leave empty to keep the saved key' : 'Stored encrypted on the server; never shown again'}>
                <Input value={keys[p.id]} onChangeText={v => setKeys(k => ({ ...k, [p.id]: v }))} placeholder={pc.keyConfigured ? pc.keyHint : p.placeholder}
                       secureTextEntry autoCapitalize="none" autoCorrect={false} />
              </Field>
              <Field label="Model" help={modelOptions.length ? 'Models available to this key (from the last test)' : 'Run a connection test to load available models'}>
                {modelOptions.length
                  ? <Select value={models[p.id]} options={modelOptions} onChange={v => setModels(m => ({ ...m, [p.id]: v }))} title="Model" />
                  : <Input value={models[p.id]} onChangeText={v => setModels(m => ({ ...m, [p.id]: v.trim() }))} placeholder="model id" autoCapitalize="none" />}
              </Field>
              {tr && (
                <Alert type={tr.ok ? 'success' : 'error'}
                       message={tr.ok ? `Connected${tr.unsaved ? ' (unsaved key)' : ''}. ${tr.models.length} models available.${tr.generationOk ? ' Test reply received from the selected model.' : ''}`
                                      : tr.error} />
              )}
              <Row gap={8} wrap>
                <Button title="Test connection" icon={PlugZap} size="sm" loading={busy === `test-${p.id}`} disabled={!!busy || (!pc.keyConfigured && !keys[p.id])} onPress={() => test(p.id)} />
                <Button title="Save" type="primary" size="sm" loading={busy === `save-${p.id}`} disabled={!!busy} onPress={() => saveProvider(p.id)} />
                {pc.keyConfigured && <Button title="Remove key" type="danger" size="sm" disabled={!!busy} onPress={() => setRemoveKey(p.id)} />}
              </Row>
              <SwitchRow label={`Use ${p.name}`} description={!pc.keyConfigured ? 'Save a key first' : !pc.model ? 'Select and save a model first' : undefined}
                         value={!!pc.enabled} disabled={!!busy || !pc.keyConfigured || !pc.model}
                         onChange={v => save({ providers: { [p.id]: { enabled: v } } }, `toggle-${p.id}`, `${p.name} ${v ? 'enabled' : 'disabled'}`)} />
            </Section>
          );
        })}

        <Section title="Provider selection">
          <Segmented value={data.strategy} onChange={v => save({ strategy: v }, 'strategy', 'Strategy saved')}
                     options={[{ label: 'OpenAI preferred', value: 'OPENAI_PREFERRED' }, { label: 'Gemini preferred', value: 'GEMINI_PREFERRED' }]} />
          <SwitchRow label="Automatic fallback" description="If the preferred provider fails, retry once with the other enabled provider"
                     value={!!data.fallbackOnError} disabled={!!busy} onChange={v => save({ fallbackOnError: v }, 'fallback', 'Saved')} />
          <Field label="Requests per minute per user">
            <Input defaultValue={String(data.requestsPerMinutePerUser)} keyboardType="number-pad"
                   onEndEditing={e => save({ requestsPerMinutePerUser: Number(e.nativeEvent.text) }, 'rpm', 'Rate limit saved')} />
          </Field>
        </Section>

        <Section title="Feature controls">
          <Text style={TYPE.caption}>A feature works only when AI is enabled, the feature is on, a provider is configured, and the user's role is allowed.</Text>
          {Object.entries(data.featureCatalog as Record<string, string>).map(([f, label]) => (
            <SwitchRow key={f} label={label} value={!!data.features[f]} disabled={!!busy}
                       onChange={v => save({ features: { [f]: v } }, f, `${label} ${v ? 'on' : 'off'}`)} />
          ))}
        </Section>

        <Section title="Usage">
          {usage.loading ? <Text style={TYPE.secondary}>Loading…</Text> : (
            <StatGrid>
              <Stat label="Requests today" value={today?.total ?? 0} />
              <Stat label="Errors / fallbacks today" value={today?.errors ?? 0} tone={(today?.errors ?? 0) ? TOKENS.colorWarning : undefined} />
              <Stat label="Last 7 days" value={(usage.data?.days ?? []).reduce((s: number, d: any) => s + (d.total ?? 0), 0)} />
            </StatGrid>
          )}
        </Section>
        <View style={{ height: 12 }} />
      </Page>

      <ConfirmDialog visible={!!removeKey} title="Remove API key?" danger confirmText="Remove"
                     message="The key is deleted from secure storage and the provider is disabled."
                     onCancel={() => setRemoveKey(null)}
                     onConfirm={() => { const id = removeKey!; setRemoveKey(null); save({ providers: { [id]: { removeKey: true } } }, `remove-${id}`, 'Key removed'); }} />
    </>
  );
};
