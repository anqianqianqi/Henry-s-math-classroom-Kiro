# Implementation Plan: Points Shop

## Overview

This implementation adds a points-based reward shop to Henry Math Classroom. Students spend points earned from graded challenge submissions to redeem teacher-created rewards. The feature is entirely additive: two new database tables, four new files, and one minor dashboard edit. The implementation follows a strict dependency order — database first, then types and utilities, then the API route, then the UI pages.

## Tasks

- [ ] 1. Create database migration
  - [ ] 1.1 Write `supabase/add-shop-tables.sql`
    - Create `shop_items` table with columns: `id`, `title`, `description`, `cost` (CHECK >= 1), `image_url`, `quantity` (CHECK NULL or >= 1), `is_active`, `created_by`, `created_at`
    - Create `redemptions` table with columns: `id`, `user_id`, `item_id`, `points_spent` (CHECK >= 1), `redeemed_at`
    - Add foreign keys: `shop_items.created_by → profiles(id)`, `redemptions.user_id → profiles(id)`, `redemptions.item_id → shop_items(id)`, both with ON DELETE CASCADE
    - Create indexes: `idx_shop_items_is_active`, `idx_shop_items_created_by`, `idx_redemptions_user_id`, `idx_redemptions_item_id`
    - Add RLS policy on `shop_items`: teachers can INSERT/SELECT/UPDATE/DELETE; students can SELECT where `is_active = true`
    - Add RLS policy on `redemptions`: students can INSERT where `user_id = auth.uid()` and SELECT their own rows; teachers can SELECT all rows
    - Create `redeem_item(p_item_id UUID)` RPC function (SECURITY DEFINER) that atomically: locks the item row with FOR UPDATE, checks quantity, computes spendable balance for `auth.uid()`, raises exceptions `item_not_found` / `out_of_stock` / `insufficient_balance` as appropriate, then inserts into `redemptions`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 2. Define TypeScript interfaces and pure utility functions
  - [ ] 2.1 Create `lib/types/shop.ts`
    - Define `ShopItem`, `Redemption`, `RedemptionWithDetails`, `StudentBalance`, `ShopItemForm`, `ValidationResult`, `ShopItemInsert` interfaces exactly as specified in the design document
    - _Requirements: 6.1_

  - [ ] 2.2 Create `lib/utils/shop.ts`
    - Implement `computeSpendableBalance(lockedPoints: number[], pointsSpent: number[]): number`
    - Implement `canAfford(balance: number, cost: number): boolean`
    - Implement `isInStock(quantity: number | null, redemptionCount: number): boolean`
    - Implement `isRedeemDisabled(balance: number, item: Pick<ShopItem, 'cost' | 'quantity' | 'redemption_count'>): boolean`
    - Implement `validateShopItemForm(form: ShopItemForm): ValidationResult` — rejects cost < 1 and empty title
    - Implement `sortRedemptionsByRecent(redemptions: Redemption[]): Redemption[]`
    - Implement `buildShopItemInsert(form: ShopItemForm, teacherId: string): ShopItemInsert` — always sets `is_active: true` and `created_by: teacherId`
    - Implement `buildRedemptionRecord(userId: string, itemId: string, cost: number)` returning `{ user_id, item_id, points_spent }`
    - _Requirements: 1.1, 1.2, 1.3, 2.3, 2.4, 3.1, 3.2, 3.3, 4.2, 4.3_

  - [ ]* 2.3 Write property tests for shop utilities in `lib/utils/__tests__/shop.test.ts`
    - Install `fast-check` if not already present; import `fc` from `fast-check`
    - **Property 1: Spendable Balance Formula** — `computeSpendableBalance` returns `sum(earned) - sum(spent)` for any arrays
    - **Validates: Requirements 1.1, 1.3**
    - **Property 3: Redeem Button Disabled State** — `isRedeemDisabled` returns `true` iff `cost > balance` OR (`quantity !== null` AND `redemptionCount >= quantity`)
    - **Validates: Requirements 2.3, 2.4**
    - **Property 4: Redemption History Sort Order** — `sortRedemptionsByRecent` returns descending `redeemed_at` order
    - **Validates: Requirements 2.5**
    - **Property 5: Afford Check Correctness** — `canAfford(balance, cost)` iff `balance >= cost`
    - **Validates: Requirements 3.1**
    - **Property 6: In-Stock Check Correctness** — `isInStock` iff `quantity === null` OR `redemptionCount < quantity`
    - **Validates: Requirements 3.2**
    - **Property 7: Redemption Record Shape** — `buildRedemptionRecord` preserves `userId`, `itemId`, `cost`
    - **Validates: Requirements 3.3**
    - **Property 8: Shop Item Insert Sets is_active and created_by** — `buildShopItemInsert` always sets `is_active === true` and `created_by === teacherId`
    - **Validates: Requirements 4.2**
    - **Property 9: Cost Validation Rejects Values Less Than 1** — `validateShopItemForm` with cost ≤ 0 returns `valid === false` with a `cost` error
    - **Validates: Requirements 4.3**
    - Each property runs a minimum of 100 iterations; tag each test with `// Feature: shop, Property N: <text>`
    - _Requirements: 1.1, 1.3, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 4.2, 4.3_

  - [ ]* 2.4 Write unit tests for shop utilities in `lib/utils/__tests__/shop.test.ts`
    - Test `computeSpendableBalance([], [])` returns 0 (Requirement 1.3)
    - Test `canAfford` with balance exactly equal to cost returns `true` (boundary case for Requirement 2.3)
    - Test `isInStock` with quantity 1 and redemptionCount 1 returns `false`
    - Test `validateShopItemForm` with cost `'0'` returns invalid; with cost `'1'` returns valid
    - Test `buildShopItemInsert` sets `quantity: null` when form quantity is empty string
    - _Requirements: 1.3, 2.3, 2.4, 3.1, 3.2, 4.2, 4.3_

