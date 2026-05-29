# Tasks: Virtual Pet

## Task List

- [x] 1. Database migration
  - [x] 1.1 Create `supabase/add-virtual-pet.sql` migration file that adds `category`, `food_xp`, and `target_species` columns to `shop_items` and creates the `student_pets` table with RLS policies as specified in the design
  - [x] 1.2 Create the `redeem_item_v2` Postgres function in the migration file, extending the existing redemption logic to handle food XP updates and pet item species resets atomically

- [x] 2. TypeScript types and pure utilities
  - [x] 2.1 Create `lib/types/pet.ts` with `Species`, `EvolutionStage`, `PetAnimation`, `StudentPet`, `AccessoryItem` types
  - [x] 2.2 Extend `lib/types/shop.ts` to add `category`, `food_xp`, and `target_species` fields to `ShopItem`, `ShopItemForm`, and `ShopItemInsert`
  - [x] 2.3 Create `lib/utils/pet.ts` with `XP_THRESHOLDS`, `computeEvolutionStage`, `xpToNextStage`, `equipAccessory`, and `unequipAccessory` pure functions
  - [x] 2.4 Extend `lib/utils/shop.ts` — update `validateShopItemForm` to require `food_xp` when `category = 'food'` and require `target_species` when `category = 'pet'`; update `buildShopItemInsert` to include the new fields with correct null handling

- [x] 3. Property-based and unit tests for utilities
  - [x] 3.1 Write property tests in `lib/utils/__tests__/pet.test.ts` for Properties 1–3 (XP threshold monotonicity, feeding XP increase, feeding stage consistency) using fast-check with ≥100 iterations each
  - [x] 3.2 Write property tests for Properties 6–8 (equip adds to array, unequip removes from array, equip/unequip round trip)
  - [x] 3.3 Write property tests for Properties 9–10 (food form validation requires food_xp, non-food category produces null food_xp)
  - [x] 3.4 Write unit tests for boundary values of `computeEvolutionStage` (0, 99, 100, 299, 300, 699, 700, 10000) and `xpToNextStage` for all stages including legendary

- [x] 4. SVG pet illustrations
  - [x] 4.1 Create `components/pet/EggSvg.tsx` — a single shared egg SVG illustration rendered as inline SVG paths and shapes (no emoji, no external images), minimum 200×200 viewBox
  - [x] 4.2 Create `components/pet/PetSvg.tsx` — renders the correct inline SVG for the given species (dragon, fox, cat) and stage (baby, teen, adult, legendary), totaling 12 distinct illustrations; applies `idle` (scale pulse, 3s period, 1.0–1.04) or `happy` (vertical bounce, 3 cycles, 600ms) CSS animation based on the `animation` prop
  - [x] 4.3 Create `components/pet/EvolutionSparkle.tsx` — CSS radial particle burst (8 particles, 800ms) centered on the pet, triggered by a boolean `active` prop

- [x] 5. Background scenes
  - [x] 5.1 Create `components/pet/BackgroundScene.tsx` — renders one of five stage-specific backgrounds (nest, meadow, mountain, sky, cosmos) as inline SVG or CSS gradients with at least two unique illustrated elements per scene; applies a 600ms CSS cross-fade transition when the `stage` prop changes

- [x] 6. Pet page UI components
  - [x] 6.1 Create `components/pet/XpBar.tsx` — displays current XP and next-stage threshold; shows total XP with no target when stage is `'legendary'`
  - [x] 6.2 Create `components/pet/AccessoryInventory.tsx` — lists owned accessories with equip/unequip toggles; shows empty-state message directing to shop when no accessories are owned; calls `onEquip`/`onUnequip` callbacks
  - [x] 6.3 Create `components/pet/SpeciesSelector.tsx` — displays three species options (Dragon, Fox, Cat) with descriptions; calls `onSelect` callback with the chosen species; only shown when `evolution_stage = 'egg'`
  - [x] 6.4 Create `components/pet/PetPreviewCard.tsx` — compact widget showing the pet SVG at minimum 64×64px, evolution stage name, and a link to `/pet`; shows egg placeholder with "Your egg is waiting!" when `pet` prop is null

