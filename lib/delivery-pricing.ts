export const DPD_COURIER_FALLBACK_PRICE = 4.99;
export const DPD_COURIER_FREE_SHIPPING_FROM = 100;
export const DEFAULT_VAT_RATE = 0.2;

const roundMoney = (value: number) => Math.round(value * 100) / 100;

export const normalizeCourierPrice = (value: number) => {
  if (!Number.isFinite(value) || value < 0) {
    return DPD_COURIER_FALLBACK_PRICE;
  }
  return roundMoney(value);
};

export const normalizeVatRate = (value: number) => {
  if (!Number.isFinite(value) || value < 0) {
    return DEFAULT_VAT_RATE;
  }
  return value;
};

export const normalizeFreeShippingFrom = (value: number) => {
  if (!Number.isFinite(value) || value < 0) {
    return DPD_COURIER_FREE_SHIPPING_FROM;
  }
  return roundMoney(value);
};

export const calculateDpdCourierShippingGross = ({
  deliveryMethod,
  productsSubtotal,
  courierPrice,
  freeShippingFrom,
}: {
  deliveryMethod: string | null | undefined;
  productsSubtotal: number;
  courierPrice: number;
  freeShippingFrom?: number;
}) => {
  if (deliveryMethod !== "DPD_COURIER" && deliveryMethod !== "DPD_PICKUP") {
    return 0;
  }

  const normalizedProductsTotal = Number.isFinite(productsSubtotal)
    ? productsSubtotal
    : 0;

  const normalizedFreeShippingFrom = normalizeFreeShippingFrom(
    freeShippingFrom ?? DPD_COURIER_FREE_SHIPPING_FROM
  );

  if (normalizedProductsTotal >= normalizedFreeShippingFrom) {
    return 0;
  }

  return normalizeCourierPrice(courierPrice);
};

export const splitGrossByVat = (gross: number, vatRate: number) => {
  const normalizedGross = Number.isFinite(gross) && gross > 0 ? roundMoney(gross) : 0;
  const normalizedVatRate = normalizeVatRate(vatRate);

  if (normalizedGross <= 0) {
    return { net: 0, vat: 0, gross: 0 };
  }

  if (normalizedVatRate === 0) {
    return { net: normalizedGross, vat: 0, gross: normalizedGross };
  }

  const net = roundMoney(normalizedGross / (1 + normalizedVatRate));
  const vat = roundMoney(normalizedGross - net);

  return { net, vat, gross: normalizedGross };
};
