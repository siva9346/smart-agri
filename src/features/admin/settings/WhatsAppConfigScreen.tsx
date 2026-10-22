import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { MessageCircle, Send } from 'lucide-react-native';
import { whatsappApi } from '../../../services/platform';
import { useApi } from '../../../hooks/useApi';
import { API_BASE_URL } from '../../../config';
import { Page, Section, Field, Input, SwitchRow, Button, Row, Tag, Alert, KeyValue, Loading, ErrorView, toast } from '../../../ui';
import { TOKENS, TYPE } from '../../../theme';

const KINDS: { kind: string; label: string; params: string }[] = [
  { kind: 'QUOTATION', label: 'Quotation', params: '{{1}} customer name, {{2}} quotation no., {{3}} products, {{4}} total, {{5}} valid until' },
  { kind: 'FOLLOW_UP', label: 'Follow-up', params: '{{1}} customer name, {{2}} requirement' },
  { kind: 'GREETING', label: 'Greeting', params: '{{1}} customer name, {{2}} staff name' },
  { kind: 'CONSULTATION_SUMMARY', label: 'Consultation summary', params: '{{1}} customer name, {{2}} crop, {{3}} recommendation' },
];

/**
 * Super Admin: connect the WhatsApp Business Platform (Meta Cloud API).
 * Secrets go to AWS SSM (SecureString) and are only ever shown as ••••last4.
 */
