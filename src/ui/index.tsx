/**
 * Smart Agri UI kit — Ant Design-inspired components built on core React Native.
 *
 * Deliberately not @ant-design/react-native: it pulls in react-native-reanimated
 * and gesture-handler, which crash this project's Expo Go client (see
 * navigation/CustomDrawer.tsx). Everything here is plain RN and works on
 * iOS, Android and web.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Modal, ScrollView,
  Pressable, RefreshControl, KeyboardAvoidingView, Platform, StyleProp, ViewStyle, TextInputProps,
  useWindowDimensions,
} from 'react-native';
import { ChevronDown, ChevronRight, X, Check, Search, AlertCircle, Inbox } from 'lucide-react-native';
import { TOKENS, TYPE, TAG_COLORS } from '../theme';

// ── Layout ───────────────────────────────────────────────────────────────────

/** Scrollable page with consistent gutters; caps width on tablets. */
export const Page = ({ children, refreshing, onRefresh, contentStyle, keyboard }: {
  children: React.ReactNode; refreshing?: boolean; onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>; keyboard?: boolean;
}) => {
  const { width } = useWindowDimensions();
  const body = (
    <ScrollView
      style={styles.page}
      contentContainerStyle={[styles.pageContent, width > 720 && styles.pageWide, contentStyle]}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={TOKENS.colorPrimary} /> : undefined}
    >
      {children}
    </ScrollView>
  );
  if (!keyboard) return body;
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      {body}
    </KeyboardAvoidingView>
  );
};

export const Section = ({ title, extra, children, style, padded = true }: {
  title?: string; extra?: React.ReactNode; children: React.ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean;
}) => (
  <View style={[styles.section, style]}>
    {(title || extra) && (
      <View style={styles.sectionHead}>
        {!!title && <Text style={TYPE.h3}>{title}</Text>}
        {extra}
      </View>
    )}
    <View style={padded ? styles.sectionBody : undefined}>{children}</View>
  </View>
);

export const Row = ({ children, gap = 8, wrap, style }: { children: React.ReactNode; gap?: number; wrap?: boolean; style?: StyleProp<ViewStyle> }) => (
  <View style={[{ flexDirection: 'row', alignItems: 'center', gap, flexWrap: wrap ? 'wrap' : 'nowrap' }, style]}>{children}</View>
);

export const Divider = () => <View style={styles.divider} />;

// ── Buttons ──────────────────────────────────────────────────────────────────

type ButtonType = 'primary' | 'default' | 'danger' | 'text' | 'dashed';

export const Button = ({ title, onPress, type = 'default', icon: Icon, loading, disabled, block, size = 'md', style, accessibilityLabel }: {
  title: string; onPress?: () => void; type?: ButtonType; icon?: any; loading?: boolean; disabled?: boolean;
  block?: boolean; size?: 'sm' | 'md'; style?: StyleProp<ViewStyle>; accessibilityLabel?: string;
}) => {
  const palette = {
    primary: { bg: TOKENS.colorPrimary, fg: '#FFF', border: TOKENS.colorPrimary },
    default: { bg: '#FFF', fg: TOKENS.colorText, border: TOKENS.colorBorder },
    danger:  { bg: '#FFF', fg: TOKENS.colorError, border: '#FFA39E' },
    text:    { bg: 'transparent', fg: TOKENS.colorPrimary, border: 'transparent' },
    dashed:  { bg: '#FFF', fg: TOKENS.colorPrimary, border: TOKENS.colorPrimaryBorder },
  }[type];
  const off = disabled || loading;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={off}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      style={[
        styles.btn, size === 'sm' && styles.btnSm,
        { backgroundColor: palette.bg, borderColor: palette.border, borderStyle: type === 'dashed' ? 'dashed' : 'solid' },
        block && { alignSelf: 'stretch' }, off && { opacity: 0.55 }, style,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={palette.fg} /> : Icon ? <Icon size={size === 'sm' ? 14 : 16} color={palette.fg} /> : null}
      <Text style={[styles.btnText, size === 'sm' && { fontSize: 13 }, { color: palette.fg }]} numberOfLines={1}>{title}</Text>
    </TouchableOpacity>
  );
};

