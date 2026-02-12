import "server-only"

import { revalidateTag } from "next/cache"

// ─── Static cache tags ───────────────────────────────────────

export const TAGS = {
  /** Список категорий */
  CATEGORIES: "catalog:categories",
  /** Подборки/коллекции товаров */
  COLLECTIONS: "catalog:collections",
  /** Списки продуктов (getProducts, getCatalogProducts) */
  PRODUCTS: "catalog:products",
  /** Агрегация "кол-во товаров в категории" */
  PRODUCT_COUNTS: "catalog:counts",
  /** Блоки related products */
  RELATED: "catalog:related",
  /** Все данные калькулятора / матриц (бланкетный) */
  CALCULATORS: "catalog:calculators",
  /** Виджет «Топ-товары» */
  TOP_PRODUCTS: "top-products",
  /** Навигация (sidebar / header) */
  NAV: "nav-data",
  /** Настройки магазина (НДС и т.д.) */
  SHOP_SETTINGS: "shop-settings",
} as const

// ─── Dynamic (per-entity) tag builders ───────────────────────

/** Тег для одного товара: product:vizitky */
export const productTag = (slug: string) => `product:${slug}`

/** Тег для калькулятора одного товара: calculator:<uuid> */
export const calculatorTag = (productId: string) => `calculator:${productId}`

// ─── Invalidation helpers (server actions / route handlers) ──

/**
 * Инвалидировать один товар + все списки, где он может появляться.
 * Вызывать при: обновлении полей товара, изменении изображений,
 * смене wpProductId, toggle видимости B2B/B2C.
 */
export function invalidateProduct(slug: string, productId?: string) {
  revalidateTag(productTag(slug), "max")
  revalidateTag(TAGS.COLLECTIONS, "max")
  revalidateTag(TAGS.PRODUCTS, "max")
  revalidateTag(TAGS.PRODUCT_COUNTS, "max")
  revalidateTag(TAGS.RELATED, "max")
  revalidateTag(TAGS.TOP_PRODUCTS, "max")
  if (productId) {
    revalidateTag(calculatorTag(productId), "max")
  }
}

/**
 * Инвалидировать только кэш калькулятора / матриц для одного товара.
 * Вызывать при: редактировании матрицы цен, создании/удалении матрицы,
 * изменении видимости матрицы.
 */
export function invalidateCalculator(productId: string) {
  revalidateTag(calculatorTag(productId), "max")
}

/**
 * Инвалидировать только кэш коллекций.
 * Вызывать при создании/обновлении/удалении коллекций.
 */
export function invalidateCollections() {
  revalidateTag(TAGS.COLLECTIONS, "max")
}

/**
 * Инвалидировать категории + все зависимые кэши.
 * Вызывать при: создании/обновлении/удалении категории.
 */
export function invalidateCategories() {
  revalidateTag(TAGS.CATEGORIES, "max")
  revalidateTag(TAGS.COLLECTIONS, "max")
  revalidateTag(TAGS.PRODUCTS, "max")
  revalidateTag(TAGS.PRODUCT_COUNTS, "max")
  revalidateTag(TAGS.RELATED, "max")
  revalidateTag(TAGS.TOP_PRODUCTS, "max")
  revalidateTag(TAGS.NAV, "max")
}

/**
 * Полный сброс всех каталожных кэшей.
 * Вызывать при: массовом импорте, «Сбросить кэш» в админке.
 */
export function invalidateAllCatalog() {
  revalidateTag(TAGS.CATEGORIES, "max")
  revalidateTag(TAGS.COLLECTIONS, "max")
  revalidateTag(TAGS.PRODUCTS, "max")
  revalidateTag(TAGS.PRODUCT_COUNTS, "max")
  revalidateTag(TAGS.RELATED, "max")
  revalidateTag(TAGS.CALCULATORS, "max")
  revalidateTag(TAGS.TOP_PRODUCTS, "max")
  revalidateTag(TAGS.NAV, "max")
}
