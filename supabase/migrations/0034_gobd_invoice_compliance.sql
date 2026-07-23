-- GoBD-compliant invoice archiving: credit notes, audit log, DB-level
-- immutability (closes #123).
--
-- See docs/superpowers/specs/2026-07-22-gobd-datev-export-design.md for the
-- full design reasoning (that spec was reviewed and its section 5 legal
-- questions were explicitly NOT resolved here -- see the notes below and the
-- in-app Steuerberater-review notice shipped alongside this migration).
--
-- What this migration does:
--   1. invoices: add `voided_at` (marks that a credit note exists against an
--      invoice -- never hides or deletes the original row) and a trigger
--      that blocks UPDATE/DELETE at the database level (defense in depth on
--      top of the RLS policies added in 0008/0010, which already grant no
--      update/delete policy -- this closes the gap the spec flagged: "RLS
--      blocks update/delete, but a security definer function or future
--      migration could still alter rows").
--   2. credit_notes: a new append-only table for corrections. A credit note
--      references an original invoice and draws its own number from the
--      SAME per-organization/year sequence as invoices (next_invoice_number()
--      is reused unchanged) -- per GoBD, a credit note is itself a numbered
--      document, not a side-channel adjustment. The original invoice is
--      never edited; issuing a credit note only stamps `voided_at` on it.
--   3. invoice_audit_log: append-only audit trail (event_type: 'issued',
--      'credit_note_issued', 'exported'). Populated by SECURITY DEFINER
--      trigger functions on invoices/credit_notes insert (so a client can
--      never fabricate or skip an audit row), plus a SECURITY DEFINER RPC
--      (log_invoice_export) that the export routes call explicitly for
--      'exported' events, since those aren't table inserts.
--
-- What this migration deliberately does NOT do (see spec section 4/5 -- open
-- legal-judgment questions, not engineering decisions):
--   - Does not change `invoices.quote_id`/`user_id`/`organization_id` FK
--     cascade behavior (on delete cascade -> restrict). The spec flags this
--     as a real behavior change needing explicit human/legal sign-off
--     (GoBD retention vs. GDPR erasure tension) -- left untouched here.
--   - Does not assert 8 vs. 10 year retention as settled; see
--     lib/invoices/retention.ts for the documented-but-unenforced constant.
--   - Does not assert credit-note-only correction is legally sufficient for
--     every error class (e.g. VAT-rate corrections may need a formal
--     Rechnungsberichtigung instead) -- implemented as the spec's suggested
--     v1 interpretation, flagged in-app and in the PR description for
--     Steuerberater review.

-- ---------------------------------------------------------------------------
-- 1. invoices: voided_at + DB-level immutability trigger
-- ---------------------------------------------------------------------------

alter table public.invoices add column voided_at timestamptz;

-- Belt-and-suspenders on top of RLS (which already has no update/delete
-- policy): even a service-role/admin client or a future migration that
-- accidentally grants an update policy cannot silently alter an issued
-- invoice. voided_at is the ONE mutable-looking field, and it can only ever
-- be set (once) by public.issue_credit_note() below -- this trigger still
-- blocks direct client UPDATEs to it, including via that function's own
-- statement, so the function updates it with a session-local flag that only
-- its own transaction sets, rather than trusting an app-layer UPDATE call.
create or replace function public.prevent_invoice_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'invoices are immutable and cannot be deleted (GoBD); issue a credit note instead';
  end if;

  if tg_op = 'UPDATE' then
    if coalesce(current_setting('hantverkare.allow_invoice_void', true), '') <> 'true' then
      raise exception 'invoices are immutable and cannot be updated (GoBD); issue a credit note instead';
    end if;
    -- Even when the internal flag is set (only by issue_credit_note()),
    -- only voided_at may change -- every other column must stay identical.
    if new.id is distinct from old.id
      or new.organization_id is distinct from old.organization_id
      or new.user_id is distinct from old.user_id
      or new.quote_id is distinct from old.quote_id
      or new.invoice_number is distinct from old.invoice_number
      or new.issued_at is distinct from old.issued_at
      or new.subtotal_cents is distinct from old.subtotal_cents
      or new.vat_cents is distinct from old.vat_cents
      or new.total_cents is distinct from old.total_cents
    then
      raise exception 'only voided_at may be set on an existing invoice';
    end if;
  end if;

  return new;
end;
$$;

create trigger invoices_prevent_mutation
  before update or delete on public.invoices
  for each row execute function public.prevent_invoice_mutation();

-- ---------------------------------------------------------------------------
-- 2. credit_notes: append-only correction documents
-- ---------------------------------------------------------------------------

create table public.credit_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  original_invoice_id uuid not null references public.invoices(id) on delete restrict,
  invoice_number text not null,
  reason text not null check (char_length(trim(reason)) > 0),
  amount_cents integer not null,
  issued_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  unique (organization_id, invoice_number)
);

alter table public.credit_notes enable row level security;

create policy "Members can view their org credit notes"
  on public.credit_notes for select
  using (public.is_org_member(organization_id));

create policy "Members can insert credit notes in their org"
  on public.credit_notes for insert
  with check (public.is_org_member(organization_id));

-- Append-only, mirroring invoices/warranty_records/quote_template_versions:
-- no update/delete policy, plus the same DB-level trigger defense.
create or replace function public.prevent_credit_note_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'credit notes are immutable and cannot be updated or deleted (GoBD)';
end;
$$;

create trigger credit_notes_prevent_mutation
  before update or delete on public.credit_notes
  for each row execute function public.prevent_credit_note_mutation();

create index credit_notes_original_invoice_id_idx on public.credit_notes (original_invoice_id);

-- ---------------------------------------------------------------------------
-- 3. invoice_audit_log: append-only audit trail
-- ---------------------------------------------------------------------------

create table public.invoice_audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete set null,
  event_type text not null check (event_type in ('issued', 'credit_note_issued', 'exported')),
  actor_user_id uuid references auth.users(id) on delete set null,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

alter table public.invoice_audit_log enable row level security;

create policy "Members can view their org invoice audit log"
  on public.invoice_audit_log for select
  using (public.is_org_member(organization_id));

-- No insert/update/delete policy for clients at all: rows are written only
-- by the SECURITY DEFINER trigger functions/RPC below, which run as the
-- table owner and so bypass RLS -- a compromised or buggy client cannot
-- fabricate, alter, or delete an audit entry.
create or replace function public.prevent_audit_log_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'invoice_audit_log is append-only and cannot be updated or deleted';
end;
$$;

create trigger invoice_audit_log_prevent_mutation
  before update or delete on public.invoice_audit_log
  for each row execute function public.prevent_audit_log_mutation();

create index invoice_audit_log_invoice_id_idx on public.invoice_audit_log (invoice_id);
create index invoice_audit_log_org_occurred_idx on public.invoice_audit_log (organization_id, occurred_at desc);

-- Auto-log every invoice issuance. SECURITY DEFINER so it can insert into
-- invoice_audit_log despite clients having no insert policy there.
create or replace function public.log_invoice_issued()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.invoice_audit_log (organization_id, invoice_id, event_type, actor_user_id, metadata)
  values (new.organization_id, new.id, 'issued', auth.uid(), jsonb_build_object('invoice_number', new.invoice_number));
  return new;
end;
$$;

create trigger invoices_log_issued
  after insert on public.invoices
  for each row execute function public.log_invoice_issued();

-- Auto-log every credit note issuance.
create or replace function public.log_credit_note_issued()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.invoice_audit_log (organization_id, invoice_id, event_type, actor_user_id, metadata)
  values (
    new.organization_id,
    new.original_invoice_id,
    'credit_note_issued',
    auth.uid(),
    jsonb_build_object('credit_note_id', new.id, 'invoice_number', new.invoice_number, 'amount_cents', new.amount_cents, 'reason', new.reason)
  );
  return new;
end;
$$;

create trigger credit_notes_log_issued
  after insert on public.credit_notes
  for each row execute function public.log_credit_note_issued();

-- ---------------------------------------------------------------------------
-- 4. issue_credit_note(): the only supported way to correct an invoice
-- ---------------------------------------------------------------------------

-- Issues a credit note against an invoice in the caller's own organization,
-- drawing its number from the same per-org/year sequence as invoices
-- (next_invoice_number(), unchanged from 0010). Sets voided_at on the
-- original invoice (existence marker only -- the row and all its columns
-- stay exactly as issued; see prevent_invoice_mutation() above) via the
-- session-local `hantverkare.allow_invoice_void` flag, which is only ever
-- set inside this function's own transaction.
create or replace function public.issue_credit_note(p_invoice_id uuid, p_reason text, p_amount_cents integer)
returns public.credit_notes
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_invoice_number text;
  v_result public.credit_notes;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  select i.organization_id into v_org_id
    from public.invoices i
   where i.id = p_invoice_id;

  if v_org_id is null then
    raise exception 'invoice not found';
  end if;

  if not public.is_org_member(v_org_id) then
    raise exception 'not a member of this invoice''s organization';
  end if;

  if p_reason is null or char_length(trim(p_reason)) = 0 then
    raise exception 'reason is required';
  end if;

  select public.next_invoice_number() into v_invoice_number;

  insert into public.credit_notes (organization_id, original_invoice_id, invoice_number, reason, amount_cents, created_by)
  values (v_org_id, p_invoice_id, v_invoice_number, p_reason, p_amount_cents, v_user_id)
  returning * into v_result;

  perform set_config('hantverkare.allow_invoice_void', 'true', true);
  update public.invoices set voided_at = now() where id = p_invoice_id and voided_at is null;
  perform set_config('hantverkare.allow_invoice_void', 'false', true);

  return v_result;
end;
$$;

-- SECURITY DEFINER RPC for logging export events (called by the app after a
-- successful CSV/DATEV export -- not a table insert, so no insert trigger
-- covers it). Verifies the caller belongs to the invoices' organizations
-- before logging, same hardening pattern as issue_credit_note().
create or replace function public.log_invoice_export(p_invoice_ids uuid[], p_format text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_invoice_id uuid;
  v_org_id uuid;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  foreach v_invoice_id in array coalesce(p_invoice_ids, array[]::uuid[])
  loop
    select i.organization_id into v_org_id from public.invoices i where i.id = v_invoice_id;
    if v_org_id is not null and public.is_org_member(v_org_id) then
      insert into public.invoice_audit_log (organization_id, invoice_id, event_type, actor_user_id, metadata)
      values (v_org_id, v_invoice_id, 'exported', v_user_id, jsonb_build_object('format', p_format));
    end if;
  end loop;
end;
$$;
