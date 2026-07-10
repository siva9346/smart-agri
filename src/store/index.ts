import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import customerReducer from './customerSlice';
import landReducer from './landSlice';
import cropReducer from './cropSlice';
import orderReducer from './orderSlice';
import cartReducer from './cartSlice';
import adviceReducer from './adviceSlice';

export const store = configureStore({
  reducer: {
    auth:     authReducer,
    customer: customerReducer,
    land:     landReducer,
    crop:     cropReducer,
    order:    orderReducer,
    cart:     cartReducer,
    advice:   adviceReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
