import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { adminApi } from '../../../services/platform';
import { useApi, useAuth } from '../../../hooks/useApi';
import { Page, Section, Field, Input, Button, Row, SwitchRow, Alert, Loading, ErrorView, toast } from '../../../ui';

const ROLES = ['SUPER_ADMIN', 'ADMIN', 'STAFF', 'EXPERT'] as const;

export const QuotationSettingsScreen = () => {
  const { can } = useAuth();
  const readOnly = !can('settings.quotation');
  const { data, loading, error, reload } = useApi(() => adminApi.setting('quotation'), [], { focus: false });
  const [f, setF] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (data) setF({ ...data, maxDiscountPctByRole: { ...data.maxDiscountPctByRole } }); }, [data]);

  if (loading || (!f && !error)) return <Loading />;
  if (error) return <ErrorView message={error} onRetry={reload} />;
  const set = (k: string) => (v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const num = (v: string) => v.replace(/[^0-9.]/g, '');

  const save = async () => {
    setSaving(true);
    try {
      await adminApi.saveSetting('quotation', {
        ...f,
        defaultTaxRatePct: Number(f.defaultTaxRatePct), validityDays: Number(f.validityDays), approvalDiscountPct: Number(f.approvalDiscountPct),
        maxDiscountPctByRole: Object.fromEntries(ROLES.map(r => [r, Number(f.maxDiscountPctByRole[r] ?? 0)])),
      });
      toast('Quotation settings saved');
      reload();
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page keyboard>
      {readOnly && <Alert type="info" message="Only a Super Admin can change these settings." />}
      <Section title="Pricing">
        <Row gap={10} style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}><Field label="Default tax %" help="Used when a product has no tax rate">
            <Input value={String(f.defaultTaxRatePct)} onChangeText={v => set('defaultTaxRatePct')(num(v))} keyboardType="decimal-pad" editable={!readOnly} />
          </Field></View>
          <View style={{ flex: 1 }}><Field label="Validity (days)">
            <Input value={String(f.validityDays)} onChangeText={v => set('validityDays')(num(v))} keyboardType="number-pad" editable={!readOnly} />
          </Field></View>
        </Row>
      </Section>
      <Section title="Discount limits by role (%)">
        <Row gap={8} wrap>
          {ROLES.map(r => (
            <View key={r} style={{ flexBasis: '45%', flexGrow: 1 }}>
              <Field label={r.replace('_', ' ')}>
                <Input value={String(f.maxDiscountPctByRole[r] ?? 0)} editable={!readOnly} keyboardType="decimal-pad"
                       onChangeText={v => setF((x: any) => ({ ...x, maxDiscountPctByRole: { ...x.maxDiscountPctByRole, [r]: num(v) } }))} />
              </Field>
            </View>
          ))}
        </Row>
      </Section>
      <Section title="Approval">
        {(['STAFF', 'ADMIN', 'EXPERT'] as const).map(r => (
          <SwitchRow key={r} label={`Always require approval for ${r.toLowerCase()} quotations`} disabled={readOnly}
                     value={f.approvalRequiredForRoles.includes(r)}
                     onChange={v => set('approvalRequiredForRoles')(v ? [...f.approvalRequiredForRoles, r] : f.approvalRequiredForRoles.filter((x: string) => x !== r))} />
        ))}
        <Field label="Require approval when any line discount exceeds (%)">
          <Input value={String(f.approvalDiscountPct)} onChangeText={v => set('approvalDiscountPct')(num(v))} keyboardType="decimal-pad" editable={!readOnly} />
        </Field>
      </Section>
      <Section title="Document">
        <Field label="Company name"><Input value={f.companyName} onChangeText={set('companyName')} editable={!readOnly} /></Field>
        <Field label="Contact line" help="Address / phone shown on the PDF"><Input value={f.companyContact} onChangeText={set('companyContact')} editable={!readOnly} /></Field>
        <Field label="Default payment terms"><Input value={f.paymentTerms} onChangeText={set('paymentTerms')} multiline editable={!readOnly} /></Field>
        <Field label="Default delivery terms"><Input value={f.deliveryTerms} onChangeText={set('deliveryTerms')} multiline editable={!readOnly} /></Field>
        <Field label="Terms & conditions"><Input value={f.termsAndConditions} onChangeText={set('termsAndConditions')} multiline editable={!readOnly} /></Field>
      </Section>
      {!readOnly && <Button title="Save" type="primary" block loading={saving} onPress={save} />}
    </Page>
  );
};
