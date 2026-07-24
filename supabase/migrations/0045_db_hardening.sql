-- DB hardening: fix search_path warnings + add two missing FK indexes
-- (closes #215).
--
-- Two related, low-risk pure-SQL cleanups bundled together -- both are
-- additive/idempotent, no app code changes, no RLS behavior change.
--
-- 1. function_search_path_mutable (Supabase security advisor WARN) on five
--    older functions that predate the pattern already used correctly on
--    log_invoice_issued/log_credit_note_issued/issue_credit_note/
--    log_invoice_export in 0034_gobd_invoice_compliance.sql: none of these
--    set an explicit search_path, so a maliciously-named schema/object
--    earlier in a caller's resolution order could in principle redirect
--    what they actually operate on. Fix: retrofit
--    `set search_path = pg_catalog, public` onto each, matching that same
--    convention exactly. `create or replace function` only adds the
--    missing clause -- no logic changes, so existing triggers that
--    reference these functions (invoices_prevent_mutation,
--    credit_notes_prevent_mutation, invoice_audit_log_prevent_mutation from
--    0034; the stock triggers from 0026) keep working unmodified.
--
-- 2. Two missing FK indexes found by scanning supabase/migrations/*.sql:
--      - contracts.source_quote_id (0024_recurring_contracts.sql, the
--        table is named `contracts`, not `recurring_contracts` -- references
--        quotes(id) on delete cascade) has no index anywhere, so cascade
--        deletes from quotes and any lookup of a contract by its source
--        quote both do a sequential scan.
--      - quotes.customer_id (0007_quote_customer_link.sql) has no
--        dedicated index despite being filtered on via
--        .eq("customer_id", ...) in app code (customer detail/history
--        views).
--    Both added as plain btree indexes with `if not exists` for safety.
--
-- Explicitly NOT in scope (see issue #215): revoking anon/authenticated
-- EXECUTE on the security-definer RPC-exposed helper functions
-- (is_org_member, is_org_owner, etc.) flagged separately by the advisor --
-- those are called from inside RLS policy expressions themselves, and
-- revoking EXECUTE from authenticated would very likely break every RLS
-- policy that references them. Already assessed and accepted as low-risk
-- in a prior session's advisor review. This migration does not touch any
-- EXECUTE grant.
--
-- No RLS changes: no policies are added, dropped, or altered by this
-- migration -- only function bodies (retrofitted search_path clause only)
-- and two new indexes.

-- ---------------------------------------------------------------------------
-- 1. function_search_path_mutable fixes
-- ---------------------------------------------------------------------------

create or replace function public.decrement_price_list_stock(item_id uuid, qty numeric)
returns void
language sql
set search_path = pg_catalog, public
as $$
  update public.price_list_items
  set stock_quantity = greatest(0, stock_quantity - qty)
  where id = item_id
    and track_stock
    and stock_quantity is not null;
$$;

create or replace function public.increment_price_list_stock(item_id uuid, qty numeric)
returns void
language sql
set search_path = pg_catalog, public
as $$
  update public.price_list_items
  set stock_quantity = coalesce(stock_quantity, 0) + qty
  where id = item_id;
$$;

create or replace function public.prevent_invoice_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
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

create or replace function public.prevent_credit_note_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception 'credit notes are immutable and cannot be updated or deleted (GoBD)';
end;
$$;

create or replace function public.prevent_audit_log_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception 'invoice_audit_log is append-only and cannot be updated or deleted';
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Missing FK indexes
-- ---------------------------------------------------------------------------

create index if not exists contracts_source_quote_id_idx
  on public.contracts (source_quote_id);

create index if not exists quotes_customer_id_idx
  on public.quotes (customer_id);
