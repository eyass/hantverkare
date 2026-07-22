import type { MetadataRoute } from 'next'

const BASE_URL = 'https://hantverkare.vercel.app'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/tool', '/faq', '/about', '/pricing'],
      disallow: [
        // Authenticated app routes
        '/quotes',
        '/quotes/',
        '/customers',
        '/customers/',
        '/settings',
        '/settings/',
        '/billing',
        '/billing/',
        '/price-list',
        '/price-list/',
        '/reports',
        '/reports/',
        '/quote-templates',
        '/quote-templates/',
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
