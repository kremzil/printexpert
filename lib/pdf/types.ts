/**
 * Company information for invoice
 */
export interface CompanyInfo {
  name: string;
  address: string;
  city: string;
  ico: string;
  dic: string;
  icDph?: string;
  bankName?: string;
  bic?: string;
  bankCode?: string;
  iban: string;
}

/**
 * Customer information for invoice
 */
export interface CustomerInfo {
  name: string;
  address?: string;
  city?: string;
  ico?: string;
  dic?: string;
  icDph?: string;
  email?: string;
  phone?: string;
  shippingAddress?: string;
  shippingCity?: string;
}

/**
 * Order information for invoice header
 */
export interface OrderInfo {
  invoiceNumber: string;
  orderNumber: string;
  orderDate: Date | string;
  issueDate: Date | string;
  taxDate: Date | string;
  dueDate: Date | string;
  paymentMethod: string;
  deliveryMethod: string;
  variableSymbol: string;
}

/**
 * Single invoice line item
 */
export interface InvoiceItem {
  name: string;
  quantity: number;
  unitPrice: number;
  netPrice: number;
  vatRate: number;
  vatAmount: number;
  grossPrice: number;
}

/**
 * Invoice totals
 */
export interface InvoiceTotals {
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
}

/**
 * PDF settings (from ShopSettings)
 */
export interface InvoiceSettings {
  logoUrl?: string;
  signatureUrl?: string;
  footerText: string;
}

/**
 * Complete invoice data
 */
export interface InvoiceData {
  company: CompanyInfo;
  customer: CustomerInfo;
  order: OrderInfo;
  items: InvoiceItem[];
  totals: InvoiceTotals;
  settings: InvoiceSettings;
}

/**
 * PDF settings stored in database
 */
export interface PdfSettings {
  // Company info
  companyName: string;
  companyAddress: string;
  companyCity: string;
  companyIco: string;
  companyDic: string;
  companyIcDph: string;
  
  // Bank info
  bankName: string;
  bankBic: string;
  bankCode: string;
  bankIban: string;
  
  // PDF customization
  logoUrl: string;
  signatureUrl: string;
  footerText: string;
  
  // Auto-generation settings
  autoGenerateOnStatus: string; // OrderStatus when to auto-generate
  autoSendEmail: boolean;
  
  // Invoice numbering
  invoicePrefix: string;
  invoiceNextNumber: number;
  
  // Default payment terms
  paymentDueDays: number;
}

export const defaultPdfSettings: PdfSettings = {
  companyName: "SHARK.SK j.s.a.",
  companyAddress: "Komenského 40",
  companyCity: "040 01 Košice – mestská časť Sever",
  companyIco: "51154439",
  companyDic: "2120614628",
  companyIcDph: "SK2120614628",
  bankName: "Československá obchodná banka, a.s.",
  bankBic: "CEKOSKBX",
  bankCode: "7500",
  bankIban: "SK4175000000004025159032",
  logoUrl: "",
  signatureUrl: "",
  footerText: "Výpis z Obchodného registra Mestského súdu Košice, Oddiel: Sja, Vložka číslo: 26/V",
  autoGenerateOnStatus: "CONFIRMED",
  autoSendEmail: true,
  invoicePrefix: "",
  invoiceNextNumber: 1,
  paymentDueDays: 14,
};
