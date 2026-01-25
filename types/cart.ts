export interface CartItemData {
  productId: string;
  quantity: number;
  width?: number;
  height?: number;
  selectedOptions?: Record<string, unknown>;
}

export interface PriceSnapshot {
  net: number;
  vatAmount: number;
  gross: number;
  currency: string;
  calculatedAt: string;
}

export interface CartItemWithProduct {
  id: string;
  productId: string;
  quantity: number;
  width: number | null;
  height: number | null;
  selectedOptions: unknown;
  priceSnapshot: PriceSnapshot | null;
  product: {
    id: string;
    name: string;
    slug: string;
    priceType: string;
    images: Array<{
      url: string;
      alt: string | null;
    }>;
  };
}

export interface CartData {
  id: string;
  items: CartItemWithProduct[];
  totals: {
    subtotal: number;
    vatAmount: number;
    total: number;
  };
}
