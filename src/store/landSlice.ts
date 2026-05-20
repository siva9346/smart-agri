import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface Land {
  id: string;
  customerId: string;
  farmerName: string;
  village: string;
  size: string;
  soil: string;
  latitude?: number;
  longitude?: number;
}

export interface LandState {
  lands: Land[];
}

const initialState: LandState = {
  lands: [
    { id: 'l1', customerId: 'c1', farmerName: 'Murugan', village: 'Avadi', size: '2.5 acres', soil: 'Black soil' },
    { id: 'l2', customerId: 'c1', farmerName: 'Murugan', village: 'South Field', size: '1.2 acres', soil: 'Red soil' },
  ],
};

const landSlice = createSlice({
  name: 'land',
  initialState,
  reducers: {
    addLand: (state, action: PayloadAction<Land>) => {
      state.lands.push(action.payload);
    },
  },
});

export const { addLand } = landSlice.actions;
export default landSlice.reducer;
