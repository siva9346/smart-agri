import { ApiResponse } from '../types/api';
import { 
  User, Land, FertilizerProduct, PurchaseHistory, 
  Symptom, RainData, Enquiry 
} from '../types/domain';

export interface IAuthRepository {
  login(phone: string, otp: string): Promise<ApiResponse<User>>;
}

export interface IFarmerRepository {
  getLands(farmerId: string): Promise<ApiResponse<Land[]>>;
  addLand(land: Omit<Land, 'id'>): Promise<ApiResponse<Land>>;
  getFertilizers(): Promise<ApiResponse<FertilizerProduct[]>>;
  purchaseFertilizer(farmerId: string, productId: string, quantity: number): Promise<ApiResponse<PurchaseHistory>>;
  getPurchaseHistory(farmerId: string): Promise<ApiResponse<PurchaseHistory[]>>;
  bookEnquiry(enquiry: Omit<Enquiry, 'id' | 'createdAt' | 'status'>): Promise<ApiResponse<Enquiry>>;
  getSymptoms(): Promise<ApiResponse<Symptom[]>>;
  getRainUpdates(): Promise<ApiResponse<RainData[]>>;
}

export interface IAdminRepository {
  addCustomer(customer: Omit<User, 'id' | 'role'>): Promise<ApiResponse<User>>;
  getCustomers(): Promise<ApiResponse<User[]>>;
  updateCustomerLand(land: Land): Promise<ApiResponse<Land>>;
  updateStock(productId: string, stock: number): Promise<ApiResponse<FertilizerProduct>>;
  updatePrice(productId: string, price: number): Promise<ApiResponse<FertilizerProduct>>;
  addFertilizer(product: Omit<FertilizerProduct, 'id'>): Promise<ApiResponse<FertilizerProduct>>;
  getEnquiries(): Promise<ApiResponse<Enquiry[]>>;
  updateSymptom(symptom: Symptom): Promise<ApiResponse<Symptom>>;
  updateRainData(data: RainData): Promise<ApiResponse<RainData>>;
}
