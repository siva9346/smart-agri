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

const initialState: LandState = { lands: [] };

const landSlice = createSlice({
  name: 'land',
  initialState,
  reducers: {
    setLands(state, action: PayloadAction<Land[]>) {
      state.lands = action.payload;
    },
    addLand(state, action: PayloadAction<Land>) {
      state.lands.push(action.payload);
    },
  },
});

export const { setLands, addLand } = landSlice.actions;
export default landSlice.reducer;
