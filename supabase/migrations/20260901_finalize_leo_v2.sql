-- Final approved Leo design and behavior bible.

update public.manga_characters
set current_version = greatest(current_version, 2),
    status = 'approved',
    updated_at = now()
where id = '1e000000-0000-4000-8000-000000000001';

insert into public.manga_character_versions (character_id, version, bible, reference_image_urls)
values
(
  '1e000000-0000-4000-8000-000000000001',
  2,
  jsonb_build_object(
    'name', 'Leo / 乐欧',
    'classroomRole', 'The quiet student thinker who discovers patterns, explains meaning and verifies Funbo’s deterministic output.',
    'coreTraits', jsonb_build_array('intelligent', 'quiet', 'focused', 'gentle', 'dependable'),
    'strengths', jsonb_build_array('usually reaches the correct conclusion', 'finds hidden patterns', 'organizes possibilities', 'tests conjectures', 'explains reasoning clearly'),
    'flaws', jsonb_build_array('needs time to observe before speaking', 'will not pretend an ambiguous problem has one certain answer'),
    'desire', 'Discover patterns, understand why rules work, and help others see the reasoning.',
    'fear', 'Giving a confident explanation without enough evidence.',
    'underPressure', 'Lists the possibilities on his tablet, then tests inputs with Funbo until the pattern is clear.',
    'humorMechanism', 'Uses occasional gentle deadpan observations without distracting from the mathematics.',
    'mathRelationship', 'Reasoning and meaning specialist; interprets, verifies and explains rather than merely calculating.',
    'speakingStyle', 'Usually quiet. When explaining mathematics, he is clear and complete, with occasional mild deadpan humor.',
    'neverSays', jsonb_build_array('Just trust the machine.', 'There must always be one answer.', 'I do not need to verify it.'),
    'entityType', 'East Asian human boy, visually 10–12 years old',
    'silhouette', 'Ordinary same-age height and balanced build, with a soft round face and layered fluffy short hair.',
    'signatureOutfit', 'Plain soft cream-yellow pullover hoodie, deep navy straight-leg trousers, and white sneakers with sky-blue shoelaces.',
    'palette', jsonb_build_array(
      jsonb_build_object('name','cream yellow','hex','#F8E7B0','usage','plain hoodie'),
      jsonb_build_object('name','deep navy','hex','#243B5A','usage','trousers'),
      jsonb_build_object('name','sky blue','hex','#72C7E8','usage','writing tablet and shoelaces'),
      jsonb_build_object('name','hair black','hex','#242424','usage','layered fluffy short hair'),
      jsonb_build_object('name','deep brown','hex','#4A3024','usage','round eyes'),
      jsonb_build_object('name','white','hex','#FAFAF7','usage','stylus and sneakers')
    ),
    'immutableAnchors', jsonb_build_array(
      'soft cute round face with deep-brown round eyes',
      'layered fluffy black short hair with subtly flipped tips',
      'one small upward-curving tuft on the left side of his forehead',
      'no glasses',
      'plain cream-yellow hoodie with no badge, logo or graphic',
      'deep navy straight-leg trousers',
      'white sneakers with sky-blue shoelaces',
      'slim sky-blue writing tablet and white stylus'
    ),
    'signatureActions', jsonb_build_array(
      'crosses his arms and quietly studies a difficult problem',
      'subtly twirls the white stylus while thinking',
      'eyes brighten and he immediately writes when he sees the solution',
      'offers Funbo an input, crouches to the same eye level and observes the chest chamber',
      'smiles warmly and draws a diagram when explaining why Funbo’s answer works'
    ),
    'relationshipWithHanbao', 'Leo treats Funbo as a partner. Funbo executes the function correctly; Leo discovers, verifies and explains why the mapping works.',
    'forbiddenElements', jsonb_build_array('glasses', 'toddler proportions', 'hoodie badge', 'hoodie logo or text', 'formal school uniform', 'different hair color', 'frantic or foolish behavior', 'boastful or smug behavior', 'mocking mistakes'),
    'expressionRange', jsonb_build_array('calm observation', 'focused concentration', 'bright discovery', 'gentle smile', 'thoughtful uncertainty', 'restrained deadpan amusement'),
    'canonicalPrompt', 'Leo is an original East Asian boy visually aged 10–12, with ordinary same-age height, a balanced build, a soft cute round face, deep-brown round eyes and layered fluffy black short hair with subtly flipped tips. One small tuft curves upward on the left side of his forehead. He wears no glasses. His outfit is a completely plain soft cream-yellow pullover hoodie, deep navy straight-leg trousers, and clean white sneakers with sky-blue shoelaces. He carries a slim sky-blue writing tablet and a white stylus. His energy is quiet, focused, intelligent, gentle and dependable. Warm hand-drawn Japanese children’s storybook animation feeling, soft ink, watercolor and gouache texture, gentle natural light.',
    'negativePrompt', 'No glasses, no toddler proportions, no hoodie badge, logo, text or graphic, no formal uniform, no tie, no backpack, no different hair color, no long hair, no frantic, foolish, boastful, smug or aggressive expression, no baked-in prose.'
  ),
  jsonb_build_array('/manga/characters/leo-v1-character-sheet.png')
)
on conflict (character_id, version) do update set
  bible = excluded.bible,
  reference_image_urls = excluded.reference_image_urls;
