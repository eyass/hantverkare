import { Fragment } from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { groupLineItems } from "@/lib/quotes/groupLineItems";

export type PdfLineItem = {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price_cents: number;
  line_total_cents: number;
  position: number;
  group_label?: string | null;
};

export type PdfQuote = {
  id: string;
  customer_description: string;
  subtotal_cents: number;
  vat_cents: number;
  total_cents: number;
  created_at: string | null;
};

export type PdfBusinessSettings = {
  company_name: string | null;
  address: string | null;
  vat_id: string | null;
  tax_number: string | null;
} | null;

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#111111",
  },
  letterhead: {
    marginBottom: 24,
  },
  letterheadLine: {
    fontSize: 10,
    marginBottom: 2,
  },
  companyName: {
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 2,
  },
  heading: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 4,
  },
  meta: {
    fontSize: 10,
    color: "#444444",
    marginBottom: 16,
  },
  description: {
    marginBottom: 20,
    lineHeight: 1.4,
  },
  table: {
    display: "flex",
    flexDirection: "column",
    marginBottom: 16,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#cccccc",
    borderBottomStyle: "solid",
    paddingVertical: 6,
  },
  tableHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#111111",
    borderBottomStyle: "solid",
    paddingBottom: 6,
    fontWeight: 700,
  },
  colDescription: { width: "40%" },
  colQuantity: { width: "12%", textAlign: "right" },
  colUnit: { width: "12%" },
  colUnitPrice: { width: "18%", textAlign: "right" },
  colTotal: { width: "18%", textAlign: "right" },
  groupHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#f4f4f4",
    paddingVertical: 4,
    paddingHorizontal: 2,
    marginTop: 4,
  },
  groupHeaderText: {
    fontSize: 9,
    fontWeight: 700,
    textTransform: "uppercase",
    color: "#444444",
  },
  groupSubtotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    paddingHorizontal: 2,
    fontSize: 9,
    color: "#444444",
  },
  totals: {
    alignSelf: "flex-end",
    width: "40%",
    marginTop: 8,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  totalsRowFinal: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 6,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#111111",
    borderTopStyle: "solid",
    fontWeight: 700,
    fontSize: 12,
  },
});

function formatEuros(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("de-DE");
}

export function QuotePdfDocument({
  quote,
  lineItems,
  businessSettings,
}: {
  quote: PdfQuote;
  lineItems: PdfLineItem[];
  businessSettings: PdfBusinessSettings;
}) {
  const createdAt = formatDate(quote.created_at);

  // Multi-room / multi-phase clustering (issue #205) -- byte-identical to
  // today's flat table when no item has a group_label; see
  // lib/quotes/groupLineItems.ts.
  const grouped = groupLineItems(lineItems, {
    getGroupLabel: (item) => item.group_label,
    getLineTotalCents: (item) => item.line_total_cents,
    getPosition: (item) => item.position,
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {businessSettings && (
          <View style={styles.letterhead}>
            {businessSettings.company_name && (
              <Text style={styles.companyName}>{businessSettings.company_name}</Text>
            )}
            {businessSettings.address && (
              <Text style={styles.letterheadLine}>{businessSettings.address}</Text>
            )}
            {businessSettings.vat_id && (
              <Text style={styles.letterheadLine}>USt-IdNr.: {businessSettings.vat_id}</Text>
            )}
            {businessSettings.tax_number && (
              <Text style={styles.letterheadLine}>Steuernummer: {businessSettings.tax_number}</Text>
            )}
          </View>
        )}

        <Text style={styles.heading}>Angebot</Text>
        {createdAt && <Text style={styles.meta}>Datum: {createdAt}</Text>}

        <Text style={styles.description}>{quote.customer_description}</Text>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={styles.colDescription}>Beschreibung</Text>
            <Text style={styles.colQuantity}>Menge</Text>
            <Text style={styles.colUnit}>Einheit</Text>
            <Text style={styles.colUnitPrice}>Einzelpreis</Text>
            <Text style={styles.colTotal}>Gesamt</Text>
          </View>
          {grouped.groups.map((group, groupIndex) => (
            <Fragment key={group.label ?? `ungrouped-${groupIndex}`}>
              {grouped.hasGroups && (
                <View style={styles.groupHeaderRow}>
                  <Text style={styles.groupHeaderText}>{group.label ?? "Weitere Positionen"}</Text>
                </View>
              )}
              {group.items.map((item) => (
                <View style={styles.tableRow} key={item.id}>
                  <Text style={styles.colDescription}>{item.description}</Text>
                  <Text style={styles.colQuantity}>{item.quantity}</Text>
                  <Text style={styles.colUnit}>{item.unit}</Text>
                  <Text style={styles.colUnitPrice}>{formatEuros(item.unit_price_cents)}</Text>
                  <Text style={styles.colTotal}>{formatEuros(item.line_total_cents)}</Text>
                </View>
              ))}
              {grouped.hasGroups && (
                <View style={styles.groupSubtotalRow}>
                  <Text>Zwischensumme</Text>
                  <Text>{formatEuros(group.subtotalCents)}</Text>
                </View>
              )}
            </Fragment>
          ))}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalsRow}>
            <Text>Zwischensumme</Text>
            <Text>{formatEuros(quote.subtotal_cents)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text>MwSt. (19%)</Text>
            <Text>{formatEuros(quote.vat_cents)}</Text>
          </View>
          <View style={styles.totalsRowFinal}>
            <Text>Gesamt</Text>
            <Text>{formatEuros(quote.total_cents)}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
