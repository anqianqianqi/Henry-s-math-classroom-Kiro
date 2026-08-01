-- ============================================================
-- Only TAs, teachers and the asker may reply in the bubble room
-- ============================================================
-- Run in the Supabase SQL editor. Safe to re-run.
--
-- Until now brr_insert asked only "are you signed in, and posting as
-- yourself?", so any student could answer any question. Answering is a TA's
-- job, so this narrows it to three people:
--
--   1. the person who asked        — a thread is a conversation, and a TA who
--                                    replies "what have you tried?" needs the
--                                    asker to be able to answer
--   2. teachers and administrators
--   3. holders of an unrevoked bubble_room_ta badge
--
-- ── EXISTING REPLIES ARE NOT TOUCHED ────────────────────────
-- This is an INSERT policy. Every reply already written stays exactly where it
-- is, including replies from students who can no longer post new ones. Nothing
-- here deletes or hides history.
--
-- ── ONE CONSEQUENCE WORTH KNOWING ───────────────────────────
-- TA points are earned by being thanked for a reply. Once non-TA students can
-- no longer reply to other people, they can no longer earn TA points from new
-- questions — the currency becomes a TA's. Points already earned are untouched
-- and remain spendable.
-- ============================================================

-- ── The rule, as one function ───────────────────────────────
-- A function rather than three subqueries inlined in the policy, so the UI's
-- copy of the rule (lib/utils/bubbleAnswerPermission.ts) has exactly one thing
-- to agree with, and a future reader can see the whole rule in one place.
--
-- SECURITY DEFINER because a student's own user_roles and user_badges rows may
-- not be selectable under their own RLS; the function only ever asks about
-- auth.uid(), so it cannot be used to inspect anybody else.

CREATE OR REPLACE FUNCTION can_answer_bubble(p_question_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- 1. Your own thread.
    EXISTS (
      SELECT 1 FROM bubble_room_questions q
       WHERE q.id = p_question_id
         AND q.user_id = auth.uid()
    )
    -- 2. Staff. class_id IS NULL matches how app/bubble-room/page.tsx decides
    --    somebody is a teacher; a class-scoped role is not site-wide staff, and
    --    disagreeing with the page would show a reply box the database refuses.
    OR EXISTS (
      SELECT 1 FROM user_roles ur
        JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = auth.uid()
         AND ur.class_id IS NULL
         AND r.name IN ('teacher', 'administrator')
    )
    -- 3. TA badge, still held. revoked_at matters: a removed TA stops being
    --    able to answer, which is the point of being able to remove one.
    OR EXISTS (
      SELECT 1 FROM user_badges ub
        JOIN badge_definitions bd ON bd.id = ub.badge_id
       WHERE ub.user_id = auth.uid()
         AND bd.slug = 'bubble_room_ta'
         AND ub.revoked_at IS NULL
    );
$$;

-- ── The policy ──────────────────────────────────────────────
-- user_id = auth.uid() is kept from the original: it stops a reply being filed
-- under somebody else's name, which is a different attack from this one.

DROP POLICY IF EXISTS "brr_insert" ON bubble_room_responses;
CREATE POLICY "brr_insert"
  ON bubble_room_responses FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND user_id = auth.uid()
    AND can_answer_bubble(question_id)
  );

-- ── Check ───────────────────────────────────────────────────
-- NOT can_answer_bubble() directly: the SQL editor has no signed-in user, so
-- auth.uid() is NULL there and the function returns false for everything —
-- which looks identical to a broken policy. These ask the same questions of a
-- named user instead.

-- 1. Is the policy the new one? Expect can_answer_bubble in the WITH CHECK.
SELECT pg_get_expr(polwithcheck, polrelid) AS insert_rule
FROM pg_policy
WHERE polrelid = 'bubble_room_responses'::regclass
  AND polname = 'brr_insert';

-- 2. Who may now answer other people's questions? Expect every teacher and
--    every TA to show true, and ordinary students to show false on both.
SELECT
  COALESCE(p.nickname, p.full_name) AS name,
  EXISTS (
    SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = p.id AND ur.class_id IS NULL
       AND r.name IN ('teacher', 'administrator')
  ) AS is_staff,
  EXISTS (
    SELECT 1 FROM user_badges ub JOIN badge_definitions bd ON bd.id = ub.badge_id
     WHERE ub.user_id = p.id AND bd.slug = 'bubble_room_ta'
       AND ub.revoked_at IS NULL
  ) AS is_ta
FROM profiles p
ORDER BY is_staff DESC, is_ta DESC, name;
