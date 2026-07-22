import type { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/tool', '/faq', '/about', '/pricing'],
      disallow: [
        // Authenticated app routes
        '/quotes',
        '/customers',
        '/settings',
        '/billing',
        '/price-list',
        '/reports',
        '/quote-templates',
        // API routes
        '/api/',
        // Customer-facing share links — private-by-link, not for indexing
        '/q/',
        // Auth flow routes
        '/login',
        '/mfa-challenge',
        '/auth/',
        '/invite/',
        '/account-deleted',
        '/logout',
      ],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  }
}