export const WhatsAppConfigScreen = () => {
  const { data, setData, loading, error, reload } = useApi(() => whatsappApi.config(), [], { focus: false });
  const [form, setForm] = useState<any>({});
  const [secrets, setSecrets] = useState({ accessToken: '', appSecret: '' });
  const [templates, setTemplates] = useState<Record<string, { name: string; language: string }>>({});
  const [verifyToken, setVerifyToken] = useState<string | null>(null);
  const [testTo, setTestTo] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<any>(null);

  useEffect(() => {
    if (!data) return;
    setForm({ phoneNumberId: data.phoneNumberId, businessAccountId: data.businessAccountId, apiVersion: data.apiVersion,
              optOutKeywords: (data.optOutKeywords ?? []).join(', '), optInKeywords: (data.optInKeywords ?? []).join(', ') });
    setTemplates(data.templates ?? {});
  }, [data]);

  if (loading) return <Loading />;
  if (error || !data) return <ErrorView message={error ?? 'Failed'} onRetry={reload} />;

  const save = async (extra: object = {}, label = 'save') => {
    setBusy(label);
    try {
      const body: any = {
        phoneNumberId: form.phoneNumberId, businessAccountId: form.businessAccountId, apiVersion: form.apiVersion,
        templates, optOutKeywords: String(form.optOutKeywords || '').split(','), optInKeywords: String(form.optInKeywords || '').split(','),
        ...extra,
      };
      if (secrets.accessToken) body.accessToken = secrets.accessToken;
      if (secrets.appSecret) body.appSecret = secrets.appSecret;
      const cfg = await whatsappApi.saveConfig(body);
      if (cfg.verifyToken) setVerifyToken(cfg.verifyToken);
      setData(cfg);
      setSecrets({ accessToken: '', appSecret: '' });
      toast('Saved');
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const test = async () => {
    setBusy('test');
    try {
      setTestResult(await whatsappApi.test(testTo));
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const webhookUrl = `${API_BASE_URL}/whatsapp/webhook`;
  return (
    <Page keyboard>
      <Section>
        <Row gap={10}>
          <MessageCircle size={22} color="#25A244" />
          <Text style={[TYPE.h2, { flex: 1 }]}>WhatsApp Business</Text>
          <Tag text={data.ready ? 'Connected' : data.enabled ? 'Incomplete' : 'Off'} color={data.ready ? 'green' : data.enabled ? 'gold' : 'default'} />
        </Row>
        <Text style={TYPE.secondary}>
          When connected, staff can send messages and quotations directly from the CRM, delivery and read receipts are tracked,
          customer replies appear on their lead, and STOP / START keywords update consent. Without it, the app opens WhatsApp
          click-to-chat instead (not tracked).
        </Text>
        <SwitchRow label="Use WhatsApp Business API" value={!!data.enabled} disabled={!!busy}
                   onChange={v => save({ enabled: v }, 'toggle')} />
      </Section>

      <Section title="1. Meta app & number">
        <Field label="Phone number ID" help="Meta Business → WhatsApp → API setup">
          <Input value={form.phoneNumberId ?? ''} onChangeText={v => setForm((f: any) => ({ ...f, phoneNumberId: v.trim() }))} autoCapitalize="none" />
        </Field>
        <Field label="WhatsApp Business Account ID (optional)">
          <Input value={form.businessAccountId ?? ''} onChangeText={v => setForm((f: any) => ({ ...f, businessAccountId: v.trim() }))} autoCapitalize="none" />
        </Field>
        <Field label="Graph API version"><Input value={form.apiVersion ?? ''} onChangeText={v => setForm((f: any) => ({ ...f, apiVersion: v.trim() }))} autoCapitalize="none" /></Field>
        <Field label="Permanent access token" help={data.secrets.accessToken.configured ? `Saved ${data.secrets.accessToken.hint} — leave empty to keep` : 'System-user token with whatsapp_business_messaging'}>
          <Input value={secrets.accessToken} onChangeText={v => setSecrets(s => ({ ...s, accessToken: v }))} secureTextEntry autoCapitalize="none"
                 placeholder={data.secrets.accessToken.hint || 'EAAG…'} />
        </Field>
        <Field label="App secret" help={data.secrets.appSecret.configured ? `Saved ${data.secrets.appSecret.hint} — used to verify webhook signatures` : 'Required for the webhook (App settings → Basic)'}>
          <Input value={secrets.appSecret} onChangeText={v => setSecrets(s => ({ ...s, appSecret: v }))} secureTextEntry autoCapitalize="none"
                 placeholder={data.secrets.appSecret.hint || ''} />
        </Field>
      </Section>

      <Section title="2. Webhook (delivery receipts & replies)">
        <KeyValue label="Callback URL" value={<Text style={TYPE.body} selectable>{webhookUrl}</Text>} />
        <KeyValue label="Verify token" value={verifyToken
          ? <Text style={[TYPE.body, { color: TOKENS.colorSuccess }]} selectable>{verifyToken}</Text>
          : data.secrets.verifyToken.configured ? `${data.secrets.verifyToken.hint} (saved)` : 'Not generated'} />
        {verifyToken && <Alert type="warning" message="Copy this verify token into Meta now — it won't be shown again." />}
        <Button title={data.secrets.verifyToken.configured ? 'Regenerate verify token' : 'Generate verify token'} size="sm"
                loading={busy === 'verify'} onPress={() => save({ generateVerifyToken: true }, 'verify')} />
        <Text style={TYPE.caption}>In Meta, subscribe the webhook to the "messages" field.</Text>
      </Section>

      <Section title="3. Approved templates">
        <Text style={TYPE.caption}>Outside the 24-hour reply window WhatsApp only delivers approved templates. Leave a name empty to send plain text (works only inside the window).</Text>
        {KINDS.map(k => (
          <View key={k.kind} style={{ gap: 6 }}>
            <Text style={TYPE.h3}>{k.label}</Text>
            <Row gap={8} style={{ alignItems: 'flex-start' }}>
              <View style={{ flex: 2 }}>
                <Input value={templates[k.kind]?.name ?? ''} placeholder="template name"
                       onChangeText={v => setTemplates(t => ({ ...t, [k.kind]: { name: v.trim(), language: t[k.kind]?.language ?? 'en' } }))} autoCapitalize="none" />
              </View>
              <View style={{ flex: 1 }}>
                <Input value={templates[k.kind]?.language ?? 'en'} placeholder="en"
                       onChangeText={v => setTemplates(t => ({ ...t, [k.kind]: { name: t[k.kind]?.name ?? '', language: v.trim() } }))} autoCapitalize="none" />
              </View>
            </Row>
            <Text style={TYPE.caption}>Body variables: {k.params}</Text>
          </View>
        ))}
      </Section>

      <Section title="Consent keywords">
        <Field label="Opt-out keywords" help="A reply matching one of these marks the customer as opted out">
          <Input value={form.optOutKeywords ?? ''} onChangeText={v => setForm((f: any) => ({ ...f, optOutKeywords: v }))} autoCapitalize="characters" />
        </Field>
        <Field label="Opt-in keywords"><Input value={form.optInKeywords ?? ''} onChangeText={v => setForm((f: any) => ({ ...f, optInKeywords: v }))} autoCapitalize="characters" /></Field>
      </Section>

      <Button title="Save" type="primary" block loading={busy === 'save'} onPress={() => save()} />

      <Section title="Send a test message">
        <Field label="Phone number" help="Free-form test messages only arrive if this number messaged your business in the last 24 hours">
          <Input value={testTo} onChangeText={setTestTo} keyboardType="phone-pad" />
        </Field>
        <Button title="Send test" icon={Send} loading={busy === 'test'} disabled={!data.ready || !testTo.trim()} onPress={test} />
        {testResult && <Alert type={testResult.ok ? 'success' : 'error'} message={testResult.ok ? `${testResult.note} (id ${testResult.messageId})` : testResult.error} />}
      </Section>
    </Page>
  );
};
