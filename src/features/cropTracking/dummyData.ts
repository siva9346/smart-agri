import { Land, CropCycle, DailyRecord } from './types';

export const DUMMY_LANDS: Land[] = [
  { id: 'l1', farmerName: 'Murugan', village: 'Kaveri Nagar', size: '2 Acres', currentCrop: 'Rice', cropAge: 45 },
  { id: 'l2', farmerName: 'Murugan', village: 'South Field', size: '1.5 Acres', currentCrop: 'Banana', cropAge: 120 },
];

export const DUMMY_CROP_CYCLES: CropCycle[] = [
  { id: 'cc1', landId: 'l1', cropName: 'Rice', startDate: '2026-02-04', cropAge: 45, status: 'active' },
  { id: 'cc2', landId: 'l1', cropName: 'Groundnut', startDate: '2025-10-10', cropAge: 100, status: 'completed' },
  { id: 'cc3', landId: 'l2', cropName: 'Banana', startDate: '2025-11-20', cropAge: 120, status: 'active' },
];

export const INITIAL_DAILY_RECORDS: DailyRecord[] = [
  { 
    id: 'dr1', 
    cropCycleId: 'cc1', 
    date: '2026-03-20', 
    stage: 'fertilizer', 
    notes: 'Applied Urea and Potash', 
    expense: 2500, 
    costType: 'Fertilizer' 
  },
  { 
    id: 'dr2', 
    cropCycleId: 'cc1', 
    date: '2026-03-20', 
    stage: 'planting', 
    notes: 'Manual weeding', 
    expense: 1500, 
    costType: 'Labour' 
  },
  { 
    id: 'dr3', 
    cropCycleId: 'cc1', 
    date: '2026-02-04', 
    stage: 'cleaning', 
    notes: 'Tractor ploughing', 
    expense: 5000, 
    costType: 'Ploughing' 
  },
  { 
    id: 'dr4', 
    cropCycleId: 'cc3', 
    date: '2026-03-20', 
    stage: 'fertilizer', 
    notes: 'NPK application', 
    expense: 3000, 
    costType: 'Fertilizer' 
  },
];
