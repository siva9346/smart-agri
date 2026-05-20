export type UserRole = 'admin' | 'staff' | 'customer';

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  description: string;
  createdBy: 'admin' | 'staff';
  createdAt: string;
}

export interface CartItem {
  productId: string;
  quantity: number;
  product?: Product; // For convenience in UI
}

export interface Notification {
  id: string;
  message: string;
  createdAt: string;
}
