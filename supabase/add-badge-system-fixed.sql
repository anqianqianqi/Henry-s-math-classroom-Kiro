-- ============================================================
-- Badge System Migration (fixed version)
-- Run this in Supabase SQL editor
-- ============================================================

-- ── Badge definitions ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS badge_definitions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         text        UNIQUE NOT NULL,
  name         text        NOT NULL,
  description  text,
  emoji        text        NOT NULL DEFAULT '🏅',
  color        text        NOT NULL DEFAULT 'green',
  earn_type    text        NOT NULL CHECK (earn_type IN ('application', 'rule_based', 'admin_assigned')),
  earn_rules   jsonb,
  require_application boolean NOT NULL DEFAULT false,
  is_active    boolean     NOT NULL DEFAULT true,
  sort_order   int         NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ── User badges ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_badges (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  badge_id     uuid        NOT NULL REFERENCES badge_definitions(id) ON DELETE CASCADE,
  granted_by   uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  granted_at   timestamptz NOT NULL DEFAULT now(),
  revoked_at   timestamptz,
  revoked_by   uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  CONSTRAINT uq_user_badge_active UNIQUE (user_id, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user   ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_badge  ON user_badges(badge_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_active ON user_badges(user_id, badge_id) WHERE revoked_at IS NULL;

-- ── Badge applications ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS badge_applications (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  badge_id          uuid        NOT NULL REFERENCES badge_definitions(id) ON DELETE CASCADE,
  note              text,
  status            text        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'denied')),
  reviewed_by       uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at       timestamptz,
  reviewer_comment  text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_badge_application_pending UNIQUE (user_id, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_badge_apps_status  ON badge_applications(status);
CREATE INDEX IF NOT EXISTS idx_badge_apps_user    ON badge_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_badge_apps_badge   ON badge_applications(badge_id);

-- ── RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE badge_definitions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges         ENABLE ROW LEVEL SECURITY;
ALTER TABLE badge_applications  ENABLE ROW LEVEL SECURITY;

-- badge_definitions: any authenticated user can read
DROP POLICY IF EXISTS "badge_defs_select" ON badge_definitions;
CREATE POLICY "badge_defs_select"
  ON badge_definitions FOR SELECT
  USING (true);

-- user_badges: any authenticated user can read
DROP POLICY IF EXISTS "user_badges_select" ON user_badges;
CREATE POLICY "user_badges_select"
  ON user_badges FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- badge_applications: student sees own; teacher/admin sees all
DROP POLICY IF EXISTS "badge_apps_select_own" ON badge_applications;
CREATE POLICY "badge_apps_select_own"
  ON badge_applications FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid()
        AND ur.class_id IS NULL
        AND r.name IN ('teacher', 'administrator')
    )
  );

DROP POLICY IF EXISTS "badge_apps_insert" ON badge_applications;
CREATE POLICY "badge_apps_insert"
  ON badge_applications FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "badge_apps_delete_own" ON badge_applications;
CREATE POLICY "badge_apps_delete_own"
  ON badge_applications FOR DELETE
  USING (user_id = auth.uid() AND status = 'pending');

-- ── Seed: Bubble Room TA badge ────────────────────────────────────────────
INSERT INTO badge_definitions (slug, name, description, emoji, color, earn_type, require_application, sort_order)
VALUES (
  'bubble_room_ta',
  'Bubble Room TA',
  'A student peer teaching assistant in the Bubble Room — approved by a teacher.',
  '🎓',
  'green',
  'application',
  true,
  10
)
ON CONFLICT (slug) DO NOTHING;

-- ── Notifications: add new types ──────────────────────────────────────────
-- The notifications table has a type CHECK constraint. We extend it here.
-- If this fails, run just this block separately.
ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'class_starting',
    'homework_graded',
    'new_comment',
    'homework_due_soon',
    'homework_assigned',
    'material_uploaded',
    'submission_received',
    'badge_application_result',
    'badge_revoked'
  ));
