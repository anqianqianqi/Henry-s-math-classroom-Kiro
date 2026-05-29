# Requirements Document

## Introduction

The Virtual Pet feature adds a gamified companion system to Henry Math Classroom. Every student receives an egg that hatches and evolves through five stages as the student feeds it using food items purchased from the existing shop. Students choose from three illustrated species (Dragon, Fox, Cat), equip cosmetic accessories, and watch their pet grow on a dedicated `/pet` page with animated SVG artwork. The feature extends the existing shop system additively — no existing tables are modified beyond adding two new columns to `shop_items` — and introduces one new table (`student_pets`) to track each student's pet state.

---

## Glossary

- **Pet**: The virtual companion assigned to a student, represented as an animated SVG illustration.
- **Species**: One of three pet types a student may choose: Dragon (fire theme), Fox (forest theme), or Cat (cosmic theme).
- **Evolution_Stage**: One of five sequential growth states a Pet passes through: Egg → Baby → Teen → Adult → Legendary.
- **XP**: Experience points accumulated by a Pet through feeding. Determines the current Evolution_Stage.
- **Food_Item**: A Shop_Item with `category = 'food'` and a positive `food_xp` value. Redeeming a Food_Item feeds the Pet.
- **Accessory_Item**: A Shop_Item with `category = 'accessory'`. Redeeming an Accessory_Item adds it to the student's inventory for equipping.
- **Pet_Item**: A Shop_Item with `category = 'pet'`. Redeeming a Pet_Item allows the student to adopt a different Species.
- **Student_Pet**: The database record in `student_pets` tracking a student's current Pet state (species, XP, equipped accessories, evolution stage).
- **Pet_Page**: The page at `/pet` accessible only to authenticated students.
- **Pet_Preview_Card**: A compact widget on the student Dashboard linking to the Pet_Page.
- **Teacher_Pet_Overview**: A read-only view on the teacher dashboard showing all students' pets as an engagement metric.
- **Redemption_Flow**: The existing atomic `redeem_item()` RPC function, extended to trigger pet feeding when a Food_Item is redeemed.
- **SVG_Pet**: The inline SVG illustration of the Pet, rendered in code (no external image files or emoji).
- **Idle_Animation**: A CSS `scale` pulse applied to the SVG_Pet to simulate breathing.
- **Happy_Animation**: A CSS bounce animation triggered on the SVG_Pet immediately after a successful feeding.
- **Evolution_Sparkle**: A CSS particle animation displayed when a Pet advances to a new Evolution_Stage.
- **Background_Scene**: The illustrated background behind the SVG_Pet on the Pet_Page, which changes per Evolution_Stage.
- **XP_Bar**: A visual progress indicator on the Pet_Page showing XP progress toward the next Evolution_Stage threshold.
- **Shop**: The existing points-based reward system at `/shop` and `/admin/shop`.
- **Teacher**: A user with the `teacher` or `administrator` role in the RBAC system.
- **Student**: A user with the `student` role in the RBAC system.

---

## Requirements

### Requirement 1: Database Schema Extensions

**User Story:** As a developer, I want the virtual pet data stored in a dedicated table with minimal changes to existing tables, so that the feature is additive and the existing shop continues to work without modification.

#### Acceptance Criteria

1. THE Pet_System SHALL add a `category` column of type `TEXT` with a `CHECK` constraint allowing values `'food'`, `'accessory'`, `'pet'`, or `'other'` to the existing `shop_items` table, defaulting to `'other'`.
2. THE Pet_System SHALL add a `food_xp` column of type `INTEGER` with a `CHECK` constraint requiring `food_xp >= 1` to the existing `shop_items` table, allowing `NULL` for non-food items.
3. THE Pet_System SHALL create a `student_pets` table with columns: `id` (UUID primary key), `user_id` (UUID, foreign key to `profiles.id`, unique), `species` (TEXT, one of `'dragon'`, `'fox'`, `'cat'`), `xp` (INTEGER, default 0, minimum 0), `evolution_stage` (TEXT, one of `'egg'`, `'baby'`, `'teen'`, `'adult'`, `'legendary'`), `equipped_accessories` (UUID array, default empty), `created_at` (TIMESTAMPTZ), `updated_at` (TIMESTAMPTZ).
4. THE Pet_System SHALL define an RLS policy on `student_pets` that permits students to SELECT and UPDATE their own row where `user_id = auth.uid()`.
5. THE Pet_System SHALL define an RLS policy on `student_pets` that permits teachers to SELECT all rows.
6. IF the `student_pets` table and the two new `shop_items` columns are removed, THEN the rest of the application SHALL continue to function without errors.