- [x] 7. Pet page (`/pet`)
  - [x] 7.1 Create `app/pet/page.tsx` — server-side auth check redirecting unauthenticated users to `/login` and non-student users to `/dashboard`
  - [x] 7.2 Implement pet initialization logic in the page: on first visit with no `student_pets` row, create the row with defaults (`evolution_stage = 'egg'`, `xp = 0`, `species = null`, `equipped_accessories = []`)
  - [x] 7.3 Implement species selection flow: show `SpeciesSelector` when `evolution_stage = 'egg'`; on selection, update the row to set `species` and `evolution_stage = 'baby'`, then trigger `EvolutionSparkle`
  - [x] 7.4 Implement the main pet display: render `BackgroundScene`, `PetSvg` (or `EggSvg`), evolution stage label, `XpBar`, equipped accessories as SVG overlays, and `AccessoryInventory`
  - [x] 7.5 Implement the Happy_Animation trigger: when the page loads after a feeding (detected via query param or session storage flag set by the shop page), apply the `happy` animation to `PetSvg` and display the transient `+N XP` label that fades out after 2 seconds
  - [x] 7.6 Implement equip/unequip handlers with optimistic UI updates: immediately update local state, call Supabase to update `equipped_accessories`, revert and show error on failure
  - [x] 7.7 Display the student's current spendable balance and a "Go to Shop" link

- [x] 8. Admin shop page updates
  - [x] 8.1 Add a `category` selector (Food, Accessory, New Pet, Other) to the create/edit form in `app/admin/shop/page.tsx`
  - [x] 8.2 Conditionally show a `food_xp` integer field (1–500) when `category = 'food'` is selected; hide it and clear the value for other categories
  - [x] 8.3 Conditionally show a `target_species` selector (Dragon, Fox, Cat) when `category = 'pet'` is selected; hide it for other categories
  - [x] 8.4 Wire the new fields through form state, validation (using the updated `validateShopItemForm`), and the insert/update Supabase calls

- [x] 9. Student shop page updates
  - [x] 9.1 Display a category badge on each shop item card in `app/shop/page.tsx` (e.g., "🍖 Food", "🎩 Accessory", "🐾 New Pet")

- [x] 10. Redemption API update
  - [x] 10.1 Update `app/api/shop/redeem/route.ts` to call `redeem_item_v2` instead of `redeem_item`; parse and return `xp_gained`, `new_xp`, `new_stage`, and `species_changed` from the RPC response
  - [x] 10.2 Update the shop page's `handleRedeem` function to store the `xp_gained` value in session storage so the pet page can display the `+N XP` label on next visit

- [x] 11. Dashboard pet preview card
  - [x] 11.1 Add a `student_pets` query to `loadUser` in `app/dashboard/page.tsx` (combined with the existing user query to avoid an extra round-trip)
  - [x] 11.2 Render `PetPreviewCard` in the student dashboard stats grid, passing the fetched pet data (or null if no row exists)

- [x] 12. Teacher pet overview
  - [x] 12.1 Add a "Student Pets" section to the teacher dashboard (or a class detail page) that queries all `student_pets` rows using the teacher RLS policy and displays a grid of student name, `PetSvg` thumbnail (minimum 48×48px), species name, and evolution stage
  - [x] 12.2 Ensure the teacher pet overview is read-only — no equip/unequip or feeding controls are shown

- [x] 13. End-to-end verification
  - [x] 13.1 Run the migration against the local Supabase instance and verify all columns, constraints, and RLS policies are applied correctly
  - [x] 13.2 Manually test the full student flow: visit `/pet` → egg appears → select species → baby appears with sparkle → redeem food item → XP increases and happy animation plays → evolve through stages
  - [x] 13.3 Manually test the teacher flow: create food/accessory/pet shop items → verify category badges appear in student shop → verify teacher pet overview shows all students' pets
  - [x] 13.4 Run all unit and property tests (`npx jest lib/utils/__tests__/pet.test.ts`) and confirm they pass