/** Square icon action with label underneath — used for quick-action grids. */
export const ActionTile = ({ label, icon: Icon, onPress, tone = TOKENS.colorPrimary, disabled }: {
  label: string; icon: any; onPress: () => void; tone?: string; disabled?: boolean;
}) => (
  <TouchableOpacity style={[styles.tile, disabled && { opacity: 0.45 }]} onPress={onPress} disabled={disabled}
                    accessibilityRole="button" accessibilityLabel={label} activeOpacity={0.7}>
    <View style={[styles.tileIcon, { backgroundColor: tone + '14' }]}><Icon size={20} color={tone} /></View>
    <Text style={styles.tileLabel} numberOfLines={2}>{label}</Text>
  </TouchableOpacity>
);

// ── Tags & status ────────────────────────────────────────────────────────────

export const Tag = ({ text, color = 'default', small }: { text: string; color?: keyof typeof TAG_COLORS | string; small?: boolean }) => {
  const [fg, bg, border] = TAG_COLORS[color] ?? TAG_COLORS.default;
  return (
    <View style={[styles.tag, small && styles.tagSm, { backgroundColor: bg, borderColor: border }]}>
      <Text style={[styles.tagText, small && { fontSize: 10.5 }, { color: fg }]} numberOfLines={1}>{text}</Text>
    </View>
  );
};

const STATUS_COLOR: Record<string, string> = {
  // consultations
  DRAFT: 'default', SUBMITTED: 'blue', AWAITING_ASSIGNMENT: 'orange', ASSIGNED: 'cyan', ACCEPTED: 'blue',
  IN_PROGRESS: 'blue', INFO_REQUIRED: 'gold', RECOMMENDATION_PROVIDED: 'green', FOLLOW_UP_SCHEDULED: 'purple',
  RESOLVED: 'green', CLOSED: 'default', CANCELLED: 'default',
  // leads
  NEW: 'blue', CONTACT_PENDING: 'gold', CONTACTED: 'cyan', REQUIREMENT_IDENTIFIED: 'cyan', EXPERT_CONSULTATION: 'purple',
  QUOTATION_SHARED: 'blue', NEGOTIATION: 'orange', WON: 'green', LOST: 'red',
  // quotations
  PENDING_APPROVAL: 'gold', APPROVED: 'cyan', SHARED: 'blue', VIEWED: 'purple', REJECTED: 'red', EXPIRED: 'default',
  // tasks / priority
  OPEN: 'blue', COMPLETED: 'green', NO_SHOW: 'red', LOW: 'default', MEDIUM: 'blue', HIGH: 'orange', URGENT: 'red',
  CRITICAL: 'red',
};

export const humanize = (s?: string | null) =>
  (s ?? '').toLowerCase().split('_').map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(' ');

export const StatusTag = ({ status, small }: { status?: string; small?: boolean }) =>
  status ? <Tag text={humanize(status)} color={STATUS_COLOR[status] ?? 'default'} small={small} /> : null;

// ── Forms ────────────────────────────────────────────────────────────────────

export const Field = ({ label, required, error, help, children }: {
  label: string; required?: boolean; error?: string | null; help?: string; children: React.ReactNode;
}) => (
  <View style={styles.field}>
    <Text style={TYPE.label}>{label}{required ? <Text style={{ color: TOKENS.colorError }}> *</Text> : null}</Text>
    {children}
    {!!error && <Text style={styles.fieldError} accessibilityLiveRegion="polite">{error}</Text>}
    {!error && !!help && <Text style={TYPE.caption}>{help}</Text>}
  </View>
);

