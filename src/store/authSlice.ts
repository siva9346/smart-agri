import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { setAuthToken } from '../services/api';
import { UserRole } from '../types/domain';

export interface AuthUser {
  userId: string;
  name: string;
  role: UserRole;
  phone: string;
  /** Effective permissions from the backend — used only to shape the UI. */
  permissions?: string[];
}

interface AuthState {
  user: AuthUser | null;
}

const initialState: AuthState = { user: null };

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginSuccess(state, action: PayloadAction<{ user: AuthUser; token: string }>) {
      state.user = action.payload.user;
      setAuthToken(action.payload.token);
    },
    updateUser(state, action: PayloadAction<Partial<AuthUser>>) {
      if (state.user) state.user = { ...state.user, ...action.payload };
    },
    logout(state) {
      state.user = null;
      setAuthToken(null);
    },
  },
});

export const { loginSuccess, updateUser, logout } = authSlice.actions;
export default authSlice.reducer;
