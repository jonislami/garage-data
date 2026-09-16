# GarageData

Workshop management for auto repair shops: jobs, invoices, inventory, clients, vehicles, inspections, appointments, expenses and reports. Built with React, Vite, Tailwind CSS and Supabase. Works offline (PWA) and in Albanian and English.

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase URL and anon key
npm run dev
```

## Database migration (required for part numbers)

Stock items now have a **part number** (OEM / SKU) that you can search by.
Run this once in Supabase → SQL Editor:

```
supabase/migrations/20260916_add_inventory_part_number.sql
```

Until the migration is run, the app still works. Parts are saved without the part number, and the app shows a notice.

## Backup & restore

Settings → **Backup & restore**

- **Download backup**: saves one `.json` file with clients, vehicles, stock, invoices (with line items), expenses, appointments and inspections.
- **Export for Excel**: CSV files for stock, clients and invoices.
- **Restore**: choose a backup file, pick what to restore (stock, clients & vehicles, invoices, …), then confirm.
  Restore is a *merge*. Missing records are added and records with the same ID are overwritten. Nothing created after the backup is deleted.
  Invoices are restored together with the vehicles and clients they belong to.

## Design system

Shared styles are in `src/index.css` (`.btn`, `.input`, `.card`, `.table`, `.badge`, `.plate`, …) and shared components are in `src/components/ui.jsx` (`PageHeader`, `SearchInput`, `EmptyState`, skeletons and toasts). Corners are small (4–8px) and there are no pill-shaped buttons.
