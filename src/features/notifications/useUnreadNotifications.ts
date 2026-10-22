import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useDispatch } from 'react-redux';
import { inboxApi } from '../../services/platform';
import { setUnreadCount } from '../../store/notificationSlice';

const POLL_INTERVAL_MS = 60_000;

// Polls the server-side unread count (per-user read state) while the app is
// active, so the bell badge reflects what was actually read on any device.
export const useUnreadNotifications = (enabled: boolean) => {
  const dispatch = useDispatch();

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    const check = async () => {
      try {
        const res = await inboxApi.unreadCount();
        if (!cancelled) dispatch(setUnreadCount(res.count));
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

export const refreshUnreadCount = async (dispatch: (a: any) => void) => {
  try {
    const res = await inboxApi.unreadCount();
    dispatch(setUnreadCount(res.count));
  } catch {
    // ignore
  }
};
