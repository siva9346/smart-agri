import { api } from '../../../services/api';
import { CartItemState } from '../../../store/cartSlice';

export interface ApiProduct {
  productId: string;
  name: string;
  category: string;
  price: number;
  unit: string;
  stock: number;
  description: string;
  imageUrl?: string;
  isActive: boolean;
  createdAt: string;
}

export interface ApiOrder {
  orderId: string;
  customerId: string;
  items: { productId: string; productName: string; quantity: number; unitPrice: string; subtotal: string }[];
  totalAmount: string;
  status: string;
  address: string;
  createdAt: string;
}

export const productService = {
  getProducts: async (cursor?: string): Promise<{ items: ApiProduct[]; nextCursor?: string }> => {
    const path = cursor ? `/products?cursor=${cursor}` : '/products';
    return api.get(path);
  },

  getProductById: async (id: string): Promise<ApiProduct> => {
    return api.get(`/products/${id}`);
  },

  addProduct: async (product: {
    name: string; category: string; price: number; unit: string;
    stock: number; description: string; imageUrl?: string;
  }): Promise<ApiProduct> => {
    return api.post('/products', product);
  },

  updateProduct: async (id: string, updates: Partial<ApiProduct>): Promise<ApiProduct> => {
    return api.put(`/products/${id}`, updates);
  },

  createOrder: async (address: string, cartItems: CartItemState[]): Promise<ApiOrder> => {
    return api.post('/orders', {
      items: cartItems.map(i => ({ productId: i.productId, quantity: i.quantity })),
      address,
    });
  },

  getOrders: async (cursor?: string): Promise<{ items: ApiOrder[]; nextCursor?: string }> => {
    const path = cursor ? `/orders?cursor=${cursor}` : '/orders';
    return api.get(path);
  },

  getNotifications: async (cursor?: string) => {
    const path = cursor ? `/notifications?cursor=${cursor}` : '/notifications';
    return api.get<{ items: any[]; nextCursor?: string }>(path);
  },
};
