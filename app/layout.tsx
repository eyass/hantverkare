import type { Metadata } from "next";
import { Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildOrganizationSchema } from "@/lib/seo/schema";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import "./globals.css";

const instrumentSans = Instrument_Sans({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://hantverkare.vercel.app"),
  title: "hantverkare",
  description: "KI-gestützte Angebote für Handwerker",
  openGraph: {
    siteName: "hantverkare",
    locale: "de_DE",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "hantverkare",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      className={`${instrumentSans.variable} ${ibmPlexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <JsonLd schema={buildOrganizationSchema()} />
        {children}
        <ServiceWorkerRegister />
        <Analytics />
      </body>
    </html>
  );
}
