# Requirements Document

## Introduction

The Points Shop is a reward system for Henry Math Classroom where students earn points from graded challenge submissions and can spend those points to redeem rewards created by the teacher. Redemption is instant — no approval needed — as long as the student has sufficient spendable balance. The shop is additive: it reads from the existing `challenge_submissions` table and introduces two new database tables (`shop_items`, `redemptions`). Removing the shop has zero impact on the rest of the application.

## Glossary

- **Shop**: The points-based reward system consisting of the student-facing shop page and the teacher-facing admin page.
- **Shop_Item**: A reward created by the teacher with a title, description, point cost, optional image, and optional quantity limit.
- **Redemption**: A record of a student exchanging points for a Shop_Item.
- **Spendable_Balance**: The computed value `SUM(challenge_submissions.points WHERE is_locked = true) - SUM(redemptions.points_spent WHERE user_id = current_user)`. Never stored; always computed on demand.
- **Total_Score**: The lifetime achievement score `SUM(challenge_submissions.points WHERE is_locked = true)`. Existing value; never decreases.
- **Teacher**: A user with the `teacher` role in the RBAC system.
- **Student**: A user with the `student` role in the RBAC system.
- **Redeem_API**: The server-side Next.js API route at `/api/shop/redeem` that performs atomic balance and quantity checks before inserting a Redemption.
- **Student_Shop_Page**: The page at `/shop` visible to authenticated students.
- **Admin_Shop_Page**: The page at `/admin/shop` visible to authenticated teachers.
- **Dashboard**: The existing page at `/dashboard` that shows a student's Total_Score.

---

## Requirements

### Requirement 1: Spendable Balance Computation

**User Story:** As a student, I want to see how many points I can spend, so that I know which rewards I can afford.

#### Acceptance Criteria

1. THE Shop SHALL compute Spendable_Balance as `SUM(challenge_submissions.points WHERE is_locked = true) - SUM(redemptions.points_spent WHERE user_id = current_user)` for the authenticated student.
2. THE Shop SHALL compute Spendable_Balance on demand without storing it in a dedicated database column.
3. WHEN a student has no graded submissions and no redemptions, THE Shop SHALL display a Spendable_Balance of 0.
4. WHEN a student redeems a Shop_Item, THE Student_Shop_Page SHALL reflect the updated Spendable_Balance without requiring a full page reload.

---

### Requirement 2: Student Shop Page

**User Story:** As a student, I want to browse available rewards and redeem them with my points, so that I can exchange my earned points for real-world rewards.

#### Acceptance Criteria

1. WHEN an authenticated student navigates to `/shop`, THE Student_Shop_Page SHALL display the student's current Spendable_Balance prominently.
2. THE Student_Shop_Page SHALL display all active Shop_Items in a grid layout, each showing the item's title, description, point cost, and image (if present).
3. WHILE a Shop_Item's cost is strictly greater than the student's Spendable_Balance, THE Student_Shop_Page SHALL display the "Redeem" button for that item in a disabled state (items whose cost equals the balance remain enabled).
4. WHILE a Shop_Item has a quantity limit and remaining quantity is 0, THE Student_Shop_Page SHALL display the item as out of stock and disable its "Redeem" button regardless of the student's Spendable_Balance.
5. THE Student_Shop_Page SHALL display the authenticated student's Redemption history, ordered by most recent first.
6. WHEN an unauthenticated user navigates to `/shop`, THE Student_Shop_Page SHALL redirect the user to the login page.

---

### Requirement 3: Redemption Flow

**User Story:** As a student, I want to redeem a reward instantly when I have enough points, so that I get immediate confirmation without waiting for teacher approval.

#### Acceptance Criteria

