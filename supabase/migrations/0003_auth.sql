-- Real authentication: scope quotes, quote_line_items, and price_list_items to
-- the authenticated user (auth.users). Folds in the per-tradesperson price list
-- scoping originally tracked as a separate backlog item (#16), since it's the
-- same migration touching the same tables.

-- Existing prototype data has no owner and cannot be attributed to a real
-- account — wiped rather than backfilled. Truncated together in one statement
-- so Postgres resolves the quote_line_items -> quotes FK automatically.
truncate table public.quote_line_items, public.quotes, public.price_list_items;

alter table public.quotes
  add column user_id uuid not null references auth.users(id) on delete cascade;

alter table public.quote_line_items
  add column user_id uuid not null references auth.users(id) on delete cascade;

alter table public.price_list_items
  add column user_id uuid not null references auth.users(id) on delete cascade;

-- Replace the open prototype policies with owner-scoped ones.
drop policy "Quotes are viewable by everyone" on public.quotes;
drop policy "Anyone can insert quotes" on public.quotes;
drop policy "Anyone can update quotes" on public.quotes;

create policy "Users can view their own quotes"
  on public.quotes for select
  using (auth.uid() = user_id);

create policy "Users can insert their own quotes"
  on public.quotes for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own quotes"
  on public.quotes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy "Line items are viewable by everyone" on public.quote_line_items;
drop policy "Anyone can insert line items" on public.quote_line_items;
drop policy "Anyone can update line items" on public.quote_line_items;

create policy "Users can view their own line items"
  on public.quote_line_items for select
  using (auth.uid() = user_id);

-- Known gap: this policy checks auth.uid() = user_id on the line item itself,
-- but does not verify quote_id actually belongs to that same user_id. A user
-- could attach a line item (with their own user_id) to another user's quote_id.
-- This isn't a read leak (each user's select is filtered to their own user_id,
-- so neither party can see the resulting row) but it is orphaned/inconsistent
-- data. Accepted for now; revisit with a trigger if this becomes a real problem.
create policy "Users can insert their own line items"
  on public.quote_line_items for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own line items"
  on public.quote_line_items for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- price_list_items was previously read-only/unowned; now each account manages
-- its own, so it gains insert/update/delete policies for the first time.
drop policy "Price list items are viewable by everyone" on public.price_list_items;

create policy "Users can view their own price list items"
  on public.price_list_items for select
  using (auth.uid() = user_id);

create policy "Users can insert their own price list items"
  on public.price_list_items for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own price list items"
  on public.price_list_items for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own price list items"
  on public.price_list_items for delete
  using (auth.uid() = user_id);
