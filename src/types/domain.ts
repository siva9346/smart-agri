export type UserRole = 'FARMER' | 'ADMIN' | 'STAFF';

export interface User {
  id: string;
  phone: string;
  name: string;
  role: UserRole;
}

export interface Land {
  id: string;
  farmerId: string;
  area: string;
  cropType: string;
  location: string;
}

export interface FertilizerProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  imageUrl?: string;
}

export interface PurchaseHistory {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  totalPrice: number;
  date: string;
  status: 'COMPLETED' | 'PENDING';
}

export interface Symptom {
  id: string;
  title: string;
  description: string;
  solution: string;
  imageUrl?: string;
}

export interface RainData {
  id: string;
  date: string;
  rainfall: string;
  location: string;
}

export interface Enquiry {
  id: string;
  farmerId: string;
  farmerName: string;
  subject: string;
  message: string;
  status: 'OPEN' | 'CLOSED';
  createdAt: string;
}
