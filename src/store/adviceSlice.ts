import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface ExpertAdviceRequest {
  id: string;
  farmerId: string;
  farmerName: string;
  title: string;
  description: string;
  status: 'Pending' | 'Completed';
  createdAt: string;
  adminResponse?: string;
  respondedAt?: string;
}

interface AdviceState {
  requests: ExpertAdviceRequest[];
}

const initialState: AdviceState = { requests: [] };

const adviceSlice = createSlice({
  name: 'advice',
  initialState,
  reducers: {
    setAdviceRequests(state, action: PayloadAction<ExpertAdviceRequest[]>) {
      state.requests = action.payload;
    },
    submitAdviceRequest(state, action: PayloadAction<ExpertAdviceRequest>) {
      state.requests.unshift(action.payload);
    },
    respondToAdvice(state, action: PayloadAction<{ id: string; response: string }>) {
      const req = state.requests.find(r => r.id === action.payload.id);
      if (req) {
        req.adminResponse = action.payload.response;
        req.status = 'Completed';
        req.respondedAt = new Date().toISOString().split('T')[0];
      }
    },
  },
});

export const { setAdviceRequests, submitAdviceRequest, respondToAdvice } = adviceSlice.actions;
export default adviceSlice.reducer;
