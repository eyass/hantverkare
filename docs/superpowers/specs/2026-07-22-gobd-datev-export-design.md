# Design spec: GoBD-compliant invoice archiving + DATEV/CSV export

Relates to #123. **Spec only — no implementation in this change.** Issue #123 explicitly
calls for a design spec before implementation given legal-compliance stakes, matching the
caveat pattern already used for #109/#118. This document exists so a human (ideally with
Steuerberater/legal input) can review the compliance approach before any schema or code
changes land.

## 1. Current state

What exists today (`supabase/migrations/0008_invoices.sql`, `0010_organizations.sql`,
`app/api/export/invoices/route.ts`):

- `invoices` table: one row per quote, frozen `subtotal_cents`/`vat_cents`/`total_cents`
  snapshot at issue time, `invoice_number`, `issued_at`. Scoped to `organization_id` via RLS
  (post-0010).
- Numbering: `next_invoice_number()` is a `security definer` Postgres function, race-safe via
  `insert ... on conflict do update ... returning`, format `RE-{year}-{seq}`, sequence is
  **per organization, per year** (`invoice_counters` keyed on `(organization_id, year)` after
  the 0010 rewrite).
- Immutability: RLS grants `select`/`insert` only — no `update`/`delete` policy exists on
  `invoices`. The migration comment says corrections are meant to happen via "a real-world
  credit/correcting invoice," but **no credit-note table, workflow, or UI exists yet** — this
  is stated intent, not an enforced or usable mechanism.
- Export: `app/api/export/invoices/route.ts` already produces a flat CSV (German headers:
  Rechnungsnummer, Rechnungsdatum, Kunde, Angebot, amounts) for manual accountant handoff.
  This is a plain CSV, not DATEV's EXTF format — no DATEV-specific field structure, header
  metadata line, encoding requirements, or account-mapping.
- No audit log of any kind exists for invoice state changes (there are none to log yet since
  invoices can't be edited — but there's also no log of *creation*, void/storno events, or
  export events).
- No `voided_at`/`storno` concept, no correction/credit-note linkage between invoices.

### Gaps vs. GoBD requirements (concrete)

| Requirement | Current state | Gap |
|---|---|---|
| Immutability of finalized documents | RLS blocks update/delete | Enforced at the RLS layer only, not at the DB row level (a `security definer` function or future migration could still alter rows); no cryptographic/hash-chain tamper-evidence |
| Sequential, gapless numbering | Per-org/year counter, gapless in normal operation | No handling for numbering across organization deletion, no documented behavior if an invoice insert fails after a number is issued (a claimed-but-unused number is a gap — see open question below) |
| Correction via new document, not edit | Stated as intent in a comment | No credit-note/Storno table or workflow exists at all |
| Audit trail of state changes | None | No table logs creation, voiding, correction linkage, or export events |
| 10-year retention | No deletion path exists today (good — nothing purges invoices), but also nothing *guarantees* retention (no policy, no backup/archival strategy documented, cascade-deletes on `user_id`/`quote_id`/`organization_id` FKs could remove invoices as a side effect of unrelated deletes) | Retention is accidental, not designed |
| DATEV-compatible export | Generic CSV exists | Not in DATEV EXTF format; missing required header row, account numbers, BU-Schlüssel, counterparty data structure |
| Export/read access does not compromise immutability | export route is read-only | OK today, no gap |

## 2. GoBD requirements, in concrete technical terms

(Summarized from general knowledge of German GoBD — *Grundsätze zur ordnungsmäßigen
Führung und Aufbewahrung von Büchern, Aufzeichnungen und Unterlagen in elektronischer Form
sowie zum Datenzugriff* — this is a technical summary for engineering purposes, **not legal
advice**; see flagged questions in section 5.)

- **Unveränderbarkeit (immutability):** once a business record (invoice) is finalized, its
  content must not be alterable without the alteration being visible/traceable. In practice
  this is usually achieved by (a) no update path at the application/DB layer, and (b) any
  correction being a *new* linked document (credit note / Rechnungskorrektur / Storno), never
  an in-place edit.
