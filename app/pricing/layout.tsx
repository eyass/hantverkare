import type { Metadata } from "next";

const TITLE = "Preise: 29 €/Monat, 14 Tage kostenlos testen";
const DESCRIPTION =
  "Ein einfacher Preis für unbegrenzte Angebote und Rechnungen: 14 Tage kostenlos testen, danach 29 €/Monat zzgl. MwSt., jederzeit monatlich kündbar.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/pricing",
    siteName: "hantverkare",
    locale: "de_DE",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
