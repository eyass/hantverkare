-- Stripe SaaS billing: subscription state on business_settings.
-- business_settings is already 1:1 with a user (see 0004_business_settings.sql),
-- so no new table is needed -- just new columns.

alter table public.business_settings
  add column stripe_customer_id text,
  add column stripe_subscription_id text,
  add column subscription_status text,
  add column trial_ends_at timestamptz;