- **Nachvollziehbarkeit / Prüfbarkeit (traceability/auditability):** every change to the
  *state* of a record (created, voided, corrected, exported) should be logged in a way a
  third party (auditor, Finanzamt) can follow, typically an append-only audit log with actor,
  timestamp, and before/after or action description.
- **Vollständigkeit (completeness) + lückenlose Nummerierung (gapless numbering):** invoice
  numbers must be sequential without gaps *for a given legal/billing entity*. A cancelled
  invoice still "uses" its number (via a Storno/credit note referencing it), it is not
  reused and not silently skipped.
- **Aufbewahrungsfrist (retention period):** currently 10 years (this has been legislated to
  shorten to 8 years for documents from 2025 onward under recent reform, but treat the exact
  cutoff as needing confirmation, not as settled) from end of the calendar year of creation,
  in a format that remains readable/exportable for the full period, and the records must
  be protected from deletion during that window.
- **Maschinelle Auswertbarkeit (machine readability) / Datenzugriff:** German tax authorities
  can require export of the accounting data in machine-readable form during audits; DATEV
  compatibility exists so that the export can flow directly to the Handwerker's
  Steuerberater's accounting system rather than requiring manual re-entry.
- **Zeitnahe Erfassung (timely recording):** invoices should be recorded/finalized close to
  the time of the underlying transaction — relevant to when "issued_at" is set and whether
  drafts can linger un-finalized indefinitely (not itself a schema gap here, flagged as a
  process question).

### DATEV EXTF CSV format basics (concrete structure)

DATEV's common interchange format for accounting entries is the "EXTF" CSV format used by
DATEV Rechnungswesen/Kanzlei-Rechnungswesen import. Key structural facts (from general
knowledge — a human/Steuerberater should confirm the exact variant needed, since DATEV has
multiple format specs for different purposes — booking records vs. debtor/creditor master
data vs. document metadata):

- File is CSV, typically **Windows-1252 (cp1252) encoded**, semicolon-delimited, `\r\n` line
  endings — not UTF-8, which is a common integration mistake.
- **Row 1** is a fixed-format metadata/header line (not column names) starting with `EXTF`,
  followed by version number, format category ("Buchungsstapel" = booking batch is the most
  common for invoice-list exports), format name/version, generation timestamp, exporting
  application name, consultant number (Beraternummer), client number (Mandantennummer),
  fiscal year start date, account length, date range of the data, and other DATEV-specific
  metadata fields — this row is positional and DATEV-specification-exact, not
  freely designed.
- **Row 2** is the actual column header row (e.g., "Umsatz (ohne Soll/Haben-Kz)", "Soll/Haben-Kennzeichen", "Konto", "Gegenkonto (ohne BU-Schlüssel)", "BU-Schlüssel", "Belegdatum", "Belegfeld 1" (typically the invoice number), "Buchungstext", etc.) — dozens of columns, most of which can be left empty but must be *present* in the correct position.
- **Booking rows** map each invoice to a debit/credit account pair: this requires a chart-of-accounts mapping (e.g., SKR03/SKR04 — the two standard German chart-of-accounts frameworks) that this app does not currently have any concept of. Revenue account, VAT account, and the "Gegenkonto" (counter-account, typically the customer/debtor account) all need account numbers, which in turn usually require a debtor-number scheme per customer.
- Because of the account-mapping requirement, a naive "list of invoices" CSV (which is what `app/api/export/invoices/route.ts` produces today) is *not* sufficient for direct DATEV Buchungsstapel import — it would need per-customer debtor account numbers and a configured revenue/VAT account mapping in `business_settings` before a true EXTF booking-batch export is possible.
- A lower-effort, still useful intermediate step: a "Rechnungsdaten" (invoice master data) or generic structured CSV that a Steuerberater's staff can re-key or semi-automatically import is much simpler and doesn't require account-mapping — this may be an acceptable v1 given the target user (solo Handwerker without in-house bookkeeping).