export const Input = ({ error, style, multiline, ...rest }: TextInputProps & { error?: boolean }) => (
  <TextInput
    placeholderTextColor={TOKENS.colorTextTertiary}
    style={[styles.input, multiline && styles.textarea, error && { borderColor: TOKENS.colorError }, style]}
    multiline={multiline}
    textAlignVertical={multiline ? 'top' : 'center'}
    {...rest}
  />
);

export interface Option<T = string> { label: string; value: T; description?: string }

/** Modal picker — searchable when there are many options. */
export function Select<T extends string>({ value, options, onChange, placeholder = 'Select', error, disabled, title }: {
  value?: T | null; options: Option<T>[]; onChange: (v: T) => void; placeholder?: string; error?: boolean;
  disabled?: boolean; title?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const current = options.find(o => o.value === value);
  const filtered = useMemo(
    () => (q ? options.filter(o => o.label.toLowerCase().includes(q.toLowerCase())) : options),
    [q, options],
  );
  return (
    <>
      <TouchableOpacity
        style={[styles.input, styles.select, error && { borderColor: TOKENS.colorError }, disabled && { opacity: 0.55 }]}
        onPress={() => setOpen(true)} disabled={disabled} accessibilityRole="button"
        accessibilityLabel={`${title ?? placeholder}: ${current?.label ?? 'not selected'}`}
      >
        <Text style={[TYPE.body, !current && { color: TOKENS.colorTextTertiary }]} numberOfLines={1}>{current?.label ?? placeholder}</Text>
        <ChevronDown size={16} color={TOKENS.colorTextTertiary} />
      </TouchableOpacity>
      <Sheet visible={open} onClose={() => { setOpen(false); setQ(''); }} title={title ?? placeholder}>
        {options.length > 8 && (
          <View style={[styles.input, styles.searchBox]}>
            <Search size={16} color={TOKENS.colorTextTertiary} />
            <TextInput value={q} onChangeText={setQ} placeholder="Search" style={styles.searchInput}
                       placeholderTextColor={TOKENS.colorTextTertiary} autoFocus />
          </View>
        )}
        <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled">
          {filtered.map(o => (
            <TouchableOpacity key={o.value} style={styles.option} onPress={() => { onChange(o.value); setOpen(false); setQ(''); }}>
              <View style={{ flex: 1 }}>
                <Text style={[TYPE.body, o.value === value && { color: TOKENS.colorPrimary, fontWeight: '600' }]}>{o.label}</Text>
                {!!o.description && <Text style={TYPE.caption}>{o.description}</Text>}
              </View>
              {o.value === value && <Check size={18} color={TOKENS.colorPrimary} />}
            </TouchableOpacity>
          ))}
          {!filtered.length && <Text style={[TYPE.secondary, { padding: 16 }]}>No matches</Text>}
        </ScrollView>
      </Sheet>
    </>
  );
}

/** Horizontally scrollable chip group (tabs / filters). */
export function Segmented<T extends string>({ value, options, onChange, style }: {
  value: T; options: Option<T>[]; onChange: (v: T) => void; style?: StyleProp<ViewStyle>;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[{ flexGrow: 0 }, style]}
                contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
      {options.map(o => {
        const active = o.value === value;
        return (
          <TouchableOpacity key={o.value} onPress={() => onChange(o.value)} accessibilityRole="tab"
                            accessibilityState={{ selected: active }}
                            style={[styles.chip, active && styles.chipActive]}>
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

export const Switch = ({ value, onChange, disabled, label }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string }) => (
  <Pressable onPress={() => !disabled && onChange(!value)} accessibilityRole="switch" accessibilityLabel={label}
             accessibilityState={{ checked: value, disabled }} hitSlop={8}
             style={[styles.switch, value && styles.switchOn, disabled && { opacity: 0.5 }]}>
    <View style={[styles.knob, value && styles.knobOn]} />
  </Pressable>
);

export const SwitchRow = ({ label, description, value, onChange, disabled }: {
  label: string; description?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) => (
  <View style={styles.switchRow}>
    <View style={{ flex: 1, paddingRight: 12 }}>
      <Text style={TYPE.body}>{label}</Text>
      {!!description && <Text style={TYPE.caption}>{description}</Text>}
    </View>
    <Switch value={value} onChange={onChange} disabled={disabled} label={label} />
  </View>
);

/**
 * Date/time entry without a native picker dependency: quick presets plus a
 * typed "YYYY-MM-DD HH:mm" value (local time). Emits an ISO UTC string.
 */
export const DateTimeField = ({ value, onChange, presets = true, dateOnly }: {
  value?: string | null; onChange: (iso: string | null) => void; presets?: boolean; dateOnly?: boolean;
}) => {
  const fmt = (iso?: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const p = (n: number) => String(n).padStart(2, '0');
    const date = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    return dateOnly ? date : `${date} ${p(d.getHours())}:${p(d.getMinutes())}`;
  };
  const [text, setText] = useState(fmt(value));
  useEffect(() => { setText(fmt(value)); }, [value]);
  const parse = (t: string) => {
    const m = t.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?$/);
    if (!m) return null;
    const d = new Date(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] : 9, m[5] ? +m[5] : 0);
    return isNaN(d.getTime()) ? null : d.toISOString();
  };
  const preset = (days: number, hour: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(hour, 0, 0, 0);
    onChange(d.toISOString());
  };
  const invalid = !!text && !parse(text);
  return (
    <View style={{ gap: 8 }}>
      {presets && (
        <Row gap={6} wrap>
          {[['Today 5 PM', 0, 17], ['Tomorrow 10 AM', 1, 10], ['In 3 days', 3, 10], ['Next week', 7, 10]].map(([l, d, h]) => (
            <TouchableOpacity key={l as string} style={styles.chip} onPress={() => preset(d as number, h as number)}>
              <Text style={styles.chipText}>{l as string}</Text>
            </TouchableOpacity>
          ))}
        </Row>
      )}
      <Input value={text} placeholder={dateOnly ? 'YYYY-MM-DD' : 'YYYY-MM-DD HH:mm'} error={invalid}
             onChangeText={t => { setText(t); const iso = parse(t); if (iso || !t) onChange(iso); }}
             autoCapitalize="none" keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'} />
      {invalid && <Text style={styles.fieldError}>Use the format {dateOnly ? 'YYYY-MM-DD' : 'YYYY-MM-DD HH:mm'}</Text>}
    </View>
  );
};

// ── Data display ─────────────────────────────────────────────────────────────

export const Stat = ({ label, value, tone, onPress, hint }: {
  label: string; value: React.ReactNode; tone?: string; onPress?: () => void; hint?: string;
}) => {
  const body = (
    <View style={styles.stat}>
      <Text style={TYPE.caption} numberOfLines={1}>{label}</Text>
      <Text style={[styles.statValue, tone ? { color: tone } : null]} numberOfLines={1}>{value ?? '—'}</Text>
      {!!hint && <Text style={TYPE.caption} numberOfLines={1}>{hint}</Text>}
    </View>
  );
  return onPress ? <TouchableOpacity style={{ flexGrow: 1, flexBasis: '45%' }} onPress={onPress} activeOpacity={0.7}>{body}</TouchableOpacity>
    : <View style={{ flexGrow: 1, flexBasis: '45%' }}>{body}</View>;
};

export const StatGrid = ({ children }: { children: React.ReactNode }) => <View style={styles.statGrid}>{children}</View>;

export const ListRow = ({ title, subtitle, meta, right, onPress, left, chevron = !!onPress }: {
  title: React.ReactNode; subtitle?: React.ReactNode; meta?: React.ReactNode; right?: React.ReactNode;
  onPress?: () => void; left?: React.ReactNode; chevron?: boolean;
}) => {
  const content = (
    <View style={styles.listRow}>
      {left}
      <View style={{ flex: 1, gap: 2 }}>
        {typeof title === 'string' ? <Text style={TYPE.h3} numberOfLines={1}>{title}</Text> : title}
        {!!subtitle && (typeof subtitle === 'string' ? <Text style={TYPE.secondary} numberOfLines={2}>{subtitle}</Text> : subtitle)}
        {!!meta && (typeof meta === 'string' ? <Text style={TYPE.caption}>{meta}</Text> : meta)}
      </View>
      {right}
      {chevron && <ChevronRight size={18} color={TOKENS.colorTextTertiary} />}
    </View>
  );
  return onPress ? <TouchableOpacity onPress={onPress} activeOpacity={0.6} accessibilityRole="button">{content}</TouchableOpacity> : content;
};

export const KeyValue = ({ label, value }: { label: string; value?: React.ReactNode }) =>
  value === undefined || value === null || value === '' ? null : (
    <View style={styles.kv}>
      <Text style={[TYPE.secondary, { width: 120 }]}>{label}</Text>
      {typeof value === 'string' || typeof value === 'number'
        ? <Text style={[TYPE.body, { flex: 1 }]}>{value}</Text> : <View style={{ flex: 1 }}>{value}</View>}
    </View>
  );

export const Avatar = ({ name, size = 40, color = TOKENS.colorPrimary }: { name?: string; size?: number; color?: string }) => (
  <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color + '18', alignItems: 'center', justifyContent: 'center' }}>
    <Text style={{ color, fontWeight: '700', fontSize: size * 0.4 }}>{(name ?? '?').trim().charAt(0).toUpperCase()}</Text>
  </View>
);

export const Alert = ({ type = 'info', title, message }: { type?: 'info' | 'warning' | 'error' | 'success'; title?: string; message: string }) => {
  const c = { info: TAG_COLORS.blue, warning: TAG_COLORS.gold, error: TAG_COLORS.red, success: TAG_COLORS.green }[type];
  return (
    <View style={[styles.alert, { backgroundColor: c[1], borderColor: c[2] }]} accessibilityRole="alert">
      <AlertCircle size={16} color={c[0]} />
      <View style={{ flex: 1 }}>
        {!!title && <Text style={[TYPE.h3, { color: c[0], fontSize: 14 }]}>{title}</Text>}
        <Text style={[TYPE.secondary, { color: c[0] }]}>{message}</Text>
      </View>
    </View>
  );
};

// ── States ───────────────────────────────────────────────────────────────────

export const Loading = ({ label = 'Loading…' }: { label?: string }) => (
  <View style={styles.center}><ActivityIndicator size="large" color={TOKENS.colorPrimary} /><Text style={[TYPE.secondary, { marginTop: 8 }]}>{label}</Text></View>
);

export const Empty = ({ title = 'Nothing here yet', description, action }: { title?: string; description?: string; action?: React.ReactNode }) => (
  <View style={[styles.center, { paddingVertical: 40 }]}>
    <Inbox size={36} color={TOKENS.colorTextTertiary} />
    <Text style={[TYPE.h3, { marginTop: 10 }]}>{title}</Text>
    {!!description && <Text style={[TYPE.secondary, { textAlign: 'center', marginTop: 4, maxWidth: 300 }]}>{description}</Text>}
    {!!action && <View style={{ marginTop: 14 }}>{action}</View>}
  </View>
);

export const ErrorView = ({ message, onRetry }: { message: string; onRetry?: () => void }) => (
  <View style={styles.center}>
    <AlertCircle size={32} color={TOKENS.colorError} />
    <Text style={[TYPE.body, { textAlign: 'center', marginTop: 8, maxWidth: 320 }]}>{message}</Text>
    {onRetry && <Button title="Try again" onPress={onRetry} style={{ marginTop: 14 }} />}
  </View>
);

// ── Overlays ─────────────────────────────────────────────────────────────────

export const Sheet = ({ visible, onClose, title, children, footer }: {
  visible: boolean; onClose: () => void; title?: string; children: React.ReactNode; footer?: React.ReactNode;
}) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Pressable style={styles.overlay} onPress={onClose} accessibilityLabel="Close" />
      <View style={styles.sheet}>
        <View style={styles.sheetHead}>
          <Text style={TYPE.h2} numberOfLines={1}>{title}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityLabel="Close"><X size={22} color={TOKENS.colorTextSecondary} /></TouchableOpacity>
        </View>
        <ScrollView style={{ maxHeight: 560 }} contentContainerStyle={{ paddingBottom: 8 }} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
        {footer && <View style={styles.sheetFooter}>{footer}</View>}
      </View>
    </KeyboardAvoidingView>
  </Modal>
);

/** Confirmation dialog; pass `input` to require a reason (e.g. marking a lead Lost). */
export const ConfirmDialog = ({ visible, title, message, confirmText = 'Confirm', danger, onConfirm, onCancel, input, loading }: {
  visible: boolean; title: string; message?: string; confirmText?: string; danger?: boolean; loading?: boolean;
  onConfirm: (text: string) => void; onCancel: () => void; input?: { placeholder: string; required?: boolean };
}) => {
  const [text, setText] = useState('');
  useEffect(() => { if (!visible) setText(''); }, [visible]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.dialogWrap}>
        <View style={styles.dialog} accessibilityViewIsModal>
          <Text style={TYPE.h2}>{title}</Text>
          {!!message && <Text style={[TYPE.secondary, { marginTop: 6 }]}>{message}</Text>}
          {input && <Input value={text} onChangeText={setText} placeholder={input.placeholder} multiline style={{ marginTop: 12, minHeight: 72 }} />}
          <Row style={{ justifyContent: 'flex-end', marginTop: 18 }}>
            <Button title="Cancel" onPress={onCancel} />
            <Button title={confirmText} type={danger ? 'danger' : 'primary'} loading={loading}
                    disabled={!!input?.required && !text.trim()} onPress={() => onConfirm(text.trim())} />
          </Row>
        </View>
      </View>
    </Modal>
  );
};

