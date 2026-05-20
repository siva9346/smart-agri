export interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface Order {
  id: string;
  customerName: string;
  address: string;
  items: OrderItem[];
  total: number;
  createdAt: string;
  status: 'pending';
}
