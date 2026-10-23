import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { Zap, RotateCcw, Check, X } from 'lucide-react-native';
import { automationApi, AutomationRule, AutomationRun } from '../../../services/platform';
import { useApi } from '../../../hooks/useApi';
import { Page, Section, Field, Input, SwitchRow, Button, Row, Tag, Loading, ErrorView, Empty, humanize, formatDate, toast } from '../../../ui';
import { TOKENS, TYPE } from '../../../theme';

const RUN_COLOR: Record<string, string> = {
  SUCCESS: 'green', FAILED: 'red', PENDING_APPROVAL: 'gold', APPROVED: 'cyan', REJECTED: 'default',
};

/**
 * Super Admin / Admin: toggle the predefined automation rules (escalation, reminders,
 * quotation follow-up, AI provider alert), tune their few safe parameters, and review
 * / approve / retry what they've actually done. No rule here ever messages a customer
 * on its own — a quotation follow-up only drafts a suggestion that needs approval.
 */
export const AutomationRulesScreen = () => {
  const { data, loading, error, reload } = useApi(() => automationApi.rules(), [], { focus: false });
  const [form, setForm] = useState<Record<string, AutomationRule>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const runs = useApi(() => automationApi.runs(), [], { focus: false });

  useEffect(() => { if (data) setForm(data.rules); }, [data]);

  if (loading) return <Loading />;
  if (error || !data) return <ErrorView message={error ?? 'Failed'} onRetry={reload} />;

  const patch = (ruleId: string, p: Partial<AutomationRule>) => setForm(f => ({ ...f, [ruleId]: { ...f[ruleId], ...p } }));

  const save = async (ruleId: string, body: object) => {
    setBusy(ruleId);
    try {
      const updated = await automationApi.updateRule(ruleId, body);
      setForm(f => ({ ...f, [ruleId]: { ...f[ruleId], ...updated } }));
      toast('Saved');
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const act = async (run: AutomationRun, action: 'retry' | 'approve' | 'reject') => {
    setBusy(run.runId);
    try {
      await automationApi[action](run.runId);
      toast(action === 'retry' ? 'Retried' : action === 'approve' ? 'Approved' : 'Rejected');
      runs.reload();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Page>
      <Section>
        <Row gap={10}>
          <Zap size={22} color={TOKENS.colorPrimary} />
          <Text style={[TYPE.h2, { flex: 1 }]}>Automation rules</Text>
        </Row>
        <Text style={TYPE.secondary}>
          Predefined, safe automations only — there's no general rule engine here. Each rule's trigger and action are
          fixed code; you can only enable/disable it and tune the parameters shown. Anything customer-facing (the
          quotation follow-up's suggested message) waits for your approval below before it counts as sent anywhere.
        </Text>
      </Section>

      {Object.entries(form).map(([ruleId, rule]) => (
        <Section key={ruleId} title={rule.label}>
          <Text style={TYPE.caption}>{rule.description}</Text>
          <SwitchRow label="Enabled" value={!!rule.enabled} disabled={busy === ruleId}
                     onChange={v => { patch(ruleId, { enabled: v }); save(ruleId, { enabled: v }); }} />
          {ruleId === 'QUOTATION_FOLLOWUP' && (
            <>
              <Field label="Follow up after (hours unanswered)">
                <Input keyboardType="number-pad" value={String(rule.followUpAfterHours ?? '')}
                       onChangeText={v => patch(ruleId, { followUpAfterHours: Number(v) || 0 })} />
              </Field>
              <SwitchRow label="Require approval before sending" value={!!rule.requiresApproval} disabled={busy === ruleId}
                         onChange={v => patch(ruleId, { requiresApproval: v })} />
              <Button title="Save" size="sm" loading={busy === ruleId}
                      onPress={() => save(ruleId, { followUpAfterHours: rule.followUpAfterHours, requiresApproval: rule.requiresApproval })} />
            </>
          )}
          {ruleId === 'AI_PROVIDER_FAILURE_ALERT' && (
            <>
              <Field label="Failures per day before alerting">
                <Input keyboardType="number-pad" value={String(rule.failureThreshold ?? '')}
                       onChangeText={v => patch(ruleId, { failureThreshold: Number(v) || 0 })} />
              </Field>
              <Button title="Save" size="sm" loading={busy === ruleId}
                      onPress={() => save(ruleId, { failureThreshold: rule.failureThreshold })} />
            </>
          )}
        </Section>
      ))}

      <Section title="Execution history">
        {runs.loading ? <Loading /> : runs.error ? <ErrorView message={runs.error} onRetry={runs.reload} /> : !runs.data?.items.length ? (
          <Empty title="No automations have fired yet" />
        ) : (
          <View style={{ gap: 10 }}>
            {runs.data.items.map(run => (
              <View key={run.runId} style={{ borderWidth: 1, borderColor: TOKENS.colorBorder, borderRadius: TOKENS.radius, padding: 12, gap: 6 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text style={TYPE.h3}>{humanize(run.ruleId)}</Text>
                  <Tag text={humanize(run.status)} color={RUN_COLOR[run.status] ?? 'default'} small />
                </Row>
                <Text style={TYPE.secondary}>{run.detail}</Text>
                {!!run.payload?.suggestedMessage && <Text style={TYPE.caption}>Suggested message: "{run.payload.suggestedMessage}"</Text>}
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text style={TYPE.caption}>{formatDate(run.createdAt)} · {run.attempts} attempt{run.attempts > 1 ? 's' : ''}</Text>
                  <Row gap={8}>
                    {run.status === 'FAILED' && <Button title="Retry" size="sm" icon={RotateCcw} loading={busy === run.runId} onPress={() => act(run, 'retry')} />}
                    {run.status === 'PENDING_APPROVAL' && (
                      <>
                        <Button title="Reject" size="sm" icon={X} loading={busy === run.runId} onPress={() => act(run, 'reject')} />
                        <Button title="Approve" type="primary" size="sm" icon={Check} loading={busy === run.runId} onPress={() => act(run, 'approve')} />
                      </>
                    )}
                  </Row>
                </Row>
              </View>
            ))}
          </View>
        )}
      </Section>
    </Page>
  );
};
