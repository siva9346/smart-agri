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
  /** O(1) lookup: cycleId → records for that cycle */
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

const SEED_RECORDS: DailyRecord[] = [
  // ── Paddy (cc1) ─────────────────────────────────────────────────────────────
  { id: 'r1',  cropCycleId: 'cc1', date: '2026-03-01', stage: 'Expense',            costType: 'SEED',               activityType: 'Expense',          expense: 5500,  notes: 'Bought high-yield IR20 seeds.' },
  { id: 'r2',  cropCycleId: 'cc1', date: '2026-03-05', stage: 'Expense',            costType: 'LABOUR',             activityType: 'Expense',          expense: 4200,  notes: 'Primary ploughing with tractor.' },
  { id: 'r3',  cropCycleId: 'cc1', date: '2026-03-10', stage: 'Weekly Condition',   costType: 'Weekly Condition',   activityType: 'Weekly Condition', expense: 0,     notes: 'Good germination observed. Soil moisture adequate.' },
  { id: 'r4',  cropCycleId: 'cc1', date: '2026-03-12', stage: 'Irrigation',         costType: 'Irrigation',         activityType: 'Irrigation',       expense: 1800,  notes: 'First irrigation cycle completed.' },
  { id: 'r5',  cropCycleId: 'cc1', date: '2026-03-18', stage: 'Symptom',            costType: 'Symptom',            activityType: 'Symptom',          expense: 0,     notes: 'Yellow discoloration noticed on lower leaves. Possibly nitrogen deficiency.' },
  { id: 'r6',  cropCycleId: 'cc1', date: '2026-03-20', stage: 'Fertilizer Applied', costType: 'Fertilizer Applied', activityType: 'Fertilizer Applied', expense: 2500, notes: 'Applied Urea and Potash to address yellowing.' },
  { id: 'r7',  cropCycleId: 'cc1', date: '2026-03-22', stage: 'Advice Received',    costType: 'Advice Received',    activityType: 'Advice Received',  expense: 0,     notes: 'Expert advised: Apply Propiconazole fungicide at 1ml/litre. Reduce standing water.' },
  // ── Groundnut (cc2) ──────────────────────────────────────────────────────────
  { id: 'r8',  cropCycleId: 'cc2', date: '2025-10-05', stage: 'Expense',            costType: 'PLOUGHING',          activityType: 'Expense',          expense: 3000,  notes: 'Tractor ploughing.' },
  { id: 'r9',  cropCycleId: 'cc2', date: '2025-10-10', stage: 'Expense',            costType: 'SEED',               activityType: 'Expense',          expense: 2200,  notes: 'Groundnut seeds purchased — 40 kg.' },
  { id: 'r10', cropCycleId: 'cc2', date: '2026-01-10', stage: 'Harvest / Income',   costType: 'Harvest / Income',   activityType: 'Harvest / Income', expense: 0,     incomeAmount: 22000, quantity: '3 tons', notes: 'Final groundnut harvest — good yield, 3 tons. Sold at ₹7,333/ton.' },
  // ── Banana (cc3) ─────────────────────────────────────────────────────────────
  { id: 'r11', cropCycleId: 'cc3', date: '2026-02-15', stage: 'Expense',            costType: 'SEED',               activityType: 'Expense',          expense: 4000,  notes: 'Banana saplings planted.' },
  { id: 'r12', cropCycleId: 'cc3', date: '2026-03-01', stage: 'Weekly Condition',   costType: 'Weekly Condition',   activityType: 'Weekly Condition', expense: 0,     notes: 'Heavy rain this week. Field waterlogged in one corner.' },
  { id: 'r13', cropCycleId: 'cc3', date: '2026-03-20', stage: 'Fertilizer Applied', costType: 'Fertilizer Applied', activityType: 'Fertilizer Applied', expense: 3000, notes: 'NPK application.' },
  { id: 'r14', cropCycleId: 'cc3', date: '2026-04-15', stage: 'Harvest / Income',   costType: 'Harvest / Income',   activityType: 'Harvest / Income', expense: 0,     incomeAmount: 8500, quantity: '85 bunches', notes: 'First batch harvest — 85 bunches at ₹100 each.' },
  { id: 'r15', cropCycleId: 'cc3', date: '2026-05-01', stage: 'Harvest / Income',   costType: 'Harvest / Income',   activityType: 'Harvest / Income', expense: 0,     incomeAmount: 11200, quantity: '112 bunches', notes: 'Second batch — 112 bunches, larger size, ₹100 each.' },
];

const initialState: CropState = {
  cropCycles: [
    { id: 'cc1', landId: 'l1', cropName: 'Paddy',     startDate: '2026-03-01', area: '2 Acres',   cropAge: 0, status: 'current' },
    { id: 'cc2', landId: 'l1', cropName: 'Groundnut', startDate: '2025-10-01', endDate: '2026-01-15', area: '2 Acres', cropAge: 0, status: 'completed' },
    { id: 'cc3', landId: 'l2', cropName: 'Banana',    startDate: '2026-02-15', area: '1.5 Acres', cropAge: 0, status: 'current' },
  ],
  dailyRecords: SEED_RECORDS,
  recordsByCycleId: buildRecordIndex(SEED_RECORDS),
};

const cropSlice = createSlice({
  name: 'crop',
  initialState,
  reducers: {
    addRecord: (state, action: PayloadAction<DailyRecord>) => {
      state.dailyRecords.push(action.payload);
      // Keep index in sync — O(1) insert
      const cycleId = action.payload.cropCycleId;
      if (!state.recordsByCycleId[cycleId]) state.recordsByCycleId[cycleId] = [];
      state.recordsByCycleId[cycleId].push(action.payload);
    },
    addCropCycle: (state, action: PayloadAction<CropCycle>) => {
      state.cropCycles.push(action.payload);
      // Pre-initialise an empty bucket so first addRecord is O(1)
      if (!state.recordsByCycleId[action.payload.id]) {
        state.recordsByCycleId[action.payload.id] = [];
      }
    },
    updateCropStatus: (state, action: PayloadAction<{ id: string; status: 'current' | 'completed' | 'active' }>) => {
      const cycle = state.cropCycles.find(cc => cc.id === action.payload.id);
      if (cycle) cycle.status = action.payload.status;
    },
    completeCycle: (state, action: PayloadAction<{ id: string; endDate: string }>) => {
      const cycle = state.cropCycles.find(cc => cc.id === action.payload.id);
      if (cycle) {
        cycle.status = 'completed';
        cycle.endDate = action.payload.endDate;
      }
    },
  },
});

export const { addRecord, addCropCycle, updateCropStatus, completeCycle } = cropSlice.actions;
export default cropSlice.reducer;
