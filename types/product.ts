export type Product = {
  slug: string;
  title: string;
  price?: number;
  priceFrom?: number;
  vatRate?: number;
  priceType?: "ON_REQUEST" | "FIXED" | "MATRIX" | "AREA";
  categorySlug: string;
  image: string | string[];
};
