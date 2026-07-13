import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface DailyRecord {
  id: string;
  cropCycleId: string;
  date: string;
  stage: string;
  costType: string;
  activityType?: string;
  expense: number;
  incomeAmount?: number;
  quantity?: string;
  notes: string;
  image?: string;
  createdAt?: string;
  updatedAt?: string;
  // Admin Advice fields (activityType === 'Admin Advice')
  title?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  recommendedAction?: string;
}

export interface CropCycle {
  id: string;
  landId: string;
  cropName: string;
  startDate: string;
  endDate?: string;
  area?: string;
  cropAge: number;
  status: 'current' | 'completed' | 'active';
  records?: DailyRecord[];
}

export interface CropState {
  cropCycles: CropCycle[];
  dailyRecords: DailyRecord[];
  recordsByCycleId: Record<string, DailyRecord[]>;
}

function buildRecordIndex(records: DailyRecord[]): Record<string, DailyRecord[]> {
  const idx: Record<string, DailyRecord[]> = {};
  for (const r of records) {
    if (!idx[r.cropCycleId]) idx[r.cropCycleId] = [];
    idx[r.cropCycleId].push(r);
  }
  return idx;
}

const initialState: CropState = {
  cropCycles: [],
  dailyRecords: [],
  recordsByCycleId: {},
};

const cropSlice = createSlice({
  name: 'crop',
  initialState,
  reducers: {
    setCropCycles(state, action: PayloadAction<CropCycle[]>) {
      state.cropCycles = action.payload;
      // Rebuild index when cycles are loaded (records come separately)
    },
    setRecords(state, action: PayloadAction<{ cycleId: string; records: DailyRecord[] }>) {
      const { cycleId, records } = action.payload;
      // Remove old records for this cycle then re-add
      state.dailyRecords = [
        ...state.dailyRecords.filter(r => r.cropCycleId !== cycleId),
        ...records,
      ];
      state.recordsByCycleId[cycleId] = records;
    },
    addRecord(state, action: PayloadAction<DailyRecord>) {
      state.dailyRecords.push(action.payload);
      const cycleId = action.payload.cropCycleId;
      if (!state.recordsByCycleId[cycleId]) state.recordsByCycleId[cycleId] = [];
      state.recordsByCycleId[cycleId].push(action.payload);
    },
    updateRecord(state, action: PayloadAction<DailyRecord>) {
      const updated = action.payload;
      const i1 = state.dailyRecords.findIndex(r => r.id === updated.id);
      if (i1 !== -1) state.dailyRecords[i1] = updated;
      const list = state.recordsByCycleId[updated.cropCycleId];
      if (list) {
        const i2 = list.findIndex(r => r.id === updated.id);
        if (i2 !== -1) list[i2] = updated;
      }
    },
    removeRecord(state, action: PayloadAction<{ id: string; cropCycleId: string }>) {
      const { id, cropCycleId } = action.payload;
      state.dailyRecords = state.dailyRecords.filter(r => r.id !== id);
      if (state.recordsByCycleId[cropCycleId]) {
        state.recordsByCycleId[cropCycleId] = state.recordsByCycleId[cropCycleId].filter(r => r.id !== id);
      }
    },
    addCropCycle(state, action: PayloadAction<CropCycle>) {
      state.cropCycles.push(action.payload);
      if (!state.recordsByCycleId[action.payload.id]) {
        state.recordsByCycleId[action.payload.id] = [];
      }
    },
    updateCropStatus(state, action: PayloadAction<{ id: string; status: 'current' | 'completed' | 'active' }>) {
      const cycle = state.cropCycles.find(cc => cc.id === action.payload.id);
      if (cycle) cycle.status = action.payload.status;
    },
    completeCycle(state, action: PayloadAction<{ id: string; endDate: string }>) {
      const cycle = state.cropCycles.find(cc => cc.id === action.payload.id);
      if (cycle) {
        cycle.status = 'completed';
        cycle.endDate = action.payload.endDate;
      }
    },
  },
});

export const {
  setCropCycles, setRecords, addRecord, updateRecord, removeRecord,
  addCropCycle, updateCropStatus, completeCycle,
} = cropSlice.actions;
export default cropSlice.reducer;
