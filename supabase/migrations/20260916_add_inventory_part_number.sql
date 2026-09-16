-- Adds a part number (OEM / SKU) to inventory so stock can be searched by part number.
-- Run once in Supabase: Dashboard -> SQL Editor -> paste -> Run.

alter table public.inventory
  add column if not exists part_number text;

-- Speeds up part-number lookups per workshop
create index if not exists inventory_workshop_part_number_idx
  on public.inventory (workshop_id, part_number);
