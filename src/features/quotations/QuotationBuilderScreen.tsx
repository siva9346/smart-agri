import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Plus, Trash2, Search, Sparkles, Stethoscope } from 'lucide-react-native';
import { crmApi, quotationApi, productApi, consultationApi, aiApi, QuoteLineInput, AiResult } from '../../services/platform';
import { useApi } from '../../hooks/useApi';
import { useAiStatus } from '../ai/AiAssistPanel';
import { Page, Section, Field, Input, Button, Row, Sheet, Alert, Tag, ListRow, Loading, ErrorView, Divider, formatMoney, toast } from '../../ui';
import { TOKENS, TYPE } from '../../theme';

type CatalogProduct = { productId: string; name: string; price: number; unit: string; stock: number; category: string; isActive: boolean };
type Line = { productId: string; quantity: string; discountPct: string };

async function loadCatalogue(): Promise<CatalogProduct[]> {
  const all: CatalogProduct[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < 10; i++) {
    const res = await productApi.list(cursor);
    all.push(...res.items);
    if (!res.nextCursor) break;
    cursor = res.nextCursor;
  }
  return all.filter(p => p.isActive !== false).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Build or edit a draft quotation. Prices, taxes, discounts and totals shown
 * here come from POST /quotations/preview — the client never computes money.
 */
export const QuotationBuilderScreen = ({ navigation, route }: any) => {
  const { leadId: paramLeadId, quotationId, openPicker } = route.params ?? {};
  const existing = useApi(() => (quotationId ? quotationApi.get(quotationId) : Promise.resolve(null)), [quotationId], { focus: false });
  const leadId: string | undefined = paramLeadId ?? existing.data?.leadId;
  const lead = useApi(() => (leadId ? crmApi.get(leadId) : Promise.resolve(null)), [leadId], { focus: false });
  const catalogue = useApi(loadCatalogue, [], { focus: false });
  const ai = useAiStatus();

  const [lines, setLines] = useState<Line[]>([]);
  const [delivery, setDelivery] = useState('0');
  const [validity, setValidity] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [deliveryTerms, setDeliveryTerms] = useState('');
  const [notes, setNotes] = useState('');
  const [picker, setPicker] = useState(!!openPicker);
  const [q, setQ] = useState('');
  const [preview, setPreview] = useState<any>(null);
  const [previewErr, setPreviewErr] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiResult, setAiResult] = useState<AiResult | null>(null);
  const [recommended, setRecommended] = useState<string[]>([]);
  const seq = useRef(0);

  // Prefill when editing a draft.
  useEffect(() => {
    const qd = existing.data;
    if (!qd) return;
    setLines(qd.items.map(i => ({ productId: i.productId, quantity: String(i.quantity), discountPct: String(i.discountPct ?? 0) })));
    setDelivery(String(qd.deliveryCharge ?? 0));
    setValidity(String(qd.validityDays ?? ''));
    setPaymentTerms(qd.paymentTerms ?? '');
    setDeliveryTerms(qd.deliveryTerms ?? '');
    setNotes(qd.notes ?? '');
  }, [existing.data]);

  // Products the expert recommended on the linked consultation.
  useEffect(() => {
    const cid = lead.data?.consultationId;
    if (!cid) return;
    consultationApi.get(cid).then(c => setRecommended(c.recommendation?.productIds ?? [])).catch(() => {});
  }, [lead.data?.consultationId]);

  const byId = useMemo(() => new Map((catalogue.data ?? []).map(p => [p.productId, p])), [catalogue.data]);
  const validLines: QuoteLineInput[] = lines
    .filter(l => Number(l.quantity) > 0)
    .map(l => ({ productId: l.productId, quantity: Number(l.quantity), discountPct: Number(l.discountPct || 0) }));

  // Debounced server-side pricing.
  useEffect(() => {
    if (!validLines.length) { setPreview(null); setPreviewErr(null); return; }
    const mine = ++seq.current;
    setPreviewing(true);
    const t = setTimeout(async () => {
      try {
        const res = await quotationApi.preview(validLines, Number(delivery || 0));
        if (mine === seq.current) { setPreview(res); setPreviewErr(null); }
      } catch (e: any) {
        if (mine === seq.current) { setPreview(null); setPreviewErr(e.message); }
      } finally {
        if (mine === seq.current) setPreviewing(false);
      }
    }, 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(validLines), delivery]);

  const addProduct = (pid: string, qty = 1) => {
    setLines(prev => prev.some(l => l.productId === pid)
      ? prev
      : [...prev, { productId: pid, quantity: String(qty), discountPct: '0' }]);
  };
  const update = (pid: string, patch: Partial<Line>) => setLines(prev => prev.map(l => (l.productId === pid ? { ...l, ...patch } : l)));

  const askAi = async () => {
    if (!leadId) return;
    setAiBusy(true);
    try {
      setAiResult(await aiApi.assist({ feature: 'QUOTATION_ASSIST', leadId }));
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setAiBusy(false);
    }
  };

  const save = async () => {
    if (!leadId || !validLines.length) return;
    setSaving(true);
    const body = {
      leadId, items: validLines, deliveryCharge: Number(delivery || 0),
      validityDays: validity ? Number(validity) : undefined,
      paymentTerms: paymentTerms || undefined, deliveryTerms: deliveryTerms || undefined, notes,
    };
    try {
      const saved = quotationId ? await quotationApi.update(quotationId, body) : await quotationApi.create(body);
      toast(quotationId ? 'Draft updated' : `Draft ${saved.quotationNumber} created`);
      navigation.replace('QuotationDetail', { id: saved.quotationId });
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (existing.loading || lead.loading) return <Loading />;
  if (lead.error) return <ErrorView message={lead.error} onRetry={lead.reload} />;
  if (!leadId) return <ErrorView message="Open a lead and choose Create Quotation." />;

  const filtered = (catalogue.data ?? []).filter(p => !q || p.name.toLowerCase().includes(q.toLowerCase()) || p.category?.toLowerCase().includes(q.toLowerCase()));
  const lineCalc = (pid: string) => preview?.items?.find((i: any) => i.productId === pid);
  const missingRecommended = recommended.filter(pid => !lines.some(l => l.productId === pid) && byId.has(pid));

  return (
    <>
      <Page keyboard>
        <Section>
          <Text style={TYPE.h3}>{lead.data?.customerName}</Text>
          <Text style={TYPE.secondary} numberOfLines={2}>{lead.data?.requirement}</Text>
        </Section>

        {!!missingRecommended.length && (
          <Alert type="success" title="Expert recommended products"
                 message={missingRecommended.map(pid => byId.get(pid)?.name).join(', ')} />
        )}
        {!!missingRecommended.length && (
          <Button title="Add recommended products" icon={Stethoscope} type="dashed" onPress={() => missingRecommended.forEach(pid => addProduct(pid))} />
        )}

        <Section title="Products" extra={<Button title="Add" size="sm" type="text" icon={Plus} onPress={() => setPicker(true)} />}>
          {!lines.length && <Text style={TYPE.secondary}>Add products from the catalogue. Prices are loaded from the backend.</Text>}
          {lines.map(l => {
            const p = byId.get(l.productId);
            const calc = lineCalc(l.productId);
            return (
              <View key={l.productId} style={styles.line}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text style={[TYPE.h3, { flex: 1 }]} numberOfLines={1}>{p?.name ?? 'Product'}</Text>
                  <TouchableOpacity onPress={() => setLines(prev => prev.filter(x => x.productId !== l.productId))}
                                    accessibilityLabel={`Remove ${p?.name}`} hitSlop={10}>
                    <Trash2 size={18} color={TOKENS.colorError} />
                  </TouchableOpacity>
                </Row>
                <Text style={TYPE.caption}>{formatMoney(p?.price)} / {p?.unit} · {p?.stock ?? 0} in stock</Text>
                <Row gap={10} style={{ alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}><Field label={`Quantity (${p?.unit ?? ''})`}>
                    <Input value={l.quantity} onChangeText={v => update(l.productId, { quantity: v.replace(/[^0-9.]/g, '') })} keyboardType="decimal-pad" />
                  </Field></View>
                  <View style={{ flex: 1 }}><Field label="Discount %">
                    <Input value={l.discountPct} onChangeText={v => update(l.productId, { discountPct: v.replace(/[^0-9.]/g, '') })} keyboardType="decimal-pad" />
                  </Field></View>
                </Row>
                {calc && (
                  <Text style={[TYPE.secondary, { textAlign: 'right' }]}>
                    {formatMoney(calc.subtotal)}{Number(calc.discountAmount) ? ` − ${formatMoney(calc.discountAmount)}` : ''}
                    {Number(calc.taxAmount) ? ` + tax ${formatMoney(calc.taxAmount)} (${calc.taxRatePct}%)` : ''} = <Text style={TYPE.h3}>{formatMoney(calc.lineTotal)}</Text>
                  </Text>
                )}
              </View>
            );
          })}
        </Section>

        {ai?.features?.QUOTATION_ASSIST?.available && (
          <Section title="AI product suggestions" extra={<Sparkles size={16} color={TOKENS.colorInfo} />}>
            <Button title="Suggest products for this lead" type="dashed" size="sm" loading={aiBusy} onPress={askAi} />
            {aiResult && (
              <View style={{ gap: 6 }}>
                {!!aiResult.text && <Text style={TYPE.secondary}>{aiResult.text}</Text>}
                {(aiResult.suggestedProducts ?? []).map(s => (
                  <ListRow key={s.productId} title={s.name} subtitle={s.reason} meta={`${s.quantity} ${s.unit} · ${formatMoney(s.price)} / ${s.unit}`}
                           right={<Button title="Add" size="sm" onPress={() => addProduct(s.productId, s.quantity)} />} />
                ))}
                {!aiResult.suggestedProducts?.length && <Text style={TYPE.caption}>No catalogue products matched.</Text>}
                {!!aiResult.droppedSuggestions && <Text style={TYPE.caption}>{aiResult.droppedSuggestions} suggestion(s) ignored — not in the catalogue.</Text>}
                <Text style={TYPE.caption}>Suggestions only use the existing catalogue; prices come from the catalogue, not the AI.</Text>
              </View>
            )}
          </Section>
        )}

        <Section title="Charges & terms">
          <Row gap={10} style={{ alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}><Field label="Delivery charge (₹)"><Input value={delivery} onChangeText={v => setDelivery(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" /></Field></View>
            <View style={{ flex: 1 }}><Field label="Valid for (days)" help="Default from settings"><Input value={validity} onChangeText={v => setValidity(v.replace(/\D/g, ''))} keyboardType="number-pad" /></Field></View>
          </Row>
          <Field label="Payment terms" help="Leave empty for the standard terms"><Input value={paymentTerms} onChangeText={setPaymentTerms} multiline /></Field>
          <Field label="Delivery terms"><Input value={deliveryTerms} onChangeText={setDeliveryTerms} multiline /></Field>
          <Field label="Notes for the customer"><Input value={notes} onChangeText={setNotes} multiline /></Field>
        </Section>

        <Section title="Totals" extra={previewing ? <ActivityIndicator size="small" color={TOKENS.colorPrimary} /> : undefined}>
          {previewErr && <Alert type="error" message={previewErr} />}
          {!preview && !previewErr && <Text style={TYPE.secondary}>Add products to see the calculated totals.</Text>}
          {preview && (
            <>
              <Total label="Subtotal" value={preview.subtotal} />
              <Total label="Discount" value={-preview.discountTotal} />
              <Total label="Tax" value={preview.taxTotal} />
              <Total label="Delivery" value={preview.deliveryCharge} />
              <Divider />
              <Total label="Grand total" value={preview.grandTotal} strong />
              {preview.requiresApproval && <Tag text="Will need approval before sharing" color="gold" />}
              {(preview.warnings ?? []).map((w: string) => <Alert key={w} type="warning" message={w} />)}
            </>
          )}
        </Section>

        <Button title={quotationId ? 'Save draft' : 'Create draft quotation'} type="primary" block loading={saving}
                disabled={!validLines.length || !!previewErr || previewing} onPress={save} />
      </Page>

      <Sheet visible={picker} onClose={() => setPicker(false)} title="Add products">
        <View style={{ gap: 8 }}>
          <View style={{ justifyContent: 'center' }}>
            <Input value={q} onChangeText={setQ} placeholder="Search catalogue" style={{ paddingLeft: 36 }} />
            <View style={{ position: 'absolute', left: 12 }} pointerEvents="none"><Search size={16} color={TOKENS.colorTextTertiary} /></View>
          </View>
          {catalogue.loading && <ActivityIndicator color={TOKENS.colorPrimary} />}
          {catalogue.error && <Alert type="error" message={catalogue.error} />}
          {filtered.slice(0, 80).map(p => {
            const added = lines.some(l => l.productId === p.productId);
            return (
              <ListRow key={p.productId} title={p.name} subtitle={`${formatMoney(p.price)} / ${p.unit}`}
                       meta={`${p.category || 'Uncategorised'} · ${p.stock} in stock`}
                       right={<Button title={added ? 'Added' : 'Add'} size="sm" type={added ? 'default' : 'primary'} disabled={added}
                                      onPress={() => addProduct(p.productId)} />} />
            );
          })}
          {!catalogue.loading && !filtered.length && <Text style={TYPE.secondary}>No products match.</Text>}
        </View>
      </Sheet>
    </>
  );
};

const Total = ({ label, value, strong }: { label: string; value: number; strong?: boolean }) => (
  <Row style={{ justifyContent: 'space-between' }}>
    <Text style={strong ? TYPE.h2 : TYPE.body}>{label}</Text>
    <Text style={strong ? [TYPE.h2, { color: TOKENS.colorPrimary }] : TYPE.body}>
      {Number(value) < 0 ? `− ${formatMoney(Math.abs(Number(value)))}` : formatMoney(value)}
    </Text>
  </Row>
);

const styles = StyleSheet.create({
  line: { gap: 6, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: TOKENS.colorSplit },
});
