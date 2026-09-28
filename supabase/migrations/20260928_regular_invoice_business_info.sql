-- Business / fiscal details needed for regular (fiscal) invoices.
-- Run once in Supabase: Dashboard -> SQL Editor -> paste -> Run.

-- Seller: the workshop's own registration and bank details
alter table public.workshops
  add column if not exists business_name     text,  -- Emri i biznesit (registered name)
  add column if not exists unique_number     text,  -- Nr. unik (ARBK)
  add column if not exists fiscal_number     text,  -- Nr. fiskal
  add column if not exists vat_number        text,  -- Nr. TVSH
  add column if not exists email             text,
  add column if not exists website           text,
  add column if not exists bank_name         text,
  add column if not exists bank_account_name text,
  add column if not exists bank_account      text;

-- Buyer: a client can be a business with its own fiscal details
alter table public.clients
  add column if not exists is_business   boolean not null default false,
  add column if not exists fiscal_number text,
  add column if not exists unique_number text,
  add column if not exists vat_number    text,
  add column if not exists country       text;

-- Per invoice: regular (fiscal) layout and how it was paid
alter table public.services
  add column if not exists is_regular_invoice boolean,  -- null = follow the client (business -> regular)
  add column if not exists payment_method     text;
