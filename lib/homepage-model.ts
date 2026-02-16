type HomepageMode = "b2b" | "b2c"

type CategorySource = {
  id: string
  slug: string
  name: string
  description?: string | null
  image: string
  parentId?: string | null
  showInB2b?: boolean
  showInB2c?: boolean
}

type ProductImage = { url: string; alt?: string | null }

type ProductSource = {
  id: string
  slug: string
  name: string
  excerpt?: string | null
  description?: string | null
  priceFrom?: string | number | null
  priceAfterDiscountFrom?: string | number | null
  images?: ProductImage[] | null
  categoryId: string
}

type HomepageCategory = {
  id: string
  slug: string
  name: string
  description?: string | null
  image: string
  productCount: number
}

type HomepageFeaturedProduct = {
  id: string
  slug: string
  name: string
  excerpt?: string | null
  description?: string | null
  priceFrom?: string | null
  priceAfterDiscountFrom?: string | null
  images?: ProductImage[]
}

export function buildHomepageModel({
  mode,
  categories,
  products,
  topProducts,
  fallbackCount = 8,
}: {
  mode: HomepageMode
  categories: CategorySource[]
  products: ProductSource[]
  topProducts?: ProductSource[] | null
  fallbackCount?: number
}) {
  const visibleCategories = categories.filter((category) =>
    mode === "b2b" ? category.showInB2b !== false : category.showInB2c !== false
  )
  const categorySlugById = new Map(
    visibleCategories.map((category) => [category.id, category.slug])
  )
  const productCountByCategory = products.reduce((map, product) => {
    const categorySlug = categorySlugById.get(product.categoryId)
    if (!categorySlug) return map
    map.set(categorySlug, (map.get(categorySlug) ?? 0) + 1)
    return map
  }, new Map<string, number>())
  const imagesByProductId = new Map(
    products.map((product) => [product.id, product.images ?? []])
  )

  const homepageCategories: HomepageCategory[] = visibleCategories
    .filter((category) => !category.parentId)
    .map((category) => ({
      id: category.id,
      slug: category.slug,
      name: category.name,
      description: category.description,
      image: category.image,
      productCount: productCountByCategory.get(category.slug) ?? 0,
    }))

  const featuredProducts: HomepageFeaturedProduct[] =
    Array.isArray(topProducts) && topProducts.length > 0
      ? topProducts.map((product) => ({
          id: product.id,
          slug: product.slug,
          name: product.name,
          excerpt: product.excerpt,
          description: product.description,
          priceFrom:
            product.priceFrom === null || typeof product.priceFrom === "undefined"
              ? null
              : String(product.priceFrom),
          priceAfterDiscountFrom:
            product.priceAfterDiscountFrom === null ||
            typeof product.priceAfterDiscountFrom === "undefined"
              ? null
              : String(product.priceAfterDiscountFrom),
          images: imagesByProductId.get(product.id) ?? product.images ?? [],
        }))
      : products.slice(0, fallbackCount).map((product) => ({
          id: product.id,
          slug: product.slug,
          name: product.name,
          excerpt: product.excerpt,
          description: product.description,
          priceFrom:
            product.priceFrom === null || typeof product.priceFrom === "undefined"
              ? null
              : String(product.priceFrom),
          priceAfterDiscountFrom:
            product.priceAfterDiscountFrom === null ||
            typeof product.priceAfterDiscountFrom === "undefined"
              ? null
              : String(product.priceAfterDiscountFrom),
          images: product.images ?? [],
        }))

  return { homepageCategories, featuredProducts }
}
