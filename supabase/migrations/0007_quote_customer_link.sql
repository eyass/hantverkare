-- Quote history per customer (issue #13): link quotes to the customers table
-- so a customer's past quotes can be listed. Nullable and additive -- existing
-- quotes and quotes created without picking a customer stay valid.

alter table public.quotes
  add column customer_id uuid references public.customers(id) on delete set null;

-- No new RLS policies needed: the existing owner-scoped policies on
-- public.quotes (auth.uid() = user_id) already cover the new column, and
-- public.customers already restricts selection to the owning user.
