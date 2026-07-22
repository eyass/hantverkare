// Pure formatting/grouping helpers for global search (issue #50). Kept free of
// any Supabase/network code so they're cheap to unit test.

export type RawQuoteRow = {
  id: string;
  customer_description: string;
  status: string;
  created_at: string;
};

export type RawCustomerRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

export type SearchResultItem = {
  id: string;
  href: string;
  title: string;
  subtitle: string;
};

export type GroupedSearchResults = {
  quotes: SearchResultItem[];
  customers: SearchResultItem[];
};

// There is no dedicated human-friendly "quote number" column on `quotes`
// (see supabase/migrations/0002_quotes.sql) -- the issue's "quote numbers"
// requirement is resolved here as a short reference derived from the quote's
// id, shown as e.g. "#A1B2C3D4". This lets the search match either the free
// text description (the closest thing to a "title") or that reference.
export function quoteReference(id: string): string {
  return `#${id.slice(0, 8).toUpperCase()}`;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Entwurf",
  final: "Final",
  signed: "Signiert",
};

export function formatQuoteResult(quote: RawQuoteRow): SearchResultItem {
  return {
    id: quote.id,
    href: `/quotes/${quote.id}`,
    title:
      quote.customer_description.length > 60
        ? `${quote.customer_description.slice(0, 60)}…`
        : quote.customer_description,
    subtitle: `${quoteReference(quote.id)} · ${STATUS_LABELS[quote.status] ?? quote.status}`,
  };
}

export function formatCustomerResult(customer: RawCustomerRow): SearchResultItem {
  return {
    id: customer.id,
    href: `/customers/${customer.id}`,
    title: customer.name,
    subtitle: customer.email ?? customer.phone ?? "",
  };
}

export function groupSearchResults(
  quotes: RawQuoteRow[],
  customers: RawCustomerRow[],
): GroupedSearchResults {
  return {
    quotes: quotes.map(formatQuoteResult),
    customers: customers.map(formatCustomerResult),
  };
}

// A search term below this length returns no results (avoids firing a query,
// and a scan-y "everything matches" result set, on every single keystroke).
export const MIN_QUERY_LENGTH = 2;

export function isSearchableQuery(term: string): boolean {
  return term.trim().length >= MIN_QUERY_LENGTH;
}

// Postgres ilike wildcard/escape characters (%, _, \) in user input must be
// escaped so e.g. searching "50%" or "a_b" doesn't behave like a wildcard glob.
export function escapeIlikeTerm(term: string): string {
  return term.replace(/[\\%_]/g, (match) => `\\${match}`);
}
