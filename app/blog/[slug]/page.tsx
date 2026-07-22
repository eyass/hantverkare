import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketingShell } from "@/components/MarketingShell";
import { PageHero } from "@/components/marketing/PageHero";
import { AnimatedSection } from "@/components/marketing/AnimatedSection";
import { getAllPostSlugs, getPostBySlug } from "@/lib/blog/posts";
import { renderMarkdown } from "@/lib/blog/renderMarkdown";

type BlogPostPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return getAllPostSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    return { title: "Artikel nicht gefunden — hantverkare" };
  }

  return {
    title: `${post.title} — hantverkare Blog`,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      url: `/blog/${post.slug}`,
      siteName: "hantverkare",
      locale: "de_DE",
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
    },
  };
}

function formatDate(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("de-DE", { year: "numeric", month: "long", day: "numeric" });
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  return (
    <MarketingShell>
      <PageHero
        compact
        eyebrow="Blog"
        title={post.title}
        description={formatDate(post.date) || undefined}
      />

      <AnimatedSection className="mx-auto max-w-2xl px-4 py-16 sm:px-8">
        <article className="flex flex-col gap-4">{renderMarkdown(post.content)}</article>

        <div className="mt-12 flex flex-col gap-3 rounded-2xl border border-[#e9edf2] bg-[#f4f6f8] p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-[#0f172a]">
            Angebote schneller schreiben?
          </h2>
          <p className="text-sm leading-6 text-[#64748b]">
            hantverkare hilft dir, Angebote in unter einer Minute zu erstellen und digital
            unterschreiben zu lassen.{" "}
            <Link href="/pricing" className="font-medium text-blue-600 hover:text-blue-700">
              14 Tage kostenlos testen
            </Link>
            .
          </p>
        </div>

        <div className="mt-8">
          <Link href="/blog" className="text-sm font-medium text-blue-600 hover:text-blue-700">
            ← Zurück zur Übersicht
          </Link>
        </div>
      </AnimatedSection>
    </MarketingShell>
  );
}
