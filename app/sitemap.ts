import type { MetadataRoute } from 'next'
import { TRADE_SLUGS } from '@/lib/trades/config'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

// Fixed date instead of `new Date()` so lastmod doesn't churn on every rebuild.
// Bump this manually when page content meaningfully changes.
const lastModified = new Date('2026-07-22')

export default function sitemap(): MetadataRoute.Sitemap {

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
    ...TRADE_SLUGS.map((trade) => ({
      url: `${BASE_URL}/handwerker/${trade}`,
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  ]
}
