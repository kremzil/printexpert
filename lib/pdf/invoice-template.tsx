import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  Image,
} from "@react-pdf/renderer";
import type { InvoiceData } from "./types";

// Register fonts for Slovak characters
Font.register({
  family: "Roboto",
  fonts: [
    {
      src: "https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-regular-webfont.ttf",
      fontWeight: "normal",
    },
    {
      src: "https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-bold-webfont.ttf",
      fontWeight: "bold",
    },
  ],
});

const colors = {
  primary: "#E65100",
  text: "#333333",
  textLight: "#666666",
  border: "#E0E0E0",
  background: "#F5F5F5",
};

const styles = StyleSheet.create({
  page: {
    fontFamily: "Roboto",
    fontSize: 10,
    padding: 40,
    color: colors.text,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 30,
  },
  logo: {
    width: 120,
    height: 50,
    objectFit: "contain",
  },
  companyInfo: {
    textAlign: "right",
    fontSize: 9,
  },
  companyName: {
    fontSize: 12,
    fontWeight: "bold",
    color: colors.primary,
    marginBottom: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.text,
    marginBottom: 20,
  },
  addressSection: {
    flexDirection: "row",
    marginBottom: 20,
    gap: 20,
  },
  addressBlock: {
    flex: 1,
  },
  addressTitle: {
    fontSize: 9,
    fontWeight: "bold",
    color: colors.textLight,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  addressText: {
    fontSize: 9,
    lineHeight: 1.5,
  },
  infoSection: {
    flexDirection: "row",
    marginBottom: 25,
  },
  infoBlock: {
    flex: 1,
  },
  infoRow: {
    flexDirection: "row",
    marginBottom: 3,
  },
  infoLabel: {
    fontSize: 9,
    color: colors.textLight,
    width: 120,
  },
  infoValue: {
    fontSize: 9,
    fontWeight: "bold",
  },
  table: {
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  colProduct: { flex: 3 },
  colQty: { width: 50, textAlign: "center" },
  colPrice: { width: 70, textAlign: "right" },
  colNetPrice: { width: 70, textAlign: "right" },
  colVatRate: { width: 50, textAlign: "center" },
  colVat: { width: 60, textAlign: "right" },
  colTotal: { width: 70, textAlign: "right" },
  headerText: {
    fontSize: 8,
    fontWeight: "bold",
    color: colors.textLight,
    textTransform: "uppercase",
  },
  cellText: {
    fontSize: 9,
  },
  summarySection: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  bankInfo: {
    fontSize: 9,
    lineHeight: 1.6,
    maxWidth: 200,
  },
  bankLabel: {
    fontWeight: "bold",
  },
  totalsBlock: {
    width: 220,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  totalLabel: {
    fontSize: 10,
  },
  totalValue: {
    fontSize: 10,
    fontWeight: "bold",
  },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderTopWidth: 2,
    borderTopColor: colors.primary,
    marginTop: 4,
  },
  grandTotalLabel: {
    fontSize: 12,
    fontWeight: "bold",
  },
  grandTotalValue: {
    fontSize: 12,
    fontWeight: "bold",
    color: colors.primary,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 8,
    color: colors.textLight,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
  },
  signature: {
    marginTop: 40,
    alignItems: "flex-end",
  },
  signatureImage: {
    width: 100,
    height: 50,
    objectFit: "contain",
  },
});

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("sk-SK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value) + " €";
}

function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("sk-SK").format(d);
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)} %`;
}

interface InvoiceTemplateProps {
  data: InvoiceData;
}

export function InvoiceTemplate({ data }: InvoiceTemplateProps) {
  const { company, customer, order, items, totals, settings } = data;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header with logo and company info */}
        <View style={styles.header}>
          {settings.logoUrl ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={settings.logoUrl} style={styles.logo} />
          ) : (
            <View style={styles.logo} />
          )}
          <View style={styles.companyInfo}>
            <Text style={styles.companyName}>{company.name}</Text>
            <Text>{company.address}</Text>
            <Text>{company.city}</Text>
            <Text>IČO: {company.ico}</Text>
            <Text>DIČ: {company.dic}</Text>
            {company.icDph && <Text>IČ DPH: {company.icDph}</Text>}
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>FAKTÚRA</Text>

        {/* Addresses and Invoice info */}
        <View style={styles.addressSection}>
          {/* Billing address */}
          <View style={styles.addressBlock}>
            <Text style={styles.addressTitle}>Odberateľ</Text>
            <View style={styles.addressText}>
              <Text>{customer.name}</Text>
              {customer.address && <Text>{customer.address}</Text>}
              {customer.city && <Text>{customer.city}</Text>}
              {customer.ico && <Text>IČO: {customer.ico}</Text>}
              {customer.dic && <Text>DIČ: {customer.dic}</Text>}
              {customer.icDph && <Text>IČ DPH: {customer.icDph}</Text>}
              {customer.email && <Text>{customer.email}</Text>}
              {customer.phone && <Text>{customer.phone}</Text>}
            </View>
          </View>

          {/* Shipping address if different */}
          {customer.shippingAddress && (
            <View style={styles.addressBlock}>
              <Text style={styles.addressTitle}>Odoslať na</Text>
              <View style={styles.addressText}>
                <Text>{customer.shippingAddress}</Text>
                {customer.shippingCity && <Text>{customer.shippingCity}</Text>}
              </View>
            </View>
          )}

          {/* Invoice details */}
          <View style={styles.addressBlock}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Číslo faktúry:</Text>
              <Text style={styles.infoValue}>{order.invoiceNumber}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Číslo objednávky:</Text>
              <Text style={styles.infoValue}>{order.orderNumber}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Dátum objednávky:</Text>
              <Text style={styles.infoValue}>{formatDate(order.orderDate)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Spôsob platby:</Text>
              <Text style={styles.infoValue}>{order.paymentMethod}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Spôsob doručenia:</Text>
              <Text style={styles.infoValue}>{order.deliveryMethod}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Dátum zdaň. plnenia:</Text>
              <Text style={styles.infoValue}>{formatDate(order.taxDate)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Dátum splatnosti:</Text>
              <Text style={styles.infoValue}>{formatDate(order.dueDate)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Dátum vystavenia:</Text>
              <Text style={styles.infoValue}>{formatDate(order.issueDate)}</Text>
            </View>
          </View>
        </View>

        {/* Items table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.headerText, styles.colProduct]}>Produkt</Text>
            <Text style={[styles.headerText, styles.colQty]}>Množ.</Text>
            <Text style={[styles.headerText, styles.colPrice]}>Cena za m.j.</Text>
            <Text style={[styles.headerText, styles.colNetPrice]}>Bez DPH</Text>
            <Text style={[styles.headerText, styles.colVatRate]}>DPH %</Text>
            <Text style={[styles.headerText, styles.colVat]}>DPH</Text>
            <Text style={[styles.headerText, styles.colTotal]}>Spolu</Text>
          </View>

          {items.map((item, index) => (
            <View key={index} style={styles.tableRow}>
              <Text style={[styles.cellText, styles.colProduct]}>{item.name}</Text>
              <Text style={[styles.cellText, styles.colQty]}>{item.quantity}</Text>
              <Text style={[styles.cellText, styles.colPrice]}>
                {formatCurrency(item.unitPrice)}
              </Text>
              <Text style={[styles.cellText, styles.colNetPrice]}>
                {formatCurrency(item.netPrice)}
              </Text>
              <Text style={[styles.cellText, styles.colVatRate]}>
                {formatPercent(item.vatRate)}
              </Text>
              <Text style={[styles.cellText, styles.colVat]}>
                {formatCurrency(item.vatAmount)}
              </Text>
              <Text style={[styles.cellText, styles.colTotal]}>
                {formatCurrency(item.grossPrice)}
              </Text>
            </View>
          ))}
        </View>

        {/* Summary section */}
        <View style={styles.summarySection}>
          {/* Bank info */}
          <View style={styles.bankInfo}>
            <Text style={styles.bankLabel}>{company.bankName}</Text>
            {company.bic && <Text>BIC: {company.bic}</Text>}
            {company.bankCode && <Text>Kód banky: {company.bankCode}</Text>}
            <Text>IBAN: {company.iban}</Text>
            <Text>Variabilný symbol: {order.variableSymbol}</Text>
          </View>

          {/* Totals */}
          <View style={styles.totalsBlock}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Spolu bez DPH</Text>
              <Text style={styles.totalValue}>{formatCurrency(totals.subtotal)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>DPH {formatPercent(totals.vatRate)}</Text>
              <Text style={styles.totalValue}>{formatCurrency(totals.vatAmount)}</Text>
            </View>
            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>Spolu</Text>
              <Text style={styles.grandTotalValue}>{formatCurrency(totals.total)}</Text>
            </View>
          </View>
        </View>

        {/* Signature */}
        {settings.signatureUrl && (
          <View style={styles.signature}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={settings.signatureUrl} style={styles.signatureImage} />
          </View>
        )}

        {/* Footer */}
        <Text style={styles.footer}>{settings.footerText}</Text>
      </Page>
    </Document>
  );
}
