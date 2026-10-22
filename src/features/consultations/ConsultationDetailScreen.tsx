import React, { useMemo, useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, Modal, StyleSheet, Pressable } from 'react-native';
import { Send, CheckCircle, UserCheck, Stethoscope, PlayCircle, XCircle, ExternalLink } from 'lucide-react-native';
import { consultationApi, productApi, teamApi, Consultation } from '../../services/platform';
import { useApi, useAuth } from '../../hooks/useApi';
import { AiAssistPanel } from '../ai/AiAssistPanel';
import {
  Page, Section, KeyValue, StatusTag, Tag, Button, Row, Input, Field, Sheet, Select, ConfirmDialog, DateTimeField,
  Loading, ErrorView, Alert, Switch, formatDate, formatMoney, humanize, toast,
} from '../../ui';
import { TOKENS, TYPE } from '../../theme';

const CUSTOMER_CANCELLABLE = ['DRAFT', 'SUBMITTED', 'AWAITING_ASSIGNMENT', 'ASSIGNED'];
const RECOMMENDABLE = ['ACCEPTED', 'IN_PROGRESS', 'INFO_REQUIRED', 'RECOMMENDATION_PROVIDED', 'FOLLOW_UP_SCHEDULED'];

export const ConsultationDetailScreen = ({ navigation, route }: any) => {
  const id: string = route.params.id;
  const { user, role, isCustomer, isAdmin, can } = useAuth();
  const { data: c, setData, loading, error, reload, refreshing, refresh } = useApi(() => consultationApi.get(id), [id]);
  const [msg, setMsg] = useState('');
  const [askInfo, setAskInfo] = useState(false);
  const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [recOpen, setRecOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [confirm, setConfirm] = useState<{ status: string; title: string; message: string; danger?: boolean } | null>(null);

  const isAssignedExpert = role === 'EXPERT' && c?.expertId === user?.userId;
  const actorCanAct = isAssignedExpert || isAdmin;

  const act = async (label: string, fn: () => Promise<Consultation>, done?: string) => {
    setBusy(label);
    try {
      setData(await fn());
      if (done) toast(done);
    } catch (e: any) {
      toast(e.message, 'error');
      reload();
    } finally {
      setBusy(null);
    }
  };
  const setStatus = (status: string, note?: string) =>
    act(status, () => consultationApi.setStatus(id, status, note), `Marked ${humanize(status).toLowerCase()}`);

  const sendMessage = async () => {
    if (!msg.trim()) return;
    await act('message', () => consultationApi.message(id, msg.trim(), { requestInfo: askInfo, internal }));
    setMsg('');
    setAskInfo(false);
  };

  if (loading) return <Loading />;
  if (error || !c) return <ErrorView message={error ?? 'Not found'} onRetry={reload} />;

  const open = !['CLOSED', 'CANCELLED', 'DRAFT'].includes(c.status);
  const messages = c.messages ?? [];

  return (
    <>
      <Page refreshing={refreshing} onRefresh={refresh} keyboard>
        <Section>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={[TYPE.h2, { flex: 1 }]}>{c.cropName}{c.variety ? ` · ${c.variety}` : ''}</Text>
            <StatusTag status={c.status} />
          </Row>
          <Row gap={6} wrap>
            <Tag text={humanize(c.problemCategory)} color="green" />
            <Tag text={`${humanize(c.severity)} severity`} color={c.severity === 'CRITICAL' || c.severity === 'HIGH' ? 'red' : 'default'} />
            {c.growthStage ? <Tag text={c.growthStage} /> : null}
          </Row>
          <Text style={TYPE.caption}>Requested {formatDate(c.createdAt)} · updated {formatDate(c.updatedAt)}</Text>
          {c.status === 'INFO_REQUIRED' && isCustomer && (
            <Alert type="warning" title="The expert needs more information" message="Reply below — add details or describe new photos." />
          )}
          {c.status === 'AWAITING_ASSIGNMENT' && (
            <Alert type="info" message={isCustomer ? 'We are finding the right expert for your crop. You will be notified once assigned.'
                                                   : 'No eligible expert was found automatically. Assign one manually.'} />
          )}
        </Section>

        {/* Who */}
        {isCustomer ? (
          c.expertName ? (
            <Section title="Your expert">
              <KeyValue label="Name" value={c.expertName} />
              <KeyValue label="Qualifications" value={c.expert?.qualifications} />
              <KeyValue label="Experience" value={c.expert?.experienceYears ? `${c.expert.experienceYears} years` : undefined} />
              <KeyValue label="Specialises in" value={c.expert?.specializations?.join(', ')} />
            </Section>
          ) : null
        ) : (
          <Section title="Customer" extra={c.leadId && can('crm.view') ? (
            <Button title="Open lead" size="sm" type="text" icon={ExternalLink} onPress={() => navigation.navigate('LeadDetail', { id: c.leadId })} />
          ) : undefined}>
            <KeyValue label="Name" value={c.customer?.name ?? c.customerName} />
            <KeyValue label="Location" value={c.farmLocation || [c.customer?.village, c.customer?.district].filter(Boolean).join(', ')} />
            <KeyValue label="Prefers" value={humanize(c.preferredContact)} />
            <KeyValue label="Expert" value={c.expertName ?? 'Not assigned'} />
            {c.assignmentTier ? <KeyValue label="Matched by" value={humanize(c.assignmentTier)} /> : null}
          </Section>
        )}

        <Section title="Problem">
          <Text style={TYPE.body}>{c.symptoms}</Text>
          <KeyValue label="Affected area" value={c.affectedArea} />
          <KeyValue label="Soil" value={c.soilInfo} />
          <KeyValue label="Irrigation" value={c.irrigationInfo} />
          <KeyValue label="Tried already" value={c.previousTreatments} />
          <KeyValue label="Comments" value={c.comments} />
          {!!c.photoUrls?.length && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {c.photoUrls.map(u => (
                <TouchableOpacity key={u} onPress={() => setPhoto(u)} accessibilityLabel="Enlarge photo">
                  <Image source={{ uri: u }} style={styles.photo} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </Section>

        {c.recommendation && (
          <Section title="Expert recommendation">
            <Text style={[TYPE.body, { lineHeight: 22 }]} selectable>{c.recommendation.text}</Text>
            <Text style={TYPE.caption}>{c.recommendation.byName} · {formatDate(c.recommendation.at)}</Text>
            {!!c.followUpAt && <KeyValue label="Follow-up" value={formatDate(c.followUpAt)} />}
            {!!c.recommendedProducts?.length && (
              <View style={{ gap: 6 }}>
                <Text style={TYPE.label}>Recommended products</Text>
                {c.recommendedProducts.map(p => (
                  <TouchableOpacity key={p.productId} style={styles.product} disabled={!isCustomer}
                                    onPress={() => navigation.navigate('ProductDetails', { productId: p.productId })}>
                    <Text style={[TYPE.body, { flex: 1 }]}>{p.name}</Text>
                    <Text style={TYPE.secondary}>{formatMoney(p.price)} / {p.unit}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </Section>
        )}

        {isCustomer && c.recommendation && (
          <AiAssistPanel feature="CROP_PROBLEM" title="Need it explained?" context={{ consultationId: id }}
                         modes={[{ label: 'Explain in simple words', prompt: "Explain my expert's recommendation in simple steps I can follow, and what to watch for." }]} />
        )}
        {actorCanAct && open && (
          <AiAssistPanel feature="EXPERT_ASSIST" context={{ consultationId: id }}
                         modes={[{ label: 'Summarise', mode: 'summary' }, { label: 'Questions to ask', mode: 'questions' },
                                 { label: 'Customer history', mode: 'history_summary' }]} />
        )}

        {/* Thread */}
        <Section title="Conversation">
          {!messages.length && <Text style={TYPE.secondary}>No messages yet.</Text>}
          {messages.map((m, i) => {
            const mine = m.by === user?.userId;
            return (
              <View key={i} style={[styles.bubble, mine ? styles.mine : styles.theirs, m.internal && styles.internal]}>
                <Text style={TYPE.caption}>{m.byName} · {humanize(m.role)}{m.internal ? ' · internal note' : ''}</Text>
                <Text style={TYPE.body}>{m.text}</Text>
                <Text style={[TYPE.caption, { alignSelf: 'flex-end' }]}>{formatDate(m.at)}</Text>
              </View>
            );
          })}
          {open && (isCustomer || actorCanAct || role === 'STAFF') && (
            <View style={{ gap: 8 }}>
              <Input value={msg} onChangeText={setMsg} multiline placeholder={isCustomer ? 'Reply to the expert…' : 'Write a message…'} style={{ minHeight: 70 }} />
              {actorCanAct && (
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text style={TYPE.secondary}>Request more information</Text>
                  <Switch value={askInfo} onChange={v => { setAskInfo(v); if (v) setInternal(false); }} label="Request more information" />
                </Row>
              )}
              {!isCustomer && (
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text style={TYPE.secondary}>Internal note (hidden from customer)</Text>
                  <Switch value={internal} onChange={v => { setInternal(v); if (v) setAskInfo(false); }} label="Internal note" />
                </Row>
              )}
              <Button title="Send" type="primary" icon={Send} loading={busy === 'message'} disabled={!msg.trim()} onPress={sendMessage} />
            </View>
          )}
        </Section>

        {/* Actions */}
        <Section title="Actions">
          {isCustomer && (
            <>
              {c.status === 'DRAFT' && <Button title="Submit to expert" type="primary" icon={Send} loading={busy === 'submit'}
                                               onPress={() => act('submit', () => consultationApi.submitDraft(id), 'Request sent')} />}
              {['RECOMMENDATION_PROVIDED', 'FOLLOW_UP_SCHEDULED'].includes(c.status) && (
                <Button title="This solved my problem" type="primary" icon={CheckCircle} loading={busy === 'RESOLVED'} onPress={() => setStatus('RESOLVED')} />
              )}
              {c.status === 'RECOMMENDATION_PROVIDED' && (
                <Button title="I still need help" onPress={() => setStatus('IN_PROGRESS', 'Customer still needs help')} loading={busy === 'IN_PROGRESS'} />
              )}
              {c.status === 'RESOLVED' && <Button title="Close request" onPress={() => setStatus('CLOSED')} loading={busy === 'CLOSED'} />}
              {CUSTOMER_CANCELLABLE.includes(c.status) && (
                <Button title="Cancel request" type="danger" icon={XCircle}
                        onPress={() => setConfirm({ status: 'CANCELLED', title: 'Cancel this request?', message: 'The expert will stop working on it.', danger: true })} />
              )}
            </>
          )}
          {actorCanAct && (
            <>
              {c.status === 'ASSIGNED' && <Button title="Accept consultation" type="primary" icon={UserCheck} loading={busy === 'ACCEPTED'} onPress={() => setStatus('ACCEPTED')} />}
              {c.status === 'ACCEPTED' && <Button title="Start working" icon={PlayCircle} loading={busy === 'IN_PROGRESS'} onPress={() => setStatus('IN_PROGRESS')} />}
              {RECOMMENDABLE.includes(c.status) && can('consultation.recommend') && (
                <Button title={c.recommendation ? 'Update recommendation' : 'Provide recommendation'} type="primary" icon={Stethoscope} onPress={() => setRecOpen(true)} />
              )}
              {['RECOMMENDATION_PROVIDED', 'FOLLOW_UP_SCHEDULED'].includes(c.status) && (
                <Button title="Mark resolved" icon={CheckCircle} loading={busy === 'RESOLVED'} onPress={() => setStatus('RESOLVED')} />
              )}
              {c.status === 'RESOLVED' && <Button title="Close" onPress={() => setStatus('CLOSED')} loading={busy === 'CLOSED'} />}
            </>
          )}
          {isAdmin && can('consultation.assign') && !['RESOLVED', 'CLOSED', 'CANCELLED', 'DRAFT', 'RECOMMENDATION_PROVIDED', 'FOLLOW_UP_SCHEDULED'].includes(c.status) && (
            <Button title={c.expertId ? 'Reassign expert' : 'Assign expert'} icon={UserCheck} onPress={() => setAssignOpen(true)} />
          )}
          {isAdmin && open && !['RESOLVED'].includes(c.status) && (
            <Button title="Cancel consultation" type="danger"
                    onPress={() => setConfirm({ status: 'CANCELLED', title: 'Cancel consultation?', message: 'The customer and expert will be notified.', danger: true })} />
          )}
          {!isCustomer && !actorCanAct && <Text style={TYPE.secondary}>Only the assigned expert or an admin can change this consultation.</Text>}
        </Section>

        {isAdmin && !!c.assignmentHistory?.length && (
          <Section title="Assignment history">
            {c.assignmentHistory.map((h, i) => (
              <View key={i} style={{ gap: 2 }}>
                <Text style={TYPE.body}>{h.expertName ?? 'Admin queue'} · <Text style={TYPE.secondary}>{humanize(h.tier)}</Text></Text>
                <Text style={TYPE.caption}>{h.reason} · {formatDate(h.at)}</Text>
              </View>
            ))}
          </Section>
        )}
      </Page>

      <Modal visible={!!photo} transparent onRequestClose={() => setPhoto(null)}>
        <Pressable style={styles.viewer} onPress={() => setPhoto(null)} accessibilityLabel="Close photo">
          {photo && <Image source={{ uri: photo }} style={{ width: '100%', height: '80%' }} resizeMode="contain" />}
        </Pressable>
      </Modal>

      <RecommendationSheet visible={recOpen} onClose={() => setRecOpen(false)} consultation={c}
                           onSaved={updated => { setData(updated); setRecOpen(false); toast('Recommendation sent to the customer'); }} />
      <AssignSheet visible={assignOpen} onClose={() => setAssignOpen(false)} consultation={c}
                   onSaved={updated => { setData(updated); setAssignOpen(false); toast(`Assigned to ${updated.expertName}`); }} />
      <ConfirmDialog visible={!!confirm} title={confirm?.title ?? ''} message={confirm?.message} danger={confirm?.danger}
                     confirmText="Yes" loading={!!busy}
                     onCancel={() => setConfirm(null)}
                     onConfirm={async () => { const s = confirm!.status; setConfirm(null); await setStatus(s); }} />
    </>
  );
};

const RecommendationSheet = ({ visible, onClose, consultation, onSaved }: {
  visible: boolean; onClose: () => void; consultation: Consultation; onSaved: (c: Consultation) => void;
}) => {
  const [text, setText] = useState(consultation.recommendation?.text ?? '');
  const [productIds, setProductIds] = useState<string[]>(consultation.recommendation?.productIds ?? []);
  const [followUpAt, setFollowUpAt] = useState<string | null>(null);
  const [aiUsed, setAiUsed] = useState(false);
  const [saving, setSaving] = useState(false);
  const products = useApi(() => productApi.list(), [], { focus: false });
  const options = useMemo(() => (products.data?.items ?? []).filter(p => p.isActive !== false)
    .map(p => ({ label: p.name, value: p.productId, description: `${formatMoney(p.price)} / ${p.unit}` })), [products.data]);

  const save = async () => {
    setSaving(true);
    try {
      onSaved(await consultationApi.recommend(consultation.consultationId, { text: text.trim(), productIds, followUpAt, aiAssisted: aiUsed }));
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Recommendation"
           footer={<Button title="Send to customer" type="primary" block loading={saving} disabled={text.trim().length < 10} onPress={save} />}>
      <View style={{ gap: 12 }}>
        <AiAssistPanel feature="EXPERT_ASSIST" title="Draft with AI" context={{ consultationId: consultation.consultationId }}
                       modes={[{ label: 'Draft recommendation', mode: 'draft_recommendation' }]} useLabel="Use as starting point"
                       onUse={t => { setText(t); setAiUsed(true); }} />
        <Field label="Advice for the customer" required help="You are responsible for the final advice — review any AI text carefully.">
          <Input value={text} onChangeText={setText} multiline style={{ minHeight: 160 }}
                 placeholder="Likely cause, what to do now, preventive steps, when to follow up" />
        </Field>
        <Field label="Recommend products (optional)" help="Staff will prepare a quotation for these">
          <Select value={null as any} options={options.filter(o => !productIds.includes(o.value))} title="Add product"
                  placeholder={products.loading ? 'Loading catalogue…' : 'Add a product'} onChange={v => setProductIds(ids => [...ids, v])} />
          <Row gap={6} wrap>
            {productIds.map(pid => (
              <TouchableOpacity key={pid} onPress={() => setProductIds(ids => ids.filter(i => i !== pid))} accessibilityLabel="Remove product">
                <Tag text={`${options.find(o => o.value === pid)?.label ?? 'Product'}  ✕`} color="green" />
              </TouchableOpacity>
            ))}
          </Row>
        </Field>
        <Field label="Schedule a follow-up (optional)">
          <DateTimeField value={followUpAt} onChange={setFollowUpAt} />
        </Field>
      </View>
    </Sheet>
  );
};

const AssignSheet = ({ visible, onClose, consultation, onSaved }: {
  visible: boolean; onClose: () => void; consultation: Consultation; onSaved: (c: Consultation) => void;
}) => {
  const experts = useApi(() => teamApi.assignable('EXPERT'), [], { focus: false });
  const [expertId, setExpertId] = useState<string>('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const options = (experts.data?.items ?? []).filter(e => e.userId !== consultation.expertId).map(e => ({
    label: e.name, value: e.userId,
    description: `${(e.specializations ?? []).join(', ') || 'no specializations'} · ${e.activeConsultationCount ?? 0} active${e.isAvailable === false ? ' · unavailable' : ''}`,
  }));
  const run = async (auto: boolean) => {
    setSaving(auto ? 'auto' : 'manual');
    try {
      onSaved(await consultationApi.assign(consultation.consultationId, auto ? undefined : expertId, reason || undefined));
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setSaving(null);
    }
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={consultation.expertId ? 'Reassign expert' : 'Assign expert'}>
      <View style={{ gap: 12 }}>
        {!consultation.expertId && (
          <>
            <Button title="Auto-assign by crop specialization" type="dashed" loading={saving === 'auto'} onPress={() => run(true)} />
            <Text style={[TYPE.caption, { textAlign: 'center' }]}>or choose manually</Text>
          </>
        )}
        <Field label="Expert" required>
          <Select value={expertId} options={options} onChange={setExpertId} placeholder={experts.loading ? 'Loading…' : 'Choose expert'} title="Choose expert" />
        </Field>
        <Field label="Reason"><Input value={reason} onChangeText={setReason} placeholder="e.g. Expert on leave" /></Field>
        <Button title="Assign" type="primary" disabled={!expertId} loading={saving === 'manual'} onPress={() => run(false)} />
      </View>
    </Sheet>
  );
};

const styles = StyleSheet.create({
  photo: { width: 96, height: 96, borderRadius: 8, backgroundColor: TOKENS.colorSplit },
  product: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 8, backgroundColor: TOKENS.colorPrimaryBg },
  bubble: { borderRadius: 12, padding: 10, gap: 2, maxWidth: '92%' },
  mine: { alignSelf: 'flex-end', backgroundColor: TOKENS.colorPrimaryBg },
  theirs: { alignSelf: 'flex-start', backgroundColor: '#F5F5F5' },
  internal: { backgroundColor: '#FFFBE6', borderWidth: 1, borderColor: '#FFE58F' },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
});
