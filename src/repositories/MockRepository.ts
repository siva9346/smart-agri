import { ApiResponse } from '../types/api';
import { 
  User, Land, FertilizerProduct, PurchaseHistory, 
  Symptom, RainData, Enquiry 
} from '../types/domain';
import { IAuthRepository, IFarmerRepository, IAdminRepository } from './interfaces';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const MOCK_USER: User = {
  id: '1',
  phone: '1234567890',
  name: 'Murugan',
  role: 'FARMER'
};

const MOCK_ADMIN: User = {
  id: '2',
  phone: '0987654321',
  name: 'Ramdas Admin',
  role: 'ADMIN'
};

export class MockRepository implements IAuthRepository, IFarmerRepository, IAdminRepository {
  // Auth
  async login(phone: string, otp: string): Promise<ApiResponse<User>> {
    await delay(1000);
    if (phone === '1234567890') {
      return { success: true, data: MOCK_USER, message: 'Login successful', error: null };
    } else if (phone === '9999999999') {
        return { success: true, data: MOCK_ADMIN, message: 'Admin Login successful', error: null };
    }
    return { success: false, data: {} as User, message: null, error: 'Invalid phone or OTP' };
  }

  // Farmer
  async getLands(farmerId: string): Promise<ApiResponse<Land[]>> {
    await delay(800);
    return {
      success: true,
      data: [
        { id: '1', farmerId, area: '2 Acres', cropType: 'Rice', location: 'North Field' },
        { id: '2', farmerId, area: '1.5 Acres', cropType: 'Wheat', location: 'East Field' },
      ],
      message: null,
      error: null
    };
  }

  async addLand(land: Omit<Land, 'id'>): Promise<ApiResponse<Land>> {
    await delay(1000);
    return { success: true, data: { ...land, id: Math.random().toString() }, message: 'Land added', error: null };
  }

  async getFertilizers(): Promise<ApiResponse<FertilizerProduct[]>> {
    await delay(800);
    return {
      success: true,
      data: [
        { id: '1', name: 'Urea', description: 'High nitrogen fertilizer', price: 500, stock: 100 },
        { id: '2', name: 'DAP', description: 'Phosphate rich fertilizer', price: 800, stock: 50 },
      ],
      message: null,
      error: null
    };
  }

  async purchaseFertilizer(farmerId: string, productId: string, quantity: number): Promise<ApiResponse<PurchaseHistory>> {
    await delay(1200);
    return {
      success: true,
      data: {
        id: Math.random().toString(),
        productId,
        productName: 'Urea',
        quantity,
        totalPrice: quantity * 500,
        date: new Date().toISOString(),
        status: 'COMPLETED'
      },
      message: 'Purchase successful',
      error: null
    };
  }

  async getPurchaseHistory(farmerId: string): Promise<ApiResponse<PurchaseHistory[]>> {
    await delay(800);
    return {
      success: true,
      data: [
        { id: '1', productId: '1', productName: 'Urea', quantity: 2, totalPrice: 1000, date: '2023-10-01', status: 'COMPLETED' }
      ],
      message: null,
      error: null
    };
  }

  async bookEnquiry(enquiry: Omit<Enquiry, 'id' | 'createdAt' | 'status'>): Promise<ApiResponse<Enquiry>> {
    await delay(1000);
    return {
      success: true,
      data: { ...enquiry, id: 'e1', createdAt: new Date().toISOString(), status: 'OPEN' },
      message: 'Enquiry submitted',
      error: null
    };
  }

  async getSymptoms(): Promise<ApiResponse<Symptom[]>> {
    await delay(800);
    return {
      success: true,
      data: [
        { id: '1', title: 'Yellow Leaves', description: 'Leaves turning yellow from edges', solution: 'Increase nitrogen' },
      ],
      message: null,
      error: null
    };
  }

  async getRainUpdates(): Promise<ApiResponse<RainData[]>> {
    await delay(800);
    return {
      success: true,
      data: [
        { id: '1', date: '2023-10-25', rainfall: '10mm', location: 'District A' }
      ],
      message: null,
      error: null
    };
  }

  // Admin
  async addCustomer(customer: Omit<User, 'id' | 'role'>): Promise<ApiResponse<User>> {
    await delay(1000);
    return { success: true, data: { ...customer, id: 'c1', role: 'FARMER' }, message: 'Customer added', error: null };
  }

  async getCustomers(): Promise<ApiResponse<User[]>> {
    await delay(800);
    return { success: true, data: [MOCK_USER], message: null, error: null };
  }

  async updateCustomerLand(land: Land): Promise<ApiResponse<Land>> {
    await delay(1000);
    return { success: true, data: land, message: 'Land updated', error: null };
  }

  async updateStock(productId: string, stock: number): Promise<ApiResponse<FertilizerProduct>> {
    await delay(1000);
    return { success: true, data: { id: productId, name: 'Urea', description: '', price: 500, stock }, message: 'Stock updated', error: null };
  }

  async updatePrice(productId: string, price: number): Promise<ApiResponse<FertilizerProduct>> {
    await delay(1000);
    return { success: true, data: { id: productId, name: 'Urea', description: '', price, stock: 100 }, message: 'Price updated', error: null };
  }

  async addFertilizer(product: Omit<FertilizerProduct, 'id'>): Promise<ApiResponse<FertilizerProduct>> {
    await delay(1000);
    return { success: true, data: { ...product, id: 'p1' }, message: 'Product added', error: null };
  }

  async getEnquiries(): Promise<ApiResponse<Enquiry[]>> {
    await delay(800);
    return { success: true, data: [], message: null, error: null };
  }

  async updateSymptom(symptom: Symptom): Promise<ApiResponse<Symptom>> {
    await delay(1000);
    return { success: true, data: symptom, message: 'Symptom updated', error: null };
  }

  async updateRainData(data: RainData): Promise<ApiResponse<RainData>> {
    await delay(1000);
    return { success: true, data, message: 'Rain data updated', error: null };
  }
}

export const mockRepository = new MockRepository();
