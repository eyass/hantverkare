import type { Metadata } from "next";
import { MarketingShell } from "@/components/MarketingShell";
import { HowItWorksContent } from "@/components/marketing/site/HowItWorksContent";

const TITLE = "So funktioniert's: Vom Auftrag zum unterschriebenen Angebot";
const DESCRIPTION =
  "Auftrag per Sprache oder Text beschreiben, die KI kalkuliert Positionen aus deiner Preisliste, der Kunde unterschreibt digital, und der Rechnungsentwurf wird automatisch erstellt.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/tool",
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

export default function ToolPage() {
  return (
    <MarketingShell>
      <HowItWorksContent />
    </MarketingShell>
  );
}
