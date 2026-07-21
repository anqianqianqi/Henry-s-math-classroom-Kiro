-- Simplest fix: disable RLS on book_skin_overlays entirely.
-- These are public overlay image URLs — no user-sensitive data.
-- Anyone can see which objects are on a book cover skin.

ALTER TABLE book_skin_overlays DISABLE ROW LEVEL SECURITY;

-- Verify
SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'book_skin_overlays';
-- Expected: relrowsecurity = false
