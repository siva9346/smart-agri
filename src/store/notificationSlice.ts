import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface NotificationState {
  lastSeenAt: string | null;
  hasUnread: boolean;
}

const initialState: NotificationState = { lastSeenAt: null, hasUnread: false };

const notificationSlice = createSlice({
  name: 'notification',
  initialState,
  reducers: {
    setHasUnread(state, action: PayloadAction<boolean>) {
      state.hasUnread = action.payload;
    },
    markAllSeen(state, action: PayloadAction<string>) {
      state.lastSeenAt = action.payload;
      state.hasUnread = false;
    },
  },
});

export const { setHasUnread, markAllSeen } = notificationSlice.actions;
export default notificationSlice.reducer;
