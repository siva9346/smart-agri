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

const initialState: CustomerState = {
  customers: [
    { id: 'c1', name: 'Murugan', village: 'Avadi', phone: '9876543210', email: 'murugan@example.com', landsCount: 2 },
    { id: 'c2', name: 'Suresh Anna', village: 'Madurai', phone: '9876543211', email: 'suresh@example.com', landsCount: 1 },
  ],
};

const customerSlice = createSlice({
  name: 'customer',
  initialState,
  reducers: {
    addCustomer: (state, action: PayloadAction<Customer>) => {
      state.customers.push(action.payload);
    },
  },
});

export const { addCustomer } = customerSlice.actions;
export default customerSlice.reducer;
