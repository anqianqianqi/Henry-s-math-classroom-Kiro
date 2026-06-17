-- ─────────────────────────────────────────────────────────────────────────────
-- Book Skins: admin-uploaded cover & page images that can be sold in the shop
-- ─────────────────────────────────────────────────────────────────────────────

-- Storage bucket for book skin images (reuses shop-images bucket pattern)
INSERT INTO storage.buckets (id, name, public)
VALUES ('book-skins', 'book-skins', true)
ON CONFLICT (id) DO NOTHING;

-- Admins / teachers can upload
CREATE POLICY "book_skins_teacher_upload" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'book-skins'
    AND EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('teacher', 'administrator')
        AND ur.class_id IS NULL
    )
  );

-- Anyone can read (public bucket)
CREATE POLICY "book_skins_public_read" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'book-skins');

-- Admins / teachers can delete
CREATE POLICY "book_skins_teacher_delete" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'book-skins'
    AND EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('teacher', 'administrator')
        AND ur.class_id IS NULL
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- book_skins table
-- Each row is one skin (either a cover image or a page image).
-- When sold through the shop, link the shop_item to this skin's id.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS book_skins (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  description  TEXT,
  skin_type    TEXT NOT NULL CHECK (skin_type IN ('cover', 'page')),
  image_url    TEXT NOT NULL,   -- resized & stored in book-skins bucket
  -- target pixel dimensions used when resizing on upload
  -- cover: 400×620  |  page: 800×620
  width        INTEGER NOT NULL,
  height       INTEGER NOT NULL,
  is_default   BOOLEAN NOT NULL DEFAULT false,  -- one cover + one page can be default
  is_active    BOOLEAN NOT NULL DEFAULT true,
  shop_item_id UUID REFERENCES shop_items(id) ON DELETE SET NULL,  -- set when selling
  created_by   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE book_skins ENABLE ROW LEVEL SECURITY;

-- Anyone can read active skins (needed for student challenge page)
CREATE POLICY "book_skins_public_read" ON book_skins
  FOR SELECT USING (is_active = true);

-- Admins / teachers can do everything
CREATE POLICY "book_skins_admin_all" ON book_skins
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('teacher', 'administrator')
        AND ur.class_id IS NULL
    )
  );

-- Convenience index
CREATE INDEX IF NOT EXISTS idx_book_skins_type ON book_skins(skin_type);
CREATE INDEX IF NOT EXISTS idx_book_skins_default ON book_skins(skin_type, is_default) WHERE is_default = true;
