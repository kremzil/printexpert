import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  Image,
  type DocumentProps,
} from "@react-pdf/renderer";
import type { QuoteData } from "./types";

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
  b2b: "#1565C0",
  text: "#333333",
  textLight: "#666666",
  border: "#E0E0E0",
  background: "#F5F5F5",
  lightBlue: "#E3F2FD",
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
    marginBottom: 25,
    paddingBottom: 15,
    borderBottomWidth: 2,
    borderBottomColor: colors.b2b,
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
    color: colors.b2b,
    marginBottom: 4,
  },
  titleSection: {
    marginBottom: 20,
    backgroundColor: colors.lightBlue,
    padding: 15,
    borderRadius: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.b2b,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 10,
    color: colors.textLight,
  },
  quoteInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 25,
    padding: 12,
    backgroundColor: colors.background,
    borderRadius: 4,
  },
  infoColumn: {
    flex: 1,
  },
  infoRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  infoLabel: {
    fontSize: 9,
    color: colors.textLight,
    width: 100,
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
    backgroundColor: colors.b2b,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: "flex-start",
  },
  tableRowEven: {
    backgroundColor: "#FAFAFA",
  },
  // Column widths matching invoice
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
    color: "#FFFFFF",
    textTransform: "uppercase",
  },
  cellText: {
    fontSize: 9,
  },
  productName: {
    fontSize: 9,
    fontWeight: "bold",
    marginBottom: 2,
  },
  configText: {
    fontSize: 8,
    color: colors.textLight,
    lineHeight: 1.4,
  },
  summarySection: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 20,
  },
  totalsBlock: {
    width: 280,
    backgroundColor: colors.background,
    padding: 15,
    borderRadius: 4,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
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
    paddingVertical: 10,
    borderTopWidth: 2,
    borderTopColor: colors.b2b,
    marginTop: 8,
  },
  grandTotalLabel: {
    fontSize: 14,
    fontWeight: "bold",
  },
  grandTotalValue: {
    fontSize: 14,
    fontWeight: "bold",
    color: colors.b2b,
  },
  noticeSection: {
    marginTop: 25,
    padding: 12,
    backgroundColor: "#FFF3E0",
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  noticeTitle: {
    fontSize: 9,
    fontWeight: "bold",
    color: colors.primary,
    marginBottom: 4,
  },
  noticeText: {
    fontSize: 8,
    color: colors.textLight,
    lineHeight: 1.5,
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
  contactInfo: {
    marginTop: 20,
    padding: 12,
    backgroundColor: colors.lightBlue,
    borderRadius: 4,
  },
  contactTitle: {
    fontSize: 9,
    fontWeight: "bold",
    color: colors.b2b,
    marginBottom: 6,
  },
  contactRow: {
    flexDirection: "row",
    gap: 20,
    fontSize: 9,
  },
});

