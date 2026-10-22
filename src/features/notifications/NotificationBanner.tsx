import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, AppState } from 'react-native';
import { useDispatch } from 'react-redux';
import { Bell, X, AlertTriangle } from 'lucide-react-native';
import { inboxApi, InboxItem } from '../../services/platform';
import { refreshUnreadCount } from './useUnreadNotifications';
import { openActionLink } from '../../navigation/actionLinks';
import { navigationRef } from '../../navigation/navigationRef';
import { useAuth } from '../../hooks/useApi';
import { TOKENS, TYPE } from '../../theme';

const POLL_MS = 60_000;

/**
 * Top-of-app banner for the newest notification whose banner is still active.
 * Visibility is decided by the server (dismissed / read > 24h / expired /
 * scheduled), so it survives restarts and is independent per user.
 *   – tap  → marks read and opens its action link (banner then stays until 24h after reading)
 *   – X    → dismisses immediately WITHOUT marking read (it stays unread in the Notification Center)
 */
export const NotificationBanner = () => {
  const dispatch = useDispatch();
  const { role } = useAuth();
  const [items, setItems] = useState<InboxItem[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await inboxApi.banners();
      setItems(res.items);
    } catch {
      // banner is best-effort; Notification Center remains the source of truth
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    const sub = AppState.addEventListener('change', s => { if (s === 'active') load(); });
    return () => { clearInterval(t); sub.remove(); };
  }, [load]);

  const top = items[0];
  if (!top) return null;

  const dismiss = async () => {
    setItems(prev => prev.slice(1)); // hide immediately; persist in background
    try { await inboxApi.dismiss(top.recipientKey); } catch { load(); }
  };

  const open = async () => {
    try {
      if (!top.isRead) {
        await inboxApi.read(top.recipientKey);
        refreshUnreadCount(dispatch);
      }
    } catch {
      // ignore — opening still works
    }
    if (!openActionLink(top.actionLink, role) && navigationRef.isReady()) (navigationRef as any).navigate('Notifications');
    load();
  };

  const important = top.priority === 'HIGH' || top.type === 'IMPORTANT' || top.type === 'MAINTENANCE' || top.type === 'ESCALATION';
  return (
    <View style={[styles.wrap, important && styles.important]} accessibilityRole="alert">
      <TouchableOpacity style={styles.body} onPress={open} activeOpacity={0.7}
                        accessibilityLabel={`Notification: ${top.title}. Opens details.`}>
        {important ? <AlertTriangle size={18} color={TOKENS.colorWarning} /> : <Bell size={18} color={TOKENS.colorPrimary} />}
        <View style={{ flex: 1 }}>
          <Text style={[TYPE.h3, { fontSize: 14 }, !top.isRead && { fontWeight: '700' }]} numberOfLines={1}>{top.title}</Text>
          <Text style={TYPE.secondary} numberOfLines={2}>{top.message}</Text>
        </View>
        {items.length > 1 && <Text style={styles.more}>+{items.length - 1}</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={dismiss} style={styles.close} hitSlop={10} accessibilityRole="button"
                        accessibilityLabel="Dismiss notification banner">
        <X size={18} color={TOKENS.colorTextSecondary} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: 12, marginTop: 8, marginBottom: 4,
    backgroundColor: '#FFF', borderRadius: TOKENS.radius, borderWidth: 1, borderColor: TOKENS.colorPrimaryBorder,
    borderLeftWidth: 4, borderLeftColor: TOKENS.colorPrimary,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  important: { borderColor: '#FFE58F', borderLeftColor: TOKENS.colorWarning },
  body: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingLeft: 12 },
  more: { fontSize: 12, fontWeight: '700', color: TOKENS.colorTextSecondary },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
