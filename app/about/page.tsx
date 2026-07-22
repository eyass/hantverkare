import type { Metadata } from "next";
import { MarketingShell } from "@/components/MarketingShell";
import { AboutContent } from "@/components/marketing/site/AboutContent";

const TITLE = "Über uns — hantverkare";
const DESCRIPTION =
  "hantverkare ist kein Marktplatz, sondern ein Verwaltungswerkzeug für Einzelunternehmer und kleine Handwerksbetriebe: eigene Preisliste, Kunden, Angebote und Rechnungen an einem Ort.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/about",
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

export default function AboutPage() {
  return (
    <MarketingShell>
      <AboutContent />
    </MarketingShell>
  );
}