---

### Requirement 2: Pet Initialization

**User Story:** As a student, I want to receive an egg when I first visit the pet page, so that I have a pet to grow and care for.

#### Acceptance Criteria

1. WHEN an authenticated student navigates to `/pet` for the first time and no `student_pets` row exists for that student, THE Pet_Page SHALL create a new `student_pets` row with `evolution_stage = 'egg'`, `xp = 0`, `species = NULL`, and `equipped_accessories = []`.
2. WHILE a student's Pet has `evolution_stage = 'egg'`, THE Pet_Page SHALL display the egg SVG illustration and a species selection prompt instead of the evolved pet.
3. WHEN a student selects a Species from the species selection prompt, THE Pet_Page SHALL require an actual species selection before updating the `student_pets` row, then set `species` to the chosen value and `evolution_stage` to `'baby'`.
4. WHEN a student's Pet transitions from `'egg'` to `'baby'`, THE Pet_Page SHALL display the Evolution_Sparkle animation regardless of the order in which species selection and the transition occur.
5. THE Pet_Page SHALL display the species selection prompt exactly once per student — after the initial hatch — and SHALL NOT allow species changes after selection (except via a Pet_Item redemption).

---

### Requirement 3: Evolution Stages and XP Thresholds

**User Story:** As a student, I want my pet to evolve as I feed it more, so that I have a long-term goal to work toward.

#### Acceptance Criteria

1. THE Pet_System SHALL define XP thresholds for evolution: Egg → Baby at 0 XP (on species selection), Baby → Teen at 100 XP, Teen → Adult at 300 XP, Adult → Legendary at 700 XP.
2. WHEN a Pet's cumulative `xp` reaches or exceeds the threshold for the next Evolution_Stage, THE Pet_System SHALL update `evolution_stage` to the next stage.
3. WHEN a Pet advances to a new Evolution_Stage, THE Pet_Page SHALL display the Evolution_Sparkle animation.
4. WHILE a Pet is at `evolution_stage = 'legendary'`, THE Pet_System SHALL continue to accept XP from feeding without advancing to a further stage.
5. THE Pet_Page SHALL display the current Evolution_Stage name as a text label alongside the SVG_Pet.
6. THE XP_Bar SHALL display the student's current XP and the XP required to reach the next Evolution_Stage. WHILE the Pet is at `'legendary'`, THE XP_Bar SHALL display total XP with no next-stage target.

---

### Requirement 4: Shop Item Categories

**User Story:** As a teacher, I want to categorize shop items as food, accessories, or new pets, so that students can feed their pets and customize them with items they purchase.

#### Acceptance Criteria

1. WHEN a teacher creates or edits a Shop_Item on the Admin_Shop_Page, THE Admin_Shop_Page SHALL display a `category` selector with options: Food, Accessory, New Pet, Other.
2. WHEN a teacher selects the `'food'` category for a Shop_Item, THE Admin_Shop_Page SHALL display a required `food_xp` field accepting integers from 1 to 500.
3. IF a teacher submits a Shop_Item with `category = 'food'` and no `food_xp` value, THEN THE Admin_Shop_Page SHALL display a validation error and SHALL NOT save the item.
4. WHEN a teacher selects a category other than `'food'`, THE Admin_Shop_Page SHALL hide the `food_xp` field and store `NULL` for `food_xp`.
5. THE Student_Shop_Page SHALL display each Shop_Item's category as a visual badge (e.g., "🍖 Food", "🎩 Accessory", "🐾 New Pet").

---

### Requirement 5: Feeding Mechanic

**User Story:** As a student, I want feeding my pet to happen automatically when I redeem a food item, so that the experience feels seamless.

#### Acceptance Criteria