// ── Toast ────────────────────────────────────────────────────────────────────

type ToastMsg = { id: number; text: string; type: 'success' | 'error' | 'info' };
let toastListener: ((t: ToastMsg) => void) | null = null;
let toastSeq = 0;

/** Non-blocking feedback that works on native and web (Alert buttons don't on web). */
export const toast = (text: string, type: ToastMsg['type'] = 'success') => toastListener?.({ id: ++toastSeq, text, type });

export const ToastHost = () => {
  const [msg, setMsg] = useState<ToastMsg | null>(null);
  useEffect(() => {
    toastListener = t => setMsg(t);
    return () => { toastListener = null; };
  }, []);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 3200);
    return () => clearTimeout(t);
  }, [msg]);
  if (!msg) return null;
  const bg = msg.type === 'error' ? TOKENS.colorError : msg.type === 'info' ? '#262626' : TOKENS.colorSuccess;
  return (
    <View pointerEvents="none" style={styles.toastWrap}>
      <View style={[styles.toast, { backgroundColor: bg }]} accessibilityLiveRegion="polite">
        <Text style={styles.toastText}>{msg.text}</Text>
      </View>
    </View>
  );
};

// ── Formatting ───────────────────────────────────────────────────────────────

export const formatDate = (iso?: string | null, withTime = true) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-IN', withTime
    ? { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }
    : { day: 'numeric', month: 'short', year: 'numeric' });
};

