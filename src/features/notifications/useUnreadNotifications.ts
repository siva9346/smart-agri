import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { api } from '../../services/api';
import { RootState } from '../../store';
import { setHasUnread } from '../../store/notificationSlice';

const POLL_INTERVAL_MS = 60_000;

// Polls for new notifications while the app is active and flags the Bell icon
// when any notification is newer than the user's last-seen point.
export const useUnreadNotifications = (enabled: boolean) => {
  const dispatch = useDispatch();
  const lastSeenAt = useSelector((s: RootState) => s.notification.lastSeenAt);
  const lastSeenRef = useRef(lastSeenAt);
  lastSeenRef.current = lastSeenAt;

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    const check = async () => {
      try {
        const res = await api.get<{ items: { createdAt: string }[] }>('/notifications');
        if (cancelled) return;
        const seen = lastSeenRef.current;
        const hasNew = seen ? res.items.some(n => n.createdAt > seen) : res.items.length > 0;
        dispatch(setHasUnread(hasNew));
      } catch {
        // Silent — badge simply won't update this cycle; next poll retries.
      }
    };

    check();
    const interval = setInterval(check, POLL_INTERVAL_MS);
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') check();
    });
    return () => {
      cancelled = true;
      clearInterval(interval);
      sub.remove();
    };
  }, [enabled, dispatch]);
};