- [ ] 3. Checkpoint — Verify utility layer
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implement the redemption API route
  - [ ] 4.1 Create `app/api/shop/redeem/route.ts`
    - Export `POST` handler using Next.js App Router conventions
    - Parse request body and validate `item_id` is present; return 400 `{ error: "item_id is required" }` if missing
    - Retrieve the Supabase server client and check session; return 401 `{ error: "Unauthorized" }` if no session
    - Call `supabase.rpc('redeem_item', { p_item_id: item_id })`
    - Map RPC error codes to HTTP responses: `insufficient_balance` → 400, `out_of_stock` → 400, `item_not_found` → 400, unexpected errors → 500
    - Return `{ success: true }` with status 200 on success
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [ ] 5. Build the student shop page
  - [ ] 5.1 Create `app/shop/page.tsx`
    - Mark as `'use client'`; add auth guard that redirects to `/login` if no session
    - On mount, run two parallel Supabase queries: `challenge_submissions` (locked points for current user) and `redemptions` (points_spent for current user); compute `spendableBalance` using `computeSpendableBalance`
    - Fetch all active `shop_items` ordered by `created_at` descending; for each item compute `redemption_count` from a count query
    - Fetch own `redemptions` joined with `shop_items.title`, ordered by `redeemed_at` descending
    - Render a prominent balance display showing `spendableBalance`
    - Render a grid of shop item cards, each showing title, description, cost, and image (if present); use `isRedeemDisabled` to set the disabled state of each "Redeem" button
    - On "Redeem" click: POST to `/api/shop/redeem` with `{ item_id }`; on success re-fetch balance and redemptions to update local state without full page reload; on error display an inline error message
    - Render redemption history section using `sortRedemptionsByRecent`, showing item title, points spent, and formatted timestamp
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 6. Build the teacher admin shop page
  - [ ] 6.1 Create `app/admin/shop/page.tsx`
    - Mark as `'use client'`; add auth guard that redirects to `/login` if no session or if user role is not `teacher`
    - Fetch all `shop_items` (active and inactive) ordered by `created_at` descending
    - Fetch all `redemptions` joined with `profiles.first_name`, `profiles.last_name`, and `shop_items.title`, ordered by `redeemed_at` descending
    - Fetch all enrolled students and compute each student's `spendable_balance` (two queries per student or a single aggregate query)
    - Render a create/edit form with fields: title (required), description, cost (integer ≥ 1), image URL (optional), quantity (optional; blank = unlimited); use `validateShopItemForm` before submitting; use `buildShopItemInsert` to build the insert payload
    - On valid form submit: insert new item with `is_active: true` and `created_by: user.id`; clear form and refresh item list
    - Render item list with edit and deactivate buttons; on deactivate set `is_active = false`; on edit populate the form with existing values
    - Render a redemption log table showing student name, item title, points spent, and timestamp
    - Render a student balance table showing student name and spendable balance
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 5.1, 5.2, 5.3_

- [ ] 7. Checkpoint — Verify shop pages
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Add spendable balance to the dashboard
  - [ ] 8.1 Edit `app/dashboard/page.tsx`
    - Add a single additional Supabase query to fetch `SUM(points_spent)` from `redemptions` for the current student (only when the user role is `student`)
    - Compute `spendableBalance = totalScore - totalSpent` using the existing `totalScore` value
    - Render the spendable balance alongside the existing total score display; do not modify or replace the existing total score query
    - _Requirements: 7.1, 7.2_

- [ ] 9. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests use `fast-check` with a minimum of 100 iterations each
- Property 2 (ShopItemCard rendering) is not included as a separate property test task because it tests UI rendering rather than a pure function — it is covered by the unit tests in task 2.4
- The `redeem_item` RPC uses `SECURITY DEFINER` so it runs with elevated privileges; the auth check inside the function uses `auth.uid()` which is set by Supabase for the calling user
- The dashboard edit (task 8) is independent of the shop pages (tasks 5 and 6) and can be done in any order after task 2

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2"] },
    { "id": 3, "tasks": ["2.3", "2.4"] },
    { "id": 4, "tasks": ["4.1"] },
    { "id": 5, "tasks": ["5.1", "6.1", "8.1"] }
  ]
}
```
