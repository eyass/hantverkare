import type { MetadataRoute } from 'next'
import { getAllPosts } from '@/lib/blog/posts'
import { TRADE_SLUGS } from '@/lib/trades/config'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

// Fixed date instead of `new Date()` so lastmod doesn't churn on every rebuild.
// Bump this manually when page content meaningfully changes.
const lastModified = new Date('2026-07-22')

export default function sitemap(): MetadataRoute.Sitemap {
  const blogPosts = getAllPosts()

  return [
    {
      url: BASE_URL,
      lastModified,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${BASE_URL}/tool`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/pricing`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/faq`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/about`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/blog`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    ...blogPosts.map((post) => ({
      url: `${BASE_URL}/blog/${post.slug}`,
      lastModified: post.date ? new Date(post.date) : lastModified,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
    ...TRADE_SLUGS.map((trade) => ({
      url: `${BASE_URL}/handwerker/${trade}`,
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  ]
}
