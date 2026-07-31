-- ============================================================
-- Stored translations for user-written text
-- ============================================================
-- Run in the Supabase SQL editor. Safe to re-run.
--
-- Every piece of text a student or teacher writes gets three forms:
--   the original (unchanged, in the existing column)
--   *_en   English
--   *_zh   Simplified Chinese
--   *_lang the detected language of the original: 'en' | 'zh' | 'other'
--
-- The original column is never overwritten. Whichever of _en/_zh matches the
-- reader's UI language is shown, falling back to the original when the
-- translation is missing — so a failed or pending translation degrades to
-- today's behaviour rather than an empty post.
--
-- When the source is 'en' the _en copy equals the original, and likewise for
-- 'zh'; storing it anyway keeps readers from having to know which column to
-- look in. When the source is neither, both are translated.
--
-- Math is preserved exactly: expressions are masked out before translation and
-- restored afterwards, so the model never sees them and cannot reword them.
-- ============================================================

-- ── Bubble room questions: title + body ─────────────────────
ALTER TABLE bubble_room_questions
  ADD COLUMN IF NOT EXISTS title_en TEXT,
  ADD COLUMN IF NOT EXISTS title_zh TEXT,
  ADD COLUMN IF NOT EXISTS text_en  TEXT,
  ADD COLUMN IF NOT EXISTS text_zh  TEXT,
  ADD COLUMN IF NOT EXISTS text_lang TEXT
    CHECK (text_lang IS NULL OR text_lang IN ('en', 'zh', 'other'));

-- ── Bubble room responses ───────────────────────────────────
ALTER TABLE bubble_room_responses
  ADD COLUMN IF NOT EXISTS text_en  TEXT,
  ADD COLUMN IF NOT EXISTS text_zh  TEXT,
  ADD COLUMN IF NOT EXISTS text_lang TEXT
    CHECK (text_lang IS NULL OR text_lang IN ('en', 'zh', 'other'));

-- ── Challenge solutions ─────────────────────────────────────
ALTER TABLE challenge_submissions
  ADD COLUMN IF NOT EXISTS content_en  TEXT,
  ADD COLUMN IF NOT EXISTS content_zh  TEXT,
  ADD COLUMN IF NOT EXISTS content_lang TEXT
    CHECK (content_lang IS NULL OR content_lang IN ('en', 'zh', 'other'));

-- ── Comments / replies on solutions ─────────────────────────
ALTER TABLE submission_comments
  ADD COLUMN IF NOT EXISTS content_en  TEXT,
  ADD COLUMN IF NOT EXISTS content_zh  TEXT,
  ADD COLUMN IF NOT EXISTS content_lang TEXT
    CHECK (content_lang IS NULL OR content_lang IN ('en', 'zh', 'other'));

COMMENT ON COLUMN bubble_room_questions.text_lang IS
  'Detected language of the original text. Translations live in text_en / text_zh; the original column is never overwritten.';

-- Finding rows that still need translating — used by a backfill, and useful
-- for spotting posts where the translation call failed.
CREATE INDEX IF NOT EXISTS idx_brq_untranslated
  ON bubble_room_questions (created_at) WHERE text_lang IS NULL;
CREATE INDEX IF NOT EXISTS idx_brr_untranslated
  ON bubble_room_responses (created_at) WHERE text_lang IS NULL;

-- ── Verify ──────────────────────────────────────────────────
SELECT 'bubble_room_questions' AS table_name,
       count(*) AS rows, count(text_lang) AS translated
FROM bubble_room_questions
UNION ALL SELECT 'bubble_room_responses', count(*), count(text_lang) FROM bubble_room_responses
UNION ALL SELECT 'challenge_submissions', count(*), count(content_lang) FROM challenge_submissions
UNION ALL SELECT 'submission_comments', count(*), count(content_lang) FROM submission_comments;
