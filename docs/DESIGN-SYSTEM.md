# hantverkare Design System

Adapted from the Claude Design mockup ("Quotely", Bliqat Voice Quote App —
`https://claude.ai/design/p/2fb72e55-8d50-48cb-ae58-9afc62a10a61`), imported via the
DesignSync MCP tool. The mockup itself is Swedish-market (SEK, BankID, ROT deduction) —
**we adopt its visual design system and interaction patterns only**, not its content.
Our actual content stays German/EUR/MwSt., our actual click-to-sign flow (not BankID),
our actual data (no demo/seed JS — real Supabase queries).

## Fonts

Google Fonts, loaded via `next/font/google` in `app/layout.tsx` (not a `<link>` tag —
this project already uses `next/font/google` for Geist; follow that same pattern):
- **Instrument Sans** (400/500/600/700) — body/headings
- **IBM Plex Mono** (400/500/600) — numbers, money amounts, IDs (apply via a `.mono`
  utility class or a Tailwind font family token)

## Colors

| Token | Value | Use |
|---|---|---|
| `bg-dark` | `#0f172a` | Sidebar background, customer-facing (`/q/[token]`) page background |
| `bg-page` | `#f4f6f8` | Main authenticated-app content background |
| `card-bg` | `#ffffff` | Card backgrounds |
| `card-border` | `#e9edf2` | Card borders, dividers |
| `text-primary` | `#0f172a` | Headings, primary text |
| `text-secondary` | `#64748b` | Secondary text |
| `text-muted` | `#94a3b8` | Muted/meta text (dates, IDs, placeholders) |
| `accent` | `#2563eb` | Primary buttons, links, active nav state |
| `accent-hover` | `#1d4ed8` | Hover state for accent |
| `success-bg` / `success-fg` | `#dcfce7` / `#16a34a` | Signed/success badges |
| `danger` | `#dc2626` | Destructive actions (delete) |
| `danger-border` | `#fecaca` | Destructive button borders |

## Shapes & spacing

- Cards: `rounded-2xl` (16-20px), `border border-[#e9edf2]`, white background
- Primary buttons: `rounded-full`, accent background, white text, subtle shadow
  (`shadow-[0_6px_16px_rgba(37,99,235,0.3)]`)
- Secondary/outline buttons: `rounded-xl` (10-12px), border, white background
- Pills (tags/filters/status badges): `rounded-full`, small padding, colored background
- Status badges: pill-shaped, color-coded (draft=neutral gray, final=blue-ish neutral,
  signed=`success-bg`/`success-fg`)

## Layout shell

- **Desktop** (`md:` and up): fixed-width dark sidebar (`bg-dark`, ~236px), containing
  the "hantverkare" wordmark, nav links, and the signed-in user's email + sign-out at
  the bottom. Main content area has `bg-page` background.
- **Mobile** (below `md:`): sidebar hidden, a bottom tab bar instead (white background,
  top border, icons + labels for the main sections). Keep it simple — icons can be
  omitted or simplified (plain text labels) rather than hand-rolling SVGs matching the
  mockup exactly; the mockup's SVG icons are a nice-to-have, not a hard requirement.
- This replaces the current plain top header in `app/layout.tsx` entirely.

## Page-level patterns (for the pages being restyled in later tasks — reference only)

- **Dashboard/list pages** (`/quotes`, `/reports`): stat tiles in a responsive grid at
  the top (white cards, big number + small label), a card containing a row-per-item
  list below.
- **Voice capture** (`/quotes/new`): a large circular record button (the "orb"), with a
  pulsing ring animation while recording (CSS `@keyframes`, not JS-driven), centered in
  the page.
- **Review/edit** (`/quotes/[id]`): two-column layout on larger screens (line items card
  + a sticky summary/totals card with the primary actions), single column on mobile.
- **Customer-facing** (`/q/[token]`): dark page background (`bg-dark`), a white card
  containing the quote content, matching the mockup's "customer view" treatment.

## What we do NOT port from the mockup

- Swedish content (SEK, BankID, ROT/RUT deduction, Swedish personal names/addresses)
- The mockup's demo/seed JavaScript state machine (`localStorage`, mock quotes) — every
  page continues to use real Supabase queries exactly as already built
- The mockup's custom `sc-if`/`sc-for`/`x-dc` templating syntax — that's specific to the
  Claude Design preview tool, not portable code; we write normal React/JSX
- ÄTA (extra-work-order) concept, invoice timeline visualization — not part of any
  shipped feature; skip these mockup screens entirely for now
