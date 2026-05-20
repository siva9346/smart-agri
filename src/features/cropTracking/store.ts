import { DailyRecord, Land, CropCycle } from './types';
import { INITIAL_DAILY_RECORDS, DUMMY_LANDS, DUMMY_CROP_CYCLES } from './dummyData';

class CropTrackingStore {
  private records: DailyRecord[] = [...INITIAL_DAILY_RECORDS];

  getRecords(cropCycleId: string, date?: string) {
    let filtered = this.records.filter(r => r.cropCycleId === cropCycleId);
    if (date) {
      filtered = filtered.filter(r => r.date === date);
    }
    return filtered;
  }

  addRecord(record: DailyRecord) {
    this.records.push(record);
  }

  getTotalExpense(cropCycleId: string) {
    return this.records
      .filter(r => r.cropCycleId === cropCycleId)
      .reduce((sum, r) => sum + r.expense, 0);
  }

  getCostTypeBreakdown(cropCycleId: string) {
    const breakdown: Record<string, number> = {};
    this.records
      .filter(r => r.cropCycleId === cropCycleId)
      .forEach(r => {
        breakdown[r.costType] = (breakdown[r.costType] || 0) + r.expense;
      });
    return breakdown;
  }

  getLands(): Land[] {
    return DUMMY_LANDS;
  }

  getCropCycles(landId: string): CropCycle[] {
    return DUMMY_CROP_CYCLES.filter(cc => cc.landId === landId);
  }

  getCropCycleById(id: string): CropCycle | undefined {
    return DUMMY_CROP_CYCLES.find(cc => cc.id === id);
  }
}

export const cropStore = new CropTrackingStore();