function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatPrice(amount: number): string {
  return amount.toLocaleString("sk-SK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function QuoteTemplate({
  data,
}: {
  data: QuoteData
}): React.ReactElement<DocumentProps> {
  const { company, quote, items, totals, settings, isB2B } = data;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            {settings.logoUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={settings.logoUrl} style={styles.logo} />
            ) : (
              <Text style={styles.companyName}>{company.name}</Text>
            )}
          </View>
          <View style={styles.companyInfo}>
            <Text style={styles.companyName}>{company.name}</Text>
            <Text>{company.address}</Text>
            <Text>{company.city}</Text>
            <Text>IČO: {company.ico}</Text>
            <Text>DIČ: {company.dic}</Text>
            {company.icDph && <Text>IČ DPH: {company.icDph}</Text>}
          </View>
        </View>

        {/* Title Section */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>CENOVÁ PONUKA</Text>
          <Text style={styles.subtitle}>
            Predbežný výpočet ceny pre B2B zákazníka
          </Text>
        </View>

        {/* Quote Info */}
        <View style={styles.quoteInfo}>
          <View style={styles.infoColumn}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Číslo ponuky:</Text>
              <Text style={styles.infoValue}>{quote.quoteNumber}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Dátum vytvorenia:</Text>
              <Text style={styles.infoValue}>{formatDate(quote.createdAt)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Platnosť do:</Text>
              <Text style={styles.infoValue}>{formatDate(quote.validUntil)}</Text>
            </View>
          </View>
          <View style={styles.infoColumn}>
            {quote.customerName && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Zákazník:</Text>
                <Text style={styles.infoValue}>{quote.customerName}</Text>
              </View>
            )}
            {quote.customerEmail && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Email:</Text>
                <Text style={styles.infoValue}>{quote.customerEmail}</Text>
              </View>
            )}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Počet položiek:</Text>
              <Text style={styles.infoValue}>{totals.itemCount}</Text>
            </View>
          </View>
        </View>

        {/* Items Table */}
        <View style={styles.table}>
          {/* Table Header - same as invoice */}
          <View style={styles.tableHeader}>
            <Text style={[styles.headerText, styles.colProduct]}>Produkt</Text>
            <Text style={[styles.headerText, styles.colQty]}>Množ.</Text>
            <Text style={[styles.headerText, styles.colPrice]}>Cena za m.j.</Text>
            <Text style={[styles.headerText, styles.colNetPrice]}>Bez DPH</Text>
            <Text style={[styles.headerText, styles.colVatRate]}>DPH %</Text>
            <Text style={[styles.headerText, styles.colVat]}>DPH</Text>
            <Text style={[styles.headerText, styles.colTotal]}>Spolu</Text>
          </View>

          {/* Table Rows */}
          {items.map((item, index) => {
            // Build configuration string
            const configParts: string[] = [];
            
            // Add dimensions
            if (item.width && item.height) {
              configParts.push(`Rozmery: ${item.width} × ${item.height} cm`);
            } else if (item.configuration.dimensions) {
              configParts.push(`Rozmery: ${item.configuration.dimensions}`);
            }
            
            // Add attributes
            Object.entries(item.configuration.attributes).forEach(([key, value]) => {
              configParts.push(`${key}: ${value}`);
            });
            
            const configString = configParts.join(" | ");

            return (
              <View
                key={index}
                style={[styles.tableRow, index % 2 === 1 ? styles.tableRowEven : {}]}
              >
                <View style={styles.colProduct}>
                  <Text style={styles.productName}>{item.name}</Text>
                  {configString && (
                    <Text style={styles.configText}>{configString}</Text>
                  )}
                </View>
                <Text style={[styles.cellText, styles.colQty]}>{item.quantity}</Text>
                <Text style={[styles.cellText, styles.colPrice]}>
                  {formatPrice(item.unitPrice)} €
                </Text>
                <Text style={[styles.cellText, styles.colNetPrice]}>
                  {formatPrice(item.netPrice)} €
                </Text>
                <Text style={[styles.cellText, styles.colVatRate]}>
                  {Math.round(item.vatRate * 100)} %
                </Text>
                <Text style={[styles.cellText, styles.colVat]}>
                  {formatPrice(item.vatAmount)} €
                </Text>
                <Text style={[styles.cellText, styles.colTotal]}>
                  {formatPrice(item.grossPrice)} €
                </Text>
              </View>
            );
          })}
        </View>

        {/* Summary Section */}
        <View style={styles.summarySection}>
          <View style={styles.totalsBlock}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Medzisúčet bez DPH:</Text>
              <Text style={styles.totalValue}>{formatPrice(totals.subtotal)} €</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>
                DPH ({(totals.vatRate * 100).toFixed(0)}%):
              </Text>
              <Text style={styles.totalValue}>{formatPrice(totals.vatAmount)} €</Text>
            </View>
            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>
                {isB2B ? "Celkom bez DPH:" : "Celkom s DPH:"}
              </Text>
              <Text style={styles.grandTotalValue}>
                {formatPrice(isB2B ? totals.subtotal : totals.total)} €
              </Text>
            </View>
          </View>
        </View>

        {/* Notice Section */}
        <View style={styles.noticeSection}>
          <Text style={styles.noticeTitle}>Dôležité informácie</Text>
          <Text style={styles.noticeText}>
            • Táto cenová ponuka je predbežná a nezáväzná.{"\n"}
            • Konečná cena sa môže líšiť v závislosti od aktuálnych podmienok.{"\n"}
            • Platnosť ponuky je do {formatDate(quote.validUntil)}.{"\n"}
            • Pre záväznú objednávku nás prosím kontaktujte alebo prejdite k pokladni.
          </Text>
        </View>

        {/* Contact Info */}
        <View style={styles.contactInfo}>
          <Text style={styles.contactTitle}>Máte otázky?</Text>
          <View style={styles.contactRow}>
            <Text>Email: obchod@printexpert.sk</Text>
            <Text>Web: www.printexpert.sk</Text>
          </View>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>{settings.footerText}</Text>
      </Page>
    </Document>
  );
}
