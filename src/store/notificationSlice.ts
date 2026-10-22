import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface NotificationState {
  lastSeenAt: string | null;
  hasUnread: boolean;
  unreadCount: number;
}

const initialState: NotificationState = { lastSeenAt: null, hasUnread: false, unreadCount: 0 };

const notificationSlice = createSlice({
  name: 'notification',
  initialState,
  reducers: {
    setHasUnread(state, action: PayloadAction<boolean>) {
      state.hasUnread = action.payload;
    },
    setUnreadCount(state, action: PayloadAction<number>) {
      state.unreadCount = action.payload;
      state.hasUnread = action.payload > 0;
    },
    markAllSeen(state, action: PayloadAction<string>) {
      state.lastSeenAt = action.payload;
      state.hasUnread = false;
    },
  },
});

export const { setHasUnread, setUnreadCount, markAllSeen } = notificationSlice.actions;
export default notificationSlice.reducer;