## 3. Proposed schema changes

All below are *proposed*, not implemented. New migration file
`supabase/migrations/00XX_gobd_invoice_archiving.sql` would contain:

### 3.1 Invoice numbering — no change needed structurally, tighten guarantees

- Keep `next_invoice_number()` as-is (already race-safe, per-org/year, gapless in the happy
  path).
- **Add:** if an invoice insert fails after a number was claimed (e.g. app crash between
  `next_invoice_number()` call and the `insert into invoices`), the number is "burned" —
  this is actually the GoBD-correct behavior (numbers are never reused), but today nothing
  *records* that a number was burned versus simply "not yet issued this year." Add a
  lightweight `invoice_number_ledger` (or fold into the audit log in 3.3) so an auditor can
  see "seq 42 exists as a burned/unused number, not a hidden gap."

### 3.2 Correction model: credit notes, not edits

- New table `invoice_corrections` (or reuse `invoices` with a `kind` column
  `'invoice' | 'credit_note'` and a `corrects_invoice_id` nullable FK):
  - `id`, `organization_id`, `original_invoice_id` (FK to `invoices`, not null),
    `invoice_number` (drawn from the *same* per-org/year sequence — a credit note is itself
    a numbered document under GoBD), `reason` (free text, required), `amount_cents` (can be
    negative or full-reversal), `issued_at`, `created_by` (user id).
  - RLS: select + insert only, same immutability posture as `invoices`.
- Add `voided_at timestamptz` — **not** used to hide the invoice, only to mark that a credit
  note exists against it; the original row and all its data remain visible/exported forever.
  UI must always show original + correction together, never let the original disappear.

### 3.3 Audit log

- New table `invoice_audit_log`:
  - `id`, `organization_id`, `invoice_id` (or `invoice_number` if the row could theoretically
    not exist, e.g. a burned number), `event_type` (`'issued' | 'exported' | 'credit_note_issued' | 'number_burned'`),
    `actor_user_id`, `occurred_at timestamptz default now()`, `metadata jsonb` (e.g. export
    format used, credit note id).
  - Append-only: RLS grants `select` + `insert` only, no `update`/`delete`, same pattern as
    `invoices` itself.
  - Populated by a `security definer` trigger or wrapper functions (mirroring
    `next_invoice_number()`'s pattern) rather than trusting client-side inserts, so a
    compromised/buggy client can't fabricate audit entries — inserts to `invoices` and
    `invoice_corrections` should go through functions that also write the audit row in the
    same transaction.

### 3.4 Retention protection

- Audit that `on delete cascade` FKs (`quote_id`, `user_id`, `organization_id` on `invoices`)
  don't let an invoice disappear as a side effect of deleting a quote, user, or org before
  the retention period elapses. Concretely: consider changing `invoices.quote_id` and
  `invoices.user_id` FKs from `on delete cascade` to `on delete restrict` (or a soft-delete
  pattern on quotes/users instead of hard delete), so a user/org deletion cannot silently
  destroy legally-required invoice records. **This is a real behavior change from today's
  schema and needs explicit human sign-off** (see open question 5.4) since it changes what
  "delete my account" does.
- Document the retention period explicitly in code/config (e.g. a constant
  `INVOICE_RETENTION_YEARS`) even before any enforcement mechanism (like a scheduled job
  that warns before any deletion path could touch old invoices) is built, so the number is
  visible and reviewable rather than implicit.

### 3.5 DATEV export

- New route (e.g. `app/api/export/invoices/datev/route.ts`) alongside the existing generic
  CSV export (keep that one — it serves people without DATEV-integrated Steuerberater).
- Two-phase approach recommended:
  1. **v1 (low risk, no account-mapping needed):** a DATEV-adjacent "Rechnungsdaten" export —
     correct encoding (cp1252) and delimiter conventions, includes invoice number, date,
     customer name/address, net/VAT/gross amounts, and credit-note linkage — importable/
     re-keyable by a Steuerberater's office even without a formal EXTF booking batch.
  2. **v2 (requires new config):** true EXTF "Buchungsstapel" format, gated behind new
     `business_settings` fields for Berater-/Mandantennummer, fiscal year start, and a
     revenue/VAT account mapping (SKR03 vs SKR04 choice affects default account numbers).
     This should not be attempted until a human confirms which DATEV format variant this
     app's target users actually need (see open question 5.2).

## 4. What this spec deliberately does not decide

- Exact DATEV format variant/version to target (EXTF Buchungsstapel vs. simpler
  Rechnungsdaten/Debitorenkonto export) — needs a real DATEV/Steuerberater-facing sample or
  confirmation, not assumed from general knowledge.
- SKR03 vs SKR04 default chart of accounts.
- Whether 10-year or 8-year retention applies to this app's launch date documents (recent
  German legislative changes shortened retention for some document classes going forward;
  the exact cutover point needs confirmation, not assumption).
