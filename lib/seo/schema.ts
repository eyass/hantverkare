/**
 * Builders for the JSON-LD structured data objects used across the marketing
 * pages. Keep these in sync with the actual visible copy on each page —
 * structured data must never claim something the page itself doesn't show.
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://hantverkare.vercel.app";

export function buildOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "hantverkare",
    url: SITE_URL,
  };
}

/**
 * SoftwareApplication schema with the real trial/subscription pricing:
 * 14 days free, then 29 €/month (excl. VAT), cancellable monthly.
 */
export function buildSoftwareApplicationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "hantverkare",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: SITE_URL,
    offers: {
      "@type": "Offer",
      price: "29.00",
      priceCurrency: "EUR",
      description: "14 Tage kostenlos testen, danach 29 €/Monat zzgl. MwSt., jederzeit monatlich kündbar.",
      eligibleDuration: {
        "@type": "QuantitativeValue",
        value: 14,
        unitCode: "DAY",
      },
    },
  };
}

export interface FaqEntry {
  question: string;
  answer: string;
}

export function buildFaqSchema(faqs: FaqEntry[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}