1. WHEN a student clicks "Redeem" on an affordable, in-stock Shop_Item, THE Redeem_API SHALL atomically verify that the student's Spendable_Balance is greater than or equal to the item's cost.
2. WHEN a student clicks "Redeem" on an affordable, in-stock Shop_Item, THE Redeem_API SHALL atomically verify that the item's remaining quantity is greater than 0 (or that quantity is NULL, meaning unlimited).
3. WHEN both checks pass, THE Redeem_API SHALL insert a Redemption row with the student's user_id, item_id, and points_spent equal to the item's cost at the time of redemption.
4. IF the student's Spendable_Balance is insufficient at the time of the API call, THEN THE Redeem_API SHALL return an error response with HTTP status 400, a descriptive message, and SHALL NOT insert a Redemption row.
5. IF the Shop_Item's quantity is exhausted at the time of the API call, THEN THE Redeem_API SHALL return an error response with HTTP status 400, a descriptive message, and SHALL NOT insert a Redemption row.
6. THE Redeem_API SHALL perform the balance check, quantity check, and Redemption insert as a single atomic Supabase RPC call to prevent race conditions and double-spending.
7. WHEN an unauthenticated request is made to the Redeem_API, THE Redeem_API SHALL return an error response with HTTP status 401.

---

### Requirement 4: Teacher Shop Item Management

**User Story:** As a teacher, I want to create, edit, and deactivate shop items, so that I can control what rewards students can redeem.

#### Acceptance Criteria

1. WHEN an authenticated teacher navigates to `/admin/shop`, THE Admin_Shop_Page SHALL display a form to create a new Shop_Item with fields for title, description, cost (integer ≥ 1), image URL (optional), and quantity (optional integer ≥ 1; leave blank for unlimited).
2. WHEN a teacher submits a valid new Shop_Item form, THE Admin_Shop_Page SHALL insert the Shop_Item into the `shop_items` table with `is_active = true` and `created_by` set to the teacher's user ID.
3. IF a teacher submits a Shop_Item form with a cost less than 1, THEN THE Admin_Shop_Page SHALL display a validation error and SHALL NOT insert the item.
4. WHEN a teacher selects an existing Shop_Item to edit, THE Admin_Shop_Page SHALL allow the teacher to update the item's title, description, cost, image URL, and quantity.
5. WHEN a teacher deactivates a Shop_Item, THE Admin_Shop_Page SHALL set `is_active = false` for that item, and THE Student_Shop_Page SHALL no longer display the item.
6. WHEN an unauthenticated user or a non-teacher user navigates to `/admin/shop`, THE Admin_Shop_Page SHALL redirect the user to the login page.

---

### Requirement 5: Teacher Redemption Visibility

**User Story:** As a teacher, I want to see all student redemptions and current balances, so that I can track reward usage and fulfill redemptions.

#### Acceptance Criteria

1. THE Admin_Shop_Page SHALL display a list of all Redemptions across all students, showing the student's name, item title, points spent, and redemption timestamp.
2. THE Admin_Shop_Page SHALL display each enrolled student's current Spendable_Balance.
3. WHEN a teacher views the Admin_Shop_Page, THE Admin_Shop_Page SHALL load Redemption data using a query that the teacher's RLS policy permits.

---

### Requirement 6: Database Schema and RLS

**User Story:** As a developer, I want the shop tables to be isolated with proper RLS policies, so that the shop can be added or removed without affecting existing tables.

#### Acceptance Criteria

1. THE Shop SHALL introduce exactly two new database tables: `shop_items` and `redemptions`, with no modifications to existing tables.
2. THE Shop SHALL define an RLS policy on `shop_items` that permits teachers to INSERT, SELECT, UPDATE, and DELETE rows, and permits students to SELECT rows where `is_active = true` only.
3. THE Shop SHALL define an RLS policy on `redemptions` that permits students to INSERT rows where `user_id = auth.uid()`, permits students to SELECT their own rows, and permits teachers to SELECT all rows.
4. THE Shop SHALL provide a Supabase RPC function `redeem_item(p_item_id UUID)` that atomically checks Spendable_Balance, checks quantity, and inserts a Redemption row within a single transaction.
5. IF the `shop_items` and `redemptions` tables are dropped, THEN the rest of the application SHALL continue to function without errors.

---

### Requirement 7: Dashboard Balance Display

**User Story:** As a student, I want to see my spendable balance on the dashboard, so that I am aware of my available points without navigating to the shop.

#### Acceptance Criteria

1. WHEN an authenticated student views the Dashboard, THE Dashboard SHALL display the student's Spendable_Balance alongside the existing Total_Score.
2. THE Dashboard SHALL compute Spendable_Balance using a single additional query that does not modify or replace the existing Total_Score query.