- Whether `on delete restrict` on quote/user FKs is an acceptable behavior change, or whether
  a soft-delete/anonymization model is required instead (GDPR "right to erasure" can be in
  tension with GoBD retention — reconciling the two is itself a legal question, not an
  engineering one).

## 5. Flagged legal-judgment questions for human review

These are explicitly **not** asserted as settled by this spec. A human (with Steuerberater
or legal input where noted) needs to confirm each before implementation:

1. **Is a credit-note-only correction model legally sufficient for this business's
   structure?** Solo Handwerker/small business invoicing may have simpler correction needs
   than larger businesses; confirm credit note (Gutschrift/Stornorechnung) is the right
   mechanism versus, e.g., a formal "corrected invoice" (Rechnungsberichtigung) process for
   specific error classes (e.g. wrong VAT rate) which German VAT law treats somewhat
   differently from a plain credit note.
2. **Which DATEV export format does the target user base actually need?** Full EXTF
   Buchungsstapel (requires account-mapping, SKR03/04 choice, Berater-/Mandantennummer setup)
   vs. a simpler structured export their Steuerberater can re-key. This materially changes
   scope — the full EXTF path requires new `business_settings` fields most solo tradespeople
   won't know how to fill in without asking their Steuerberater first.
3. **10 vs 8 year retention** — confirm which applies given recent German retention-period
   legislative changes and this app's actual launch/document dates, rather than defaulting
   to the historical 10-year figure asserted in this spec.
4. **Is changing FK cascade behavior (quote/user/org deletion) an acceptable trade-off**
   against GDPR erasure requests, and if not, what anonymization-while-retaining-financial-
   fields model is required? This is a GoBD-vs-GDPR tension that needs an explicit legal
   call, not an engineering default.
5. **Does "per organization" numbering (post multi-user-teams migration) match how this
   business is legally structured** — i.e., is an "organization" in this app's data model
   equivalent to one legal entity for invoicing purposes, or could one organization span
   multiple legal entities (e.g. a sole trader with a separate GmbH) that would need
   independent invoice number sequences? Confirm before finalizing the numbering scope.
6. **Timeliness of finalization** — should there be a maximum time a quote can sit as a
   "signed but not yet invoiced" state before GoBD's "zeitnahe Erfassung" expectation is at
   risk, and if so, is that a UX nudge or a hard constraint?

## 6. Recommendation

Do not implement schema or export changes from this spec until a human has answered section
5, ideally with Steuerberater input on questions 2 and 3, and a legal/privacy-aware call on
question 4. Once resolved, implementation should proceed in the order: 3.2 (credit notes) →
3.3 (audit log) → 3.4 (retention/FK hardening) → 3.5 v1 (simple DATEV-adjacent export) →
3.5 v2 (full EXTF, only if question 2 confirms it's needed).
