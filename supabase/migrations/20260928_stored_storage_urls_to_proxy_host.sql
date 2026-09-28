-- Point stored storage URLs at the host a browser can actually reach.
--
-- Uploads save an absolute URL — image_url, cover_url, file_url and friends —
-- and those outlive the request that wrote them. Every one written before the
-- China proxy landed names thgaokonzsabpvhfbfdy.supabase.co, which students in
-- mainland China cannot reach, so their pictures stay broken even once they can
-- log in again.
--
-- Only the domain differs between the two hosts; the project ref is the first
-- label on both sides, so this is a plain string swap and nothing about the
-- path, bucket or object name changes.
--
-- RUN THE DRY RUN FIRST (it is in the session notes, and reports row counts per
-- column without writing anything). This migration is reversible: swap the two
-- values below and run it again.
--
-- Scope note: text and varchar columns only. jsonb columns are deliberately
-- left alone — the dry run lists them separately so they can be judged by hand
-- rather than rewritten blind.

DO $$
DECLARE
  old_host constant text := 'https://thgaokonzsabpvhfbfdy.supabase.co';
  new_host constant text := 'https://thgaokonzsabpvhfbfdy.henrymathclassroom.com';
  col record;
  touched bigint;
  total bigint := 0;
BEGIN
  FOR col IN
    SELECT c.table_name, c.column_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema
     AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      AND c.data_type IN ('text', 'character varying')
      AND c.is_generated = 'NEVER'
    ORDER BY c.table_name, c.column_name
  LOOP
    EXECUTE format(
      'UPDATE public.%I SET %I = replace(%I, %L, %L) WHERE %I LIKE %L',
      col.table_name, col.column_name, col.column_name,
      old_host, new_host,
      col.column_name, '%' || old_host || '%'
    );

    GET DIAGNOSTICS touched = ROW_COUNT;
    IF touched > 0 THEN
      total := total + touched;
      RAISE NOTICE 'rewrote % row(s) in %.%', touched, col.table_name, col.column_name;
    END IF;
  END LOOP;

  RAISE NOTICE 'done — % row(s) rewritten in total', total;
END $$;
