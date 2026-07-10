import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface Customer {
  id: string;
  name: string;
  village: string;
  phone: string;
  email?: string;
  landsCount: number;
}

export interface CustomerState {
  customers: Customer[];
}

const initialState: CustomerState = { customers: [] };

const customerSlice = createSlice({
  name: 'customer',
  initialState,
  reducers: {
    setCustomers(state, action: PayloadAction<Customer[]>) {
      state.customers = action.payload;
    },
    addCustomer(state, action: PayloadAction<Customer>) {
      state.customers.unshift(action.payload);
    },
  },
});

export const { setCustomers, addCustomer } = customerSlice.actions;
export default customerSlice.reducer;
