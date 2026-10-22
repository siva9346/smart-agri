import React, { useState } from 'react';
import { View, Text, Linking, Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Send, CheckCircle, XCircle, Pencil, FileDown, MessageCircle, Bell, Ban, ExternalLink } from 'lucide-react-native';
import { quotationApi, Quotation } from '../../services/platform';
import { useApi, useAuth } from '../../hooks/useApi';
import {
  Page, Section, KeyValue, StatusTag, Tag, Button, Row, Divider, ConfirmDialog, Alert, Loading, ErrorView, Sheet,
  Field, Input, formatDate, formatMoney, humanize, toast,
} from '../../ui';
import { TOKENS, TYPE } from '../../theme';

type Dialog = 'reject' | 'cancel' | 'accept' | 'decline' | 'recordAccept' | 'recordDecline' | null;

export const QuotationDetailScreen = ({ navigation, route }: any) => {
  const id: string = route.params.id;
  const { isCustomer, isAdmin } = useAuth();
  const { data: q, setData, loading, error, reload, refreshing, refresh } = useApi(() => quotationApi.get(id), [id]);
  const [busy, setBusy] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [shareOpen, setShareOpen] = useState(false);

  const run = async (label: string, fn: () => Promise<Quotation>, done: string) => {
    setBusy(label);
    try {
      setData(await fn());
      toast(done);
    } catch (e: any) {
      toast(e.message, 'error');
      reload();
    } finally {
      setBusy(null);
    }
  };

  const share = async (channel: 'WHATSAPP' | 'IN_APP') => {
    setBusy(channel);
    try {
      const res = await quotationApi.share(id, channel);
      setData(res.quotation);
      setShareOpen(false);
      if (channel === 'WHATSAPP' && res.url) {
        await Linking.openURL(res.url);
        toast('WhatsApp opened — send the message to complete sharing', 'info');
      } else {
        toast('Sent to the customer’s app');
      }
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const pdf = async () => {
    setBusy('pdf');
    try {
      const doc = await quotationApi.document(id);
      if (Platform.OS === 'web') {
        await Print.printAsync({ html: doc.html });
      } else {
        const { uri } = await Print.printToFileAsync({ html: doc.html });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: doc.fileName, UTI: 'com.adobe.pdf' });
        } else {
          await Print.printAsync({ uri });
        }
      }
    } catch (e: any) {
      toast(e.message ?? 'Could not create the PDF', 'error');
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <Loading />;
  if (error || !q) return <ErrorView message={error ?? 'Not found'} onRetry={reload} />;
  const p = q.permissions;
  const customerCanRespond = isCustomer && (q.status === 'SHARED' || q.status === 'VIEWED');
  const cancellable = !isCustomer && !['ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED'].includes(q.status);

  return (
    <>
      <Page refreshing={refreshing} onRefresh={refresh}>
        <Section>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={TYPE.h2}>{q.quotationNumber}</Text>
            <StatusTag status={q.status} />
          </Row>
          <Text style={[TYPE.h1, { color: TOKENS.colorPrimary }]}>{formatMoney(q.grandTotal)}</Text>
          <Text style={TYPE.secondary}>Valid until {q.validUntil} · created {formatDate(q.createdAt, false)}</Text>
          {q.status === 'DRAFT' && q.rejectionReason && <Alert type="warning" title="Sent back by approver" message={q.rejectionReason} />}
          {q.status === 'PENDING_APPROVAL' && !isCustomer && <Alert type="info" message="Waiting for an admin to approve before it can be shared." />}
          {q.status === 'EXPIRED' && <Alert type="warning" message="This quotation has expired." />}
          {!!q.customerComment && <KeyValue label="Customer said" value={q.customerComment} />}
        </Section>

        {!isCustomer && (
          <Section title="Customer" extra={q.leadId ? <Button title="Open lead" size="sm" type="text" icon={ExternalLink}
                                                                onPress={() => navigation.navigate('LeadDetail', { id: q.leadId })} /> : undefined}>
            <KeyValue label="Name" value={q.customerName} />
            <KeyValue label="Phone" value={q.customerPhone} />
            <KeyValue label="Location" value={q.customerLocation} />
            {!q.customerId && <Text style={TYPE.caption}>No app account — share via WhatsApp.</Text>}
          </Section>
        )}

        <Section title="Items">
          {q.items.map(i => (
            <View key={i.productId} style={{ gap: 2, paddingVertical: 6 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={[TYPE.h3, { flex: 1 }]}>{i.name}</Text>
                <Text style={TYPE.h3}>{formatMoney(i.lineTotal)}</Text>
              </Row>
              <Text style={TYPE.caption}>
                {i.quantity} {i.unit} × {formatMoney(i.unitPrice)}
                {Number(i.discountPct) ? ` · ${i.discountPct}% off (−${formatMoney(i.discountAmount)})` : ''}
                {Number(i.taxRatePct) ? ` · tax ${i.taxRatePct}% (${formatMoney(i.taxAmount)})` : ''}
              </Text>
            </View>
          ))}
          <Divider />
          <KeyValue label="Subtotal" value={formatMoney(q.subtotal)} />
          <KeyValue label="Discount" value={`− ${formatMoney(q.discountTotal)}`} />
          <KeyValue label="Tax" value={formatMoney(q.taxTotal)} />
          <KeyValue label="Delivery" value={formatMoney(q.deliveryCharge)} />
          <KeyValue label="Grand total" value={<Text style={[TYPE.h3, { color: TOKENS.colorPrimary }]}>{formatMoney(q.grandTotal)}</Text>} />
          {(q.warnings ?? []).map(w => <Alert key={w} type="warning" message={w} />)}
        </Section>

        <Section title="Terms">
          <KeyValue label="Payment" value={q.paymentTerms} />
          <KeyValue label="Delivery" value={q.deliveryTerms} />
          <KeyValue label="Notes" value={q.notes} />
          {!isCustomer && <KeyValue label="Prepared by" value={q.createdByName} />}
          {!isCustomer && <KeyValue label="Approved by" value={q.approvedByName} />}
        </Section>

        <Section title="Actions">
          {customerCanRespond && (
            <>
              <Button title="Accept quotation" type="primary" icon={CheckCircle} onPress={() => setDialog('accept')} />
              <Button title="Decline" type="danger" icon={XCircle} onPress={() => setDialog('decline')} />
            </>
          )}
          {p?.edit && <Button title="Edit draft" icon={Pencil} onPress={() => navigation.navigate('QuotationBuilder', { quotationId: id })} />}
          {p?.edit && <Button title="Submit" type="primary" icon={Send} loading={busy === 'submit'}
                              onPress={() => run('submit', () => quotationApi.submit(id), 'Submitted')} />}
          {p?.approve && (
            <>
              <Button title="Approve" type="primary" icon={CheckCircle} loading={busy === 'approve'}
                      onPress={() => run('approve', () => quotationApi.approve(id), 'Approved')} />
              <Button title="Send back for changes" type="danger" onPress={() => setDialog('reject')} />
            </>
          )}
          {p?.share && <Button title={q.status === 'APPROVED' ? 'Share with customer' : 'Share again'} type="primary" icon={Send} onPress={() => setShareOpen(true)} />}
          {p?.recordResponse && (
            <Row gap={8}>
              <Button title="Record accepted" style={{ flex: 1 }} onPress={() => setDialog('recordAccept')} />
              <Button title="Record declined" style={{ flex: 1 }} onPress={() => setDialog('recordDecline')} />
            </Row>
          )}
          <Button title="Download / share PDF" icon={FileDown} loading={busy === 'pdf'} onPress={pdf} />
          {cancellable && (p?.edit || isAdmin) && <Button title="Cancel quotation" type="danger" icon={Ban} onPress={() => setDialog('cancel')} />}
        </Section>

        {!isCustomer && !!q.approvalHistory?.length && (
          <Section title="History">
            {q.approvalHistory.map((h, i) => (
              <Text key={i} style={TYPE.secondary}>{humanize(h.event)} · {h.byName} · {formatDate(h.at)}{h.note ? ` — ${h.note}` : ''}</Text>
            ))}
          </Section>
        )}
      </Page>

      <Sheet visible={shareOpen} onClose={() => setShareOpen(false)} title="Share quotation">
        <View style={{ gap: 10 }}>
          <Button title="WhatsApp" icon={MessageCircle} type="primary" loading={busy === 'WHATSAPP'} onPress={() => share('WHATSAPP')} />
          <Text style={TYPE.caption}>Opens WhatsApp with the quotation summary for you to send. Delivery is not tracked.</Text>
          {!!q.customerId && (
            <>
              <Button title="Send to customer's app" icon={Bell} loading={busy === 'IN_APP'} onPress={() => share('IN_APP')} />
              <Text style={TYPE.caption}>The customer is notified in the app; it shows as Viewed when they open it.</Text>
            </>
          )}
        </View>
      </Sheet>

      <ConfirmDialog visible={dialog === 'reject'} title="Send back for changes" input={{ placeholder: 'What should change?', required: true }}
                     confirmText="Send back" danger loading={!!busy} onCancel={() => setDialog(null)}
                     onConfirm={t => { setDialog(null); run('reject', () => quotationApi.reject(id, t), 'Sent back to the creator'); }} />
      <ConfirmDialog visible={dialog === 'cancel'} title="Cancel quotation?" input={{ placeholder: 'Reason (optional)' }} danger
                     confirmText="Cancel quotation" onCancel={() => setDialog(null)}
                     onConfirm={t => { setDialog(null); run('cancel', () => quotationApi.cancel(id, t), 'Cancelled'); }} />
      <ConfirmDialog visible={dialog === 'accept' || dialog === 'recordAccept'} title="Accept this quotation?"
                     message={`Total ${formatMoney(q.grandTotal)}. Our team will contact you to confirm the order.`}
                     input={{ placeholder: 'Comment (optional)' }} confirmText="Accept" onCancel={() => setDialog(null)}
                     onConfirm={t => { setDialog(null); run('respond', () => quotationApi.respond(id, 'ACCEPT', t), 'Accepted'); }} />
      <ConfirmDialog visible={dialog === 'decline' || dialog === 'recordDecline'} title="Decline this quotation?"
                     input={{ placeholder: 'Tell us why (optional)' }} confirmText="Decline" danger onCancel={() => setDialog(null)}
                     onConfirm={t => { setDialog(null); run('respond', () => quotationApi.respond(id, 'REJECT', t), 'Declined'); }} />
    </>
  );
};
