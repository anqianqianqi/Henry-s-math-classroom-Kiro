-- Clear translation columns that were cached without a translation ever happening.
--
-- When no translation engine was reachable, translateUserText returned the
-- original in both slots and the caller stored it. That is indistinguishable
-- from a finished translation, so the row was marked done forever and would
-- never be retried — not even after an API key was configured.
--
-- The code no longer writes those (translateUserText reports 'unavailable' and
-- the route refuses to cache it). This clears the rows already affected so the
-- next reader regenerates them.
--
-- Safe to re-run. Nulling a translation costs one retranslation, nothing more.
--
-- ── What is deliberately NOT matched ──────────────────────────────────────
--
-- A correctly translated English post also has text_en = text: the source
-- language keeps the original verbatim rather than round-tripping it. That is
-- why BOTH columns must equal the original to count as suspect.
--
-- Pure-math posts legitimately have both equal to the original — "$x = 2y$"
-- reads the same in every language and is never sent to an engine. The regex
-- strips $...$ and requires a letter to survive, so those are left alone.
--
-- ── Read the output ───────────────────────────────────────────────────────
--
-- Each statement reports its own row count, and there is no surrounding
-- transaction: one failing table cannot silently roll back the others. Run the
-- whole file, then read the final SELECT — every count should be 0.

-- 1. Bubble room questions — body
update bubble_room_questions
set text_en = null, text_zh = null, text_lang = null
where text_en = text
  and text_zh = text
  and regexp_replace(text, '\$[^$]*\$', '', 'g') ~ '[[:alpha:]]';

-- 2. Bubble room questions — title
update bubble_room_questions
set title_en = null, title_zh = null
where title is not null
  and title_en = title
  and title_zh = title
  and regexp_replace(title, '\$[^$]*\$', '', 'g') ~ '[[:alpha:]]';

-- 3. Bubble room answers and replies
update bubble_room_responses
set text_en = null, text_zh = null, text_lang = null
where text_en = text
  and text_zh = text
  and regexp_replace(text, '\$[^$]*\$', '', 'g') ~ '[[:alpha:]]';

-- 4. Challenge solutions
update challenge_submissions
set content_en = null, content_zh = null, content_lang = null
where content_en = content
  and content_zh = content
  and regexp_replace(content, '\$[^$]*\$', '', 'g') ~ '[[:alpha:]]';

-- 5. Comments on solutions
update submission_comments
set content_en = null, content_zh = null, content_lang = null
where content_en = content
  and content_zh = content
  and regexp_replace(content, '\$[^$]*\$', '', 'g') ~ '[[:alpha:]]';

-- ── Verify ────────────────────────────────────────────────────────────────
-- Every still_suspect must be 0. A non-zero count means that table's update
-- did not apply — scroll up and look for its error.
select 'bubble_room_questions.text' as what, count(*) as still_suspect
from bubble_room_questions
where text_en = text and text_zh = text
  and regexp_replace(text, '\$[^$]*\$', '', 'g') ~ '[[:alpha:]]'
union all
select 'bubble_room_questions.title', count(*)
from bubble_room_questions
where title is not null and title_en = title and title_zh = title
  and regexp_replace(title, '\$[^$]*\$', '', 'g') ~ '[[:alpha:]]'
union all
select 'bubble_room_responses.text', count(*)
from bubble_room_responses
where text_en = text and text_zh = text
  and regexp_replace(text, '\$[^$]*\$', '', 'g') ~ '[[:alpha:]]'
union all
select 'challenge_submissions.content', count(*)
from challenge_submissions
where content_en = content and content_zh = content
  and regexp_replace(content, '\$[^$]*\$', '', 'g') ~ '[[:alpha:]]'
union all
select 'submission_comments.content', count(*)
from submission_comments
where content_en = content and content_zh = content
  and regexp_replace(content, '\$[^$]*\$', '', 'g') ~ '[[:alpha:]]';