1. WHEN a student redeems a Food_Item via the Redemption_Flow, THE Pet_System SHALL add the item's `food_xp` value to the student's Pet's `xp` column within the same atomic transaction.
2. WHEN a student redeems a Food_Item and the student has no existing `student_pets` row, THE Pet_System SHALL create a new `student_pets` row with `evolution_stage = 'egg'` before adding XP.
3. WHEN a student redeems a Food_Item and the resulting XP meets or exceeds an evolution threshold, THE Pet_System SHALL update `evolution_stage` to the appropriate stage within the same transaction.
4. WHEN a student navigates to the Pet_Page after a successful feeding, THE Pet_Page SHALL display the Happy_Animation on the SVG_Pet.
5. THE Pet_Page SHALL display the XP gained from the most recent feeding as a transient `+N XP` label that fades out after 2 seconds.

---

### Requirement 6: Accessory System

**User Story:** As a student, I want to equip accessories on my pet, so that I can personalize its appearance.

#### Acceptance Criteria

1. WHEN a student redeems an Accessory_Item, THE Pet_System SHALL add the item's `id` to the student's `redemptions` table (existing behavior) and make the accessory available in the student's inventory on the Pet_Page.
2. THE Pet_Page SHALL display a list of the student's owned (redeemed) Accessory_Items with an "Equip" or "Unequip" toggle for each.
3. WHEN a student equips an Accessory_Item, THE Pet_Page SHALL add the item's `id` to the `equipped_accessories` array in `student_pets` and render the corresponding SVG overlay on the SVG_Pet; IF the SVG overlay fails to render, THE Pet_Page SHALL still mark the accessory as equipped in the database.
4. WHEN a student unequips an Accessory_Item, THE Pet_Page SHALL remove the item's `id` from the `equipped_accessories` array and remove the SVG overlay from the SVG_Pet.
5. THE Pet_Page SHALL support equipping multiple accessories simultaneously, rendering each as a separate SVG layer on top of the base SVG_Pet.
6. WHEN a student equips or unequips an accessory, THE Pet_Page SHALL update the `student_pets` row immediately without requiring a page reload; IF the immediate database update fails, THE Pet_Page SHALL revert the local UI change and display an error message.

---

### Requirement 7: SVG Pet Illustrations

**User Story:** As a student, I want to see a proper illustrated pet character, so that the experience feels polished and engaging.

#### Acceptance Criteria

1. THE Pet_System SHALL provide inline SVG illustrations for all three Species (Dragon, Fox, Cat) at all four post-egg Evolution_Stages (Baby, Teen, Adult, Legendary), totaling 12 distinct SVG_Pet illustrations drawn in code.
2. THE Pet_System SHALL provide one SVG illustration for the Egg stage shared across all Species.
3. THE SVG_Pet illustrations SHALL NOT use emoji characters; all visual elements SHALL be rendered as SVG paths, shapes, and fills.
4. THE Pet_Page SHALL apply the Idle_Animation (CSS `scale` pulse, period 3 seconds, scale range 1.0–1.04) to the SVG_Pet continuously while the page is visible; the Idle_Animation MAY be stopped independently of feeding events.
5. WHEN a feeding event occurs, THE Pet_Page SHALL apply the Happy_Animation (CSS vertical bounce, 3 cycles, 600ms total) to the SVG_Pet, overriding the Idle_Animation for the duration of the Happy_Animation.
6. WHEN a Pet advances to a new Evolution_Stage, THE Pet_Page SHALL display the Evolution_Sparkle animation (CSS radial particle burst, 8 particles, 800ms duration) centered on the SVG_Pet.
7. THE Pet_Page SHALL render the SVG_Pet at a minimum display size of 200×200 CSS pixels on desktop and 160×160 CSS pixels on mobile.

---

### Requirement 8: Background Scenes

**User Story:** As a student, I want the background behind my pet to change as it evolves, so that the world feels like it grows with my pet.

#### Acceptance Criteria

