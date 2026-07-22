import fs from "node:fs";
import path from "node:path";
import { parseFrontmatter } from "./parseFrontmatter";

const CONTENT_DIR = path.join(process.cwd(), "content", "blog");

export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  date: string;
  content: string;
};

export type BlogPostSummary = Omit<BlogPost, "content">;

function readPostFile(filename: string): BlogPost {
  const slug = filename.replace(/\.md$/, "");
  const raw = fs.readFileSync(path.join(CONTENT_DIR, filename), "utf-8");
  const { data, content } = parseFrontmatter(raw);

  return {
    slug: data.slug ?? slug,
    title: data.title ?? slug,
    description: data.description ?? "",
    date: data.date ?? "",
    content,
  };
}

/** All blog posts, sorted newest first. Reads `content/blog/*.md` at call time (build/request time in Next's RSC world, not client-side). */
export function getAllPosts(): BlogPost[] {
  const filenames = fs.readdirSync(CONTENT_DIR).filter((name) => name.endsWith(".md"));
  return filenames
    .map(readPostFile)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export function getAllPostSlugs(): string[] {
  return getAllPosts().map((post) => post.slug);
}

export function getPostBySlug(slug: string): BlogPost | null {
  return getAllPosts().find((post) => post.slug === slug) ?? null;
}
