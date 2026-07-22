import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/MarketingShell";
import { PageHero } from "@/components/marketing/PageHero";
import { AnimatedSection } from "@/components/marketing/AnimatedSection";
import { getAllPosts } from "@/lib/blog/posts";

const TITLE = "Blog — Angebote, Kalkulation und Digitalisierung für Handwerker";
const DESCRIPTION =
  "Praxisnahe Artikel rund um Angebote, Preiskalkulation, digitale Unterschrift und Software für Handwerksbetriebe im deutschsprachigen Raum.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/blog",
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

function formatDate(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("de-DE", { year: "numeric", month: "long", day: "numeric" });
}

export default function BlogIndexPage() {
  const posts = getAllPosts();

  return (
    <MarketingShell>
      <PageHero
        compact
        eyebrow="Blog"
        title="Wissen für deinen Handwerksbetrieb"
        description="Angebote, Kalkulation, Recht und Digitalisierung — verständlich erklärt für Einzelunternehmer und kleine Handwerksbetriebe."
      />

      <AnimatedSection className="mx-auto max-w-3xl px-4 py-16 sm:px-8">
        <ul className="flex flex-col gap-6">
          {posts.map((post) => (
            <li key={post.slug}>
              <Link
                href={`/blog/${post.slug}`}
                className="group flex flex-col gap-2 rounded-2xl border border-[#e9edf2] bg-white p-6 shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition hover:border-blue-200 hover:shadow-[0_8px_24px_rgba(37,99,235,0.1)]"
              >
                {formatDate(post.date) && (
                  <span className="text-xs font-medium uppercase tracking-wide text-[#94a3b8]">
                    {formatDate(post.date)}
                  </span>
                )}
                <h2 className="text-xl font-semibold tracking-tight text-[#0f172a] group-hover:text-blue-700">
                  {post.title}
                </h2>
                <p className="text-sm leading-6 text-[#64748b]">{post.description}</p>
                <span className="mt-1 text-sm font-medium text-blue-600 group-hover:text-blue-700">
                  Weiterlesen →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </AnimatedSection>
    </MarketingShell>
  );
}
