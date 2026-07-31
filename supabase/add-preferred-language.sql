-- ============================================================
-- Account-wide UI language
-- ============================================================
-- Run in the Supabase SQL editor. Safe to re-run.
--
-- Lives on profiles rather than a new table so it is already loaded wherever
-- the profile is read, and follows the student across devices — a class laptop
-- and a home computer should not disagree about the language.
--
-- Scope: the app's own strings. Author-written content (class names, challenge
-- titles, hints, comments) stays as typed; challenge problems already carry
-- both languages in their .henryproblem snapshot, and tags have their own
-- per-language rows in challenge_tag_names.
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS preferred_language TEXT NOT NULL DEFAULT 'en'
  CHECK (preferred_language IN ('en', 'zh'));

COMMENT ON COLUMN profiles.preferred_language IS
  'UI language for this account: en | zh (Simplified Chinese). Applies to app chrome only, not author-written content.';

-- ── Verify ──────────────────────────────────────────────────
SELECT preferred_language, count(*) AS accounts
FROM profiles
GROUP BY preferred_language
ORDER BY accounts DESC;
