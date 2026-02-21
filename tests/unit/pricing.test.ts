import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, getShopSettingsMock } = vi.hoisted(() => {
  const prismaMock = {
    product: { findUnique: vi.fn() },
    pricingModel: { findMany: vi.fn() },
    wpAttributeTaxonomy: { findMany: vi.fn() },
    wpTermTaxonomy: { findMany: vi.fn() },
    wpTerm: { findMany: vi.fn() },
    wpTermMeta: { findMany: vi.fn() },
  };

  return {
    prismaMock,
    getShopSettingsMock: vi.fn(),
  };
});

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));
vi.mock("@/lib/prisma", () => ({
  getPrisma: () => prismaMock,
}));
vi.mock("@/lib/shop-settings", () => ({
  getShopSettings: getShopSettingsMock,
}));

import type { AudienceContext } from "@/lib/audience-shared";
import { __pricingInternals, calculate } from "@/lib/pricing";

const decimal = (value: number | string) => ({
  toString: () => String(value),
});

const audienceContext: AudienceContext = {
  audience: "b2c",
  mode: "b2c",
  source: "default",
};

type CalculatorDataArg = Parameters<
  typeof __pricingInternals.calculateMatrixTotal
>[0];

describe("pricing internals", () => {
  it("interpolates matrix price between breakpoints", () => {
    const result = __pricingInternals.getMatrixPrice(
      {
        "10:100-10": 100,
        "10:100-20": 200,
      },
      "10:100",
      15,
      [10, 20]
    );

    expect(result).toBe(150);
  });

  it("scales price below minimum breakpoint for area calculation", () => {
    const result = __pricingInternals.getMatrixPrice(
      {
        "10:100-1": 10,
        "10:100-2": 20,
      },
      "10:100",
      0.3,
      [1, 2],
      { scaleBelowMin: true }
    );

    expect(result).toBeCloseTo(3);
  });

  it("scales price above maximum breakpoint when enabled", () => {
    const result = __pricingInternals.getMatrixPrice(
      {
        "10:100-10": 100,
        "10:100-20": 160,
      },
      "10:100",
      30,
      [10, 20],
      { scaleAboveMax: true }
    );

    expect(result).toBe(240);
  });

  it("calculates matrix total with production speed and user discount", () => {
    const data: CalculatorDataArg = {
      product_id: "p1",
      globals: {
        dim_unit: "cm",
        a_unit: 1,
        min_quantity: 1,
        min_width: null,
        min_height: null,
        max_width: null,
        max_height: null,
        numbers_array: {
          "1": "10,20",
        },
        smatrix: {
          "10:100-10": 100,
          "10:100-20": 200,
        },
        fmatrix: {},
      },
      matrices: [
        {
          kind: "simple",
          mtid: "1",
          ntp: "0",
          numStyle: null,
          aUnit: null,
          selects: [
            {
              aid: "10",
              label: "Rozmer",
              class: "smatrix-attr smatrix-attr-110 smatrix-size",
              options: [
                {
                  value: "100",
                  label: "A4",
                  selected: true,
                },
              ],
            },
          ],
        },
      ],
    };

    const result = __pricingInternals.calculateMatrixTotal(data, {
      quantity: 10,
      productionSpeedPercent: 10,
      userDiscountPercent: 5,
    });

    expect(result).toBeCloseTo(104.5);
  });
});

describe("calculate()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.pricingModel.findMany.mockResolvedValue([]);
    prismaMock.wpAttributeTaxonomy.findMany.mockResolvedValue([]);
    prismaMock.wpTermTaxonomy.findMany.mockResolvedValue([]);
    prismaMock.wpTerm.findMany.mockResolvedValue([]);
    prismaMock.wpTermMeta.findMany.mockResolvedValue([]);
    getShopSettingsMock.mockResolvedValue({
      vatRate: 0.2,
      pricesIncludeVat: false,
    });
  });

  it("returns fixed pricing with VAT excluded from base prices", async () => {
    prismaMock.product.findUnique.mockResolvedValue({
      priceType: "FIXED",
      priceFrom: decimal(10),
      priceAfterDiscountFrom: null,
      wpProductId: null,
    });

    const result = await calculate("product-1", { quantity: 3 }, audienceContext);

    expect(result).toEqual({
      net: 30,
      vatAmount: 6,
      gross: 36,
      currency: "EUR",
      breakdown: { audience: "b2c", vatRate: 0.2 },
    });
  });

  it("returns fixed pricing when stored prices already include VAT", async () => {
    prismaMock.product.findUnique.mockResolvedValue({
      priceType: "FIXED",
      priceFrom: decimal(12),
      priceAfterDiscountFrom: null,
      wpProductId: null,
    });
    getShopSettingsMock.mockResolvedValue({
      vatRate: 0.2,
      pricesIncludeVat: true,
    });

    const result = await calculate("product-2", { quantity: 1 }, audienceContext);

    expect(result.net).toBe(10);
    expect(result.vatAmount).toBe(2);
    expect(result.gross).toBe(12);
  });

  it("falls back to base unit price when matrix model data is missing", async () => {
    prismaMock.product.findUnique.mockResolvedValue({
      priceType: "MATRIX",
      priceFrom: decimal(8),
      priceAfterDiscountFrom: decimal(7),
      wpProductId: 12345,
    });

    const result = await calculate("product-3", { quantity: 4 }, audienceContext);

    expect(result.net).toBe(28);
    expect(result.vatAmount).toBe(5.6);
    expect(result.gross).toBe(33.6);
  });

  it("throws when product is missing", async () => {
    prismaMock.product.findUnique.mockResolvedValue(null);

    await expect(
      calculate("missing-product", { quantity: 1 }, audienceContext)
    ).rejects.toThrow("Produkt sa nenasiel.");
  });
});

