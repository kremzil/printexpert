export type OrderStatus = "PENDING" | "CONFIRMED" | "PROCESSING" | "COMPLETED" | "CANCELLED";
export type PaymentStatus = "UNPAID" | "PENDING" | "PAID" | "FAILED" | "REFUNDED";

export interface CheckoutData {
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  deliveryMethod?: "DPD_COURIER" | "DPD_PICKUP" | "PERSONAL_PICKUP";
  paymentMethod?: "STRIPE" | "BANK_TRANSFER" | "COD";
  dpdProduct?: number;
  pickupPoint?: {
    parcelShopId: string;
    pusId?: string;
    name: string;
    street: string;
    city: string;
    zip: string;
    country: string;
  };
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
  id: string;
  productId: string;
  productName: string;
  productPriceType?: "ON_REQUEST" | "FIXED" | "MATRIX" | "AREA" | null;
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
  deliveryMethod?: "DPD_COURIER" | "DPD_PICKUP" | "PERSONAL_PICKUP" | null;
  paymentMethod?: "STRIPE" | "BANK_TRANSFER" | "COD" | null;
  dpdProduct?: number | null;
  pickupPoint?: unknown;
  shippingAddress?: unknown;
  billingAddress?: unknown;
  codAmount?: number | null;
  codCurrency?: string | null;
  carrier?: string | null;
  carrierShipmentId?: string | null;
  carrierParcelNumbers?: string[];
  carrierLabelLastPrintedAt?: Date | null;
  carrierMeta?: unknown;
  notes?: string | null;
  items: OrderItemData[];
  itemMappings?: Array<{
    cartItemId: string;
    orderItemId: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}
