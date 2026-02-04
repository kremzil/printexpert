export type OrderStatus = "PENDING" | "CONFIRMED" | "PROCESSING" | "COMPLETED" | "CANCELLED";
export type PaymentStatus = "UNPAID" | "PENDING" | "PAID" | "FAILED" | "REFUNDED";

export interface CheckoutData {
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  shippingAddress?: {
    name?: string;
    street: string;
    apt?: string;
    city: string;
    postalCode: string;
    country: string;
  };
  billingAddress?: {
    name?: string;
    companyName?: string;
    ico?: string;
    dic?: string;
    icDph?: string;
    street: string;
    apt?: string;
    city: string;
    postalCode: string;
    country: string;
  };
  notes?: string;
}

export interface OrderItemData {
  productId: string;
  productName: string;
  quantity: number;
  width?: number;
  height?: number;
  selectedOptions?: Record<string, unknown>;
  priceNet: number;
  priceVat: number;
  priceGross: number;
  priceSnapshot?: unknown;
}

export interface OrderData {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus?: PaymentStatus;
  audience: string;
  subtotal: number;
  vatAmount: number;
  total: number;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  shippingAddress?: unknown;
  billingAddress?: unknown;
  notes?: string | null;
  items: OrderItemData[];
  createdAt: Date;
  updatedAt: Date;
}
