import { AppDispatch } from '.';
import { logout } from './authSlice';
import { unregisterPush } from '../services/push';

/** Log out, first detaching this device from the user's push notifications. */
export const signOut = () => async (dispatch: AppDispatch) => {
  await unregisterPush();
  dispatch(logout());
};
