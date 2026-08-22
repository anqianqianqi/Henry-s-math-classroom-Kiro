-- ── The dashboard welcome card's pigment ──────────────────────────────────
--
-- The card now wears the same painted-paper treatment as every other card, and
-- the reader picks which wash: meadow, sky, dusk, sea or ash rose. This is
-- where that choice lives.
--
-- ── WHY IT IS A COLUMN AND NOT localStorage ───────────────
-- The site's rule for a reader's own settings is that they follow the account
-- rather than the browser — the language switcher works that way, and a
-- student who logs in on the family iPad should not find a different-coloured
-- dashboard waiting. localStorage would give the wrong answer on the second
-- device, which is a bug that reports itself as "it forgot".
--
-- ── WHY THIS TABLE ────────────────────────────────────────
-- user_book_skin_preferences already carries the reader's cover skin, page
-- skin, challenge room, texture package and radio colourway. A palette choice
-- is another of the same, and the dashboard already reads this row — so it
-- costs no extra round trip. A separate table would be a join for one string.
--
-- ── SAFE TO RUN BEFORE OR AFTER THE CODE ──────────────────
-- The dashboard reads this column inside a catch and writes it inside one, so
-- it degrades to the default palette while this has not been run. Running it
-- twice is a no-op.

ALTER TABLE user_book_skin_preferences
  ADD COLUMN IF NOT EXISTS dashboard_palette TEXT;

-- Constrained rather than free text: the id is looked up in PAPER_PALETTES and
-- an unknown one silently falls back to the default, so a typo would show up as
-- "the colour doesn't save" with nothing in the logs. Better to reject it here.
--
-- NULL is allowed and means "never chose one", which is not the same as having
-- chosen the default — worth keeping distinct if the default ever changes.
ALTER TABLE user_book_skin_preferences
  DROP CONSTRAINT IF EXISTS ubsp_dashboard_palette_known;
ALTER TABLE user_book_skin_preferences
  ADD CONSTRAINT ubsp_dashboard_palette_known
  CHECK (dashboard_palette IS NULL
         OR dashboard_palette IN ('meadow', 'sky', 'dusk', 'sea', 'rose'));

COMMENT ON COLUMN user_book_skin_preferences.dashboard_palette IS
  'Welcome-card wash chosen by this reader. Ids match PAPER_PALETTES in lib/ui/paperCard.ts; NULL means never chosen. Adding a palette means widening the check constraint here as well.';