1. THE Pet_Page SHALL display a Background_Scene behind the SVG_Pet that corresponds to the current Evolution_Stage: Egg → nest scene, Baby → meadow scene, Teen → mountain scene, Adult → sky scene, Legendary → cosmos scene.
2. THE Background_Scene SHALL be rendered as inline SVG or CSS gradients and shapes — no external image files.
3. WHEN a Pet advances to a new Evolution_Stage, THE Pet_Page SHALL transition the Background_Scene with a CSS cross-fade of exactly 600ms duration.
4. THE Background_Scene SHALL be visually distinct for each Evolution_Stage, using a different color palette and at least two unique illustrated elements per scene.

---

### Requirement 9: Pet Page Layout

**User Story:** As a student, I want a dedicated page that shows everything about my pet in one place, so that I can manage and enjoy my pet easily.

#### Acceptance Criteria

1. THE Pet_Page SHALL be accessible at the route `/pet` and SHALL redirect any unauthenticated user found at the `/pet` route — regardless of how they arrived — to the login page.
2. THE Pet_Page SHALL be accessible only to users with the `student` role; users with any non-student role (including `teacher`, `administrator`, or any other role) navigating to `/pet` SHALL be redirected to the dashboard.
3. THE Pet_Page SHALL display the following elements: the Background_Scene, the animated SVG_Pet, the Evolution_Stage name label, the XP_Bar, the equipped accessories list, the owned accessories inventory with equip/unequip controls, and a "Go to Shop" link.
4. THE Pet_Page SHALL display the student's current Spendable_Balance (from the existing shop system) so the student knows how many points they have to spend on pet items.
5. WHEN the student has no owned accessories, THE Pet_Page SHALL display an empty-state message directing the student to the shop.

---

### Requirement 10: Dashboard Pet Preview Card

**User Story:** As a student, I want to see a small preview of my pet on the dashboard, so that I am reminded of my pet and can quickly navigate to the pet page.

#### Acceptance Criteria

1. WHEN an authenticated student views the Dashboard, THE Dashboard SHALL display a Pet_Preview_Card showing the student's current SVG_Pet (at reduced size, minimum 64×64 CSS pixels), the Evolution_Stage name, and a link to `/pet`.
2. WHEN an authenticated student views the Dashboard and has no `student_pets` row, THE Pet_Preview_Card SHALL display the egg illustration with the label "Your egg is waiting!" and a link to `/pet`.
3. THE Pet_Preview_Card SHALL NOT require an additional database round-trip beyond what the Dashboard already performs; it SHALL reuse the student's existing session data or a single combined query.

---

### Requirement 11: Teacher Pet Overview

**User Story:** As a teacher, I want to see all my students' pets in a class overview, so that I can use pet progress as an engagement metric.

#### Acceptance Criteria

1. WHEN an authenticated teacher views the teacher dashboard or a class detail page, THE Teacher_Pet_Overview SHALL display a grid of all enrolled students' pets, showing each student's name, SVG_Pet thumbnail (minimum 48×48 CSS pixels), Species name, and Evolution_Stage.
2. THE Teacher_Pet_Overview SHALL be read-only; teachers SHALL NOT be able to modify student pet data from this view.
3. WHEN a student has no `student_pets` row, THE Teacher_Pet_Overview SHALL display an egg placeholder for that student; WHEN a student has a `student_pets` row with incomplete or partial data, THE Teacher_Pet_Overview SHALL display the actual pet data as stored.
4. THE Teacher_Pet_Overview SHALL load pet data using a query permitted by the teacher RLS policy on `student_pets`.

---

### Requirement 12: New Pet (Species Change) Item

**User Story:** As a student, I want to be able to adopt a different species by redeeming a special shop item, so that I have a reason to keep earning points even after choosing my first pet.

#### Acceptance Criteria

1. WHEN a student redeems a Pet_Item, THE Pet_System SHALL update the student's `student_pets` row to set `species` to the species specified by the Pet_Item, reset `xp` to 0, reset `evolution_stage` to `'baby'`, and clear `equipped_accessories`.
2. WHEN a student redeems a Pet_Item, THE Pet_Page SHALL display the Evolution_Sparkle animation to celebrate the new adoption.
3. THE Admin_Shop_Page SHALL allow teachers to specify the target species when creating a Pet_Item, using a selector with options: Dragon, Fox, Cat.
4. IF a student redeems a Pet_Item for the same species they currently have, THEN THE Pet_System SHALL still reset XP and stage as specified in criterion 1 of this requirement.

