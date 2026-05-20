import { Product, CartItem, Notification } from '../../../types/product';
import { CartItemState } from '../../../store/cartSlice';
import { Order, OrderItem } from '../../../types/order';
import { INITIAL_PRODUCTS } from '../../../data/products';

// In-memory "database"
let products: Product[] = [...INITIAL_PRODUCTS];
let cart: CartItem[] = [];
let notifications: Notification[] = [];
let orders: Order[] = [];

const delay = (ms: number = 800) => new Promise((resolve) => setTimeout(resolve, ms));

export const productService = {
  getProducts: async (): Promise<Product[]> => {
    await delay();
    return [...products];
  },

  getProductById: async (id: string): Promise<Product | undefined> => {
    await delay();
    return products.find((p) => p.id === id);
  },

  addProduct: async (product: Omit<Product, 'id' | 'createdAt' | 'createdBy'>): Promise<Product> => {
    await delay();
    const newProduct: Product = {
      ...product,
      id: Math.random().toString(36).substring(7),
      createdAt: new Date().toISOString(),
      createdBy: 'admin', // Mocking currently logged in user
    };
    products = [newProduct, ...products];
    return newProduct;
  },

  updateProductStock: async (id: string, newStock: number): Promise<Product | undefined> => {
    await delay();
    const index = products.findIndex((p) => p.id === id);
    if (index !== -1) {
      products[index] = { ...products[index], stock: newStock };
      return products[index];
    }
    return undefined;
  },

  addToCart: async (productId: string, quantity: number): Promise<CartItem[]> => {
    await delay();
    const existingItem = cart.find((item) => item.productId === productId);
    if (existingItem) {
      cart = cart.map((item) =>
        item.productId === productId
          ? { ...item, quantity: item.quantity + quantity }
          : item
      );
    } else {
      cart = [...cart, { productId, quantity }];
    }
    return cart;
  },

  getCart: async (): Promise<CartItem[]> => {
    await delay();
    // Attach product details for convenience
    return cart.map((item) => ({
      ...item,
      product: products.find((p) => p.id === item.productId),
    }));
  },

  updateCartQuantity: async (productId: string, quantity: number): Promise<CartItem[]> => {
    await delay();
    cart = cart.map((item) =>
      item.productId === productId ? { ...item, quantity } : item
    );
    return cart;
  },

  removeFromCart: async (productId: string): Promise<CartItem[]> => {
    await delay();
    cart = cart.filter((item) => item.productId !== productId);
    return cart;
  },

  clearCart: async (): Promise<void> => {
    await delay();
    cart = [];
  },

  purchaseCart: async (total: number): Promise<boolean> => {
    await delay(1500);
    // Simulate stock reduction
    for (const item of cart) {
      const productIndex = products.findIndex((p) => p.id === item.productId);
      if (productIndex !== -1) {
        products[productIndex].stock -= item.quantity;
      }
    }

    // Create notification
    const notification: Notification = {
      id: Math.random().toString(36).substring(7),
      message: `New purchase completed! Total: ₹${total.toFixed(2)}`,
      createdAt: new Date().toISOString(),
    };
    notifications = [notification, ...notifications];

    cart = [];
    return true;
  },

  getNotifications: async (): Promise<Notification[]> => {
    await delay();
    return [...notifications];
  },

  createOrder: async (customerName: string, address: string, cartItemsFromStore: CartItemState[]): Promise<Order> => {
    await delay(1500);

    const orderItems: OrderItem[] = cartItemsFromStore.map((item) => ({
      productId: item.productId,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
    }));

    const total = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const newOrder: Order = {
      id: `ORD-${Math.random().toString(36).substring(7).toUpperCase()}`,
      customerName,
      address,
      items: orderItems,
      total,
      createdAt: new Date().toISOString(),
      status: 'pending',
    };

    // Simulate stock reduction
    for (const item of cartItemsFromStore) {
      const productIndex = products.findIndex((p) => p.id === item.productId);
      if (productIndex !== -1) {
        products[productIndex].stock -= item.quantity;
      }
    }

    orders = [newOrder, ...orders];

    const notification: Notification = {
      id: Math.random().toString(36).substring(7),
      message: `New order ${newOrder.id} received from ${customerName}!`,
      createdAt: new Date().toISOString(),
    };
    notifications = [notification, ...notifications];

    return newOrder;
  },

  getOrders: async (): Promise<Order[]> => {
    await delay();
    return [...orders];
  },
};
