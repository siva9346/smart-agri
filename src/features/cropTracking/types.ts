export type CostType =
  | 'Ploughing'
  | 'Seed'
  | 'Labour'
  | 'Weeding'
  | 'Fertilizer'
  | 'Fertilizer Applied'
  | 'Pesticide'
  | 'Irrigation'
  | 'Transport'
  | 'Harvesting'
  | 'Enquiry'
  | 'Expert Advice'
  | 'Others';

export type Stage = 'cleaning' | 'planting' | 'fertilizer' | 'harvesting';

export interface Land {
  id: string;
  farmerName: string;
  village: string;
  size: string;
  currentCrop?: string;
  cropAge?: number;
}

export interface CropCycle {
  id: string;
  landId: string;
  cropName: string;
  startDate: string;
  cropAge: number;
  status: 'current' | 'completed' | 'active';
}

export interface DailyRecord {
  id: string;
  cropCycleId: string;
  date: string;
  stage: Stage;
  image?: string;
  notes: string;
  expense: number;
  costType: CostType;
}
