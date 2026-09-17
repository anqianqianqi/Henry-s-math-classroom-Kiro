-- Rename 函宝's approved English name while preserving the stable character ID.

update public.manga_characters
set name = 'Funbo / 函宝',
    updated_at = now()
where id = 'fba00000-0000-4000-8000-000000000001';

update public.manga_character_versions
set bible = replace(bible::text, 'F-Bao', 'Funbo')::jsonb
where character_id in (
  'fba00000-0000-4000-8000-000000000001',
  '1e000000-0000-4000-8000-000000000001'
)
and bible::text like '%F-Bao%';
