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

const initialState: AdviceState = {
  requests: [
    {
      id: 'adv1',
      farmerId: '1',
      farmerName: 'Murugan',
      title: 'Yellow spots on paddy leaves',
      description: 'My paddy crop has developed yellow spots on the lower leaves. This started 3 days ago and is spreading fast. Heavy rainfall last week.',
      status: 'Completed',
      createdAt: '2026-04-10',
      adminResponse: 'Apply Propiconazole fungicide at 1ml per litre of water. Ensure good field drainage and temporarily reduce nitrogen application.',
      respondedAt: '2026-04-11',
    },
    {
      id: 'adv2',
      farmerId: '1',
      farmerName: 'Murugan',
      title: 'Best fertilizer schedule for banana second cycle',
      description: 'Starting second banana cultivation on 1.5 acres. Need a complete fertilizer schedule recommendation for the first 3 months.',
      status: 'Pending',
      createdAt: '2026-04-28',
    },
  ],
};

const adviceSlice = createSlice({
  name: 'advice',
  initialState,
  reducers: {
    submitAdviceRequest: (state, action: PayloadAction<ExpertAdviceRequest>) => {
      state.requests.unshift(action.payload);
    },
    respondToAdvice: (state, action: PayloadAction<{ id: string; response: string }>) => {
      const req = state.requests.find(r => r.id === action.payload.id);
      if (req) {
        req.adminResponse = action.payload.response;
        req.status = 'Completed';
        req.respondedAt = new Date().toISOString().split('T')[0];
      }
    },
  },
});

export const { submitAdviceRequest, respondToAdvice } = adviceSlice.actions;
export default adviceSlice.reducer;
