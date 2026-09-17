-- Persistent default visual preference used by the admin manga agent.

create table if not exists public.manga_generation_preferences (
  preference_key text primary key,
  name text not null,
  preference jsonb not null,
  reference_image_urls text[] not null default '{}',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.manga_generation_preferences enable row level security;

insert into public.manga_generation_preferences (
  preference_key,
  name,
  preference,
  reference_image_urls,
  is_default
)
values (
  'henry-classroom-default-v1',
  'Henry warm classroom manga',
  jsonb_build_object(
    'layout', '2x3',
    'panelsPerPage', 6,
    'aspectRatio', '3:2',
    'readingOrder', 'left-to-right, top-to-bottom',
    'continuation', 'Add another 2x3 page only when six panels cannot explain the story clearly.',
    'panelBorders', 'thin slightly hand-drawn black borders with wide warm-white gutters',
    'panelNumbers', 'small yellow circle in the upper-left corner',
    'storyDensity', 'low',
    'panelRule', 'one story beat, one main action and one math idea per panel',
    'dialogue', 'short speech bubbles; prefer expressions and visual action',
    'mathText', 'only the essential equation for the current beat; exact typesetting when possible',
    'propContinuity', 'When mathematical props have different capacities, lengths or sizes, give them persistently different outer silhouettes across every panel. Keep source and target direction explicit; internal fill level must never change the prop’s physical dimensions.',
    'artDirection', 'warm cute clean hand-drawn classroom comic; soft watercolor and gouache; cream, sunny yellow, sky blue and gentle pastel backgrounds; soft natural classroom light; rounded child-friendly silhouettes',
    'backgrounds', 'minimal classroom details or a soft color wash',
    'answerReveal', 'last_panel',
    'characterPolicy', 'Use approved character-library references. The visual preference reference controls format and mood only.',
    'avoid', jsonb_build_array('dense infographic panels', 'crowded props', 'long paragraphs', 'photorealism', 'dark cinematic lighting', 'copying reference characters or compositions')
  ),
  array['/manga/preferences/henry-preferred-comic-reference.png'],
  true
)
on conflict (preference_key) do update set
  name = excluded.name,
  preference = excluded.preference,
  reference_image_urls = excluded.reference_image_urls,
  is_default = excluded.is_default,
  updated_at = now();
