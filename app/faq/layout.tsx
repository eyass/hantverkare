import type { Metadata } from "next";

const TITLE = "Häufig gestellte Fragen zu hantverkare";
const DESCRIPTION =
  "Antworten zu KI-Kalkulation, Preisliste, digitaler Unterschrift, automatischer Rechnungsstellung und Preisen der Angebotssoftware hantverkare.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/faq",
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

export default function FaqLayout({ children }: { children: React.ReactNode }) {
  return children;
}