export const formatMoney = (n?: number | string | null) =>
  n === undefined || n === null || n === '' ? '—'
    : `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const timeAgo = (iso?: string | null) => {
  if (!iso) return '';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return formatDate(iso, false);
};

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: TOKENS.colorBgLayout },
  pageContent: { padding: 16, paddingBottom: 40, gap: 14 },
  pageWide: { width: '100%', maxWidth: 900, alignSelf: 'center' },
  section: {
    backgroundColor: TOKENS.colorBgContainer, borderRadius: TOKENS.radiusLg, borderWidth: 1, borderColor: TOKENS.colorBorder,
  },
  sectionHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4,
  },
  sectionBody: { padding: 16, paddingTop: 10, gap: 12 },
  divider: { height: 1, backgroundColor: TOKENS.colorSplit, marginVertical: 4 },
  btn: {
    minHeight: TOKENS.controlHeight, paddingHorizontal: 16, borderRadius: TOKENS.radius, borderWidth: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  btnSm: { minHeight: 36, paddingHorizontal: 12, borderRadius: TOKENS.radiusSm },
  btnText: { fontSize: 14.5, fontWeight: '600' },
  tile: { width: '23%', minWidth: 72, alignItems: 'center', gap: 6, paddingVertical: 8 },
  tileIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  tileLabel: { fontSize: 11.5, fontWeight: '500', color: TOKENS.colorText, textAlign: 'center' },
  tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: TOKENS.radiusSm, borderWidth: 1, alignSelf: 'flex-start' },
  tagSm: { paddingHorizontal: 6, paddingVertical: 1 },
  tagText: { fontSize: 11.5, fontWeight: '600' },
  field: { gap: 6 },
  fieldError: { fontSize: 12, color: TOKENS.colorError },
  input: {
    minHeight: TOKENS.controlHeight, borderWidth: 1, borderColor: TOKENS.colorBorder, borderRadius: TOKENS.radius,
    paddingHorizontal: 12, fontSize: 14.5, color: TOKENS.colorText, backgroundColor: '#FFF',
  },
  textarea: { minHeight: 96, paddingTop: 10, paddingBottom: 10 },
  select: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  searchInput: { flex: 1, fontSize: 14.5, color: TOKENS.colorText, minHeight: 40 },
  option: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: TOKENS.colorSplit, gap: 8 },
  chip: { paddingHorizontal: 14, minHeight: 36, justifyContent: 'center', borderRadius: 18, borderWidth: 1, borderColor: TOKENS.colorBorder, backgroundColor: '#FFF' },
  chipActive: { backgroundColor: TOKENS.colorPrimaryBg, borderColor: TOKENS.colorPrimary },
  chipText: { fontSize: 13, color: TOKENS.colorTextSecondary, fontWeight: '500' },
  chipTextActive: { color: TOKENS.colorPrimary, fontWeight: '700' },
  switch: { width: 46, height: 28, borderRadius: 14, backgroundColor: '#D9D9D9', padding: 3, justifyContent: 'center' },
  switchOn: { backgroundColor: TOKENS.colorPrimary },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFF' },
  knobOn: { alignSelf: 'flex-end' },
  switchRow: { flexDirection: 'row', alignItems: 'center', minHeight: TOKENS.controlHeight },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { backgroundColor: '#FFF', borderRadius: TOKENS.radius, borderWidth: 1, borderColor: TOKENS.colorBorder, padding: 12, gap: 2 },
  statValue: { fontSize: 22, fontWeight: '700', color: TOKENS.colorText },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, minHeight: 52 },
  kv: { flexDirection: 'row', gap: 8, paddingVertical: 3 },
  alert: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: TOKENS.radius, borderWidth: 1, alignItems: 'flex-start' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: TOKENS.colorBgLayout },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { backgroundColor: '#FFF', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, paddingBottom: 28, maxWidth: 720, width: '100%', alignSelf: 'center' },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sheetFooter: { paddingTop: 12, gap: 8 },
  dialogWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  dialog: { backgroundColor: '#FFF', borderRadius: TOKENS.radiusLg, padding: 20, maxWidth: 480, width: '100%', alignSelf: 'center' },
  toastWrap: { position: 'absolute', left: 16, right: 16, bottom: 48, alignItems: 'center' },
  toast: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: TOKENS.radius, maxWidth: 480 },
  toastText: { color: '#FFF', fontSize: 14, fontWeight: '500' },
});
