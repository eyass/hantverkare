import type { Metadata } from "next";
import { MarketingShell } from "@/components/MarketingShell";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildSoftwareApplicationSchema } from "@/lib/seo/schema";
import { HomeContent } from "@/components/marketing/site/HomeContent";

const TITLE = "hantverkare — Angebote für Handwerker in unter einer Minute";
const DESCRIPTION =
  "KI-gestützte Angebotssoftware für Handwerksbetriebe: Auftrag per Sprache oder Text beschreiben, Angebot per Klick erstellen, Kunde unterschreibt digital, Rechnung folgt automatisch.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/",
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

export default function Home() {
  return (
    <MarketingShell>
      <JsonLd schema={buildSoftwareApplicationSchema()} />
      <HomeContent />
    </MarketingShell>
  );
}
