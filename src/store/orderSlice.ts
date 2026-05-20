import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface Order {
  id: string;
  customerId: string;
  items: any[];
  total: number;
  status: string;
  date: string;
}

export interface OrderState {
  orders: Order[];
}

const initialState: OrderState = {
  orders: [],
};

const orderSlice = createSlice({
  name: 'order',
  initialState,
  reducers: {
    addOrder: (state, action: PayloadAction<Order>) => {
      state.orders.push(action.payload);
    },
  },
});

export const { addOrder } = orderSlice.actions;
export default orderSlice.reducer;
