# Points Shop — Design Plan

## Overview

Students earn points from graded challenge submissions. They can spend those points in a shop to redeem rewards created by the teacher. Redemption is instant — no approval needed — as long as the student has sufficient balance.

## Architecture Decision

**Same repo, same Supabase project, same Vercel deployment.**

- Shop lives in `app/shop/` and `app/admin/shop/` — isolated directories
- No existing files modified (except optionally the dashboard for balance display)
- If the shop folder and tables are deleted, the main app is completely unaffected
- Shared Supabase connection is intentional — that's how the shop reads student scores

## Points Model

### Earned Points (existing)
- Source: `challenge_submissions.points` (set when teacher grades)
- `total_score` on dashboard = `SUM(points WHERE is_locked=true)` — lifetime achievement, never decreases

### Spendable Balance (new, computed)
```
spendable_balance = SUM(challenge_submissions.points WHERE is_locked=true)
                  - SUM(redemptions.points_spent WHERE user_id = ?)
```

This is computed on demand — no stored balance column needed. Fast, simple, always accurate.

## Database Schema (2 new tables only)

```sql
-- Shop items created by teacher
shop_items (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  cost INTEGER NOT NULL,           -- points required to redeem
  image_url TEXT,
  quantity INTEGER,                -- NULL = unlimited
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Redemption history (the ledger of spending)
redemptions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  item_id UUID REFERENCES shop_items(id),
  points_spent INTEGER NOT NULL,
  redeemed_at TIMESTAMPTZ DEFAULT NOW()
)
```

No `point_transactions` table needed — balance is derived from existing `challenge_submissions` + new `redemptions`.

## Redemption Flow

1. Student opens `/shop`, sees their spendable balance and available items
2. Student clicks "Redeem" on an item
3. App calls `/api/shop/redeem` (server-side API route)
4. API atomically:
   - Checks `spendable_balance >= item.cost`
   - Checks `item.quantity IS NULL OR remaining_quantity > 0`
   - Inserts row into `redemptions`
   - Returns success
5. Student's balance updates immediately

The atomic check+insert is done via a Supabase RPC (Postgres function) to prevent race conditions / double-spending.

## Pages

### `/shop` (student view)
- Shows spendable balance prominently
- Grid of active shop items with cost, description, image
- "Redeem" button (disabled if insufficient balance or out of stock)
- Redemption history section at bottom

### `/admin/shop` (teacher view)
- Create/edit/deactivate shop items
- View all redemptions across all students
- See each student's current balance

### Dashboard (minor addition)
- Show spendable balance next to total score for students
- Single extra query, no impact on existing queries

## Implementation Scope

| File | Type | Description |
|------|------|-------------|
| `supabase/add-shop-tables.sql` | New | Creates `shop_items` and `redemptions` tables with RLS |
| `app/shop/page.tsx` | New | Student shop page |
| `app/admin/shop/page.tsx` | New | Teacher shop management |
| `app/api/shop/redeem/route.ts` | New | Atomic redemption API |
| `app/dashboard/page.tsx` | Minor edit | Add spendable balance display for students |

**Total: ~4-5 new files, 1 minor edit to dashboard**

## RLS Policies

- `shop_items`: Teachers can CRUD, students can SELECT active items only
- `redemptions`: Students can INSERT their own, SELECT their own; Teachers can SELECT all

## Status

**PLANNED — not yet implemented**

Last updated: 2026-05-25
