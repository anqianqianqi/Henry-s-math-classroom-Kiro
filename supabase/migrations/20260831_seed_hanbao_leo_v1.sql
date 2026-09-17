-- Canonical v1 cast for the Henry Math Classroom manga workflow.
-- Fixed IDs make the seed idempotent and keep comic references stable.

insert into public.manga_characters (id, name, status, current_version)
values
  ('fba00000-0000-4000-8000-000000000001', 'Funbo / 函宝', 'approved', 1),
  ('1e000000-0000-4000-8000-000000000001', 'Leo / 乐欧', 'approved', 1)
on conflict (id) do update set
  name = excluded.name,
  status = excluded.status,
  current_version = greatest(manga_characters.current_version, excluded.current_version),
  updated_at = now();

insert into public.manga_character_versions (character_id, version, bible, reference_image_urls)
values
(
  'fba00000-0000-4000-8000-000000000001',
  1,
  jsonb_build_object(
    'name', 'Funbo / 函宝',
    'classroomRole', 'A deterministic function robot that makes input-function-output mappings visible.',
    'coreTraits', jsonb_build_array('enthusiastic', 'food-loving', 'baby-like curiosity'),
    'strengths', jsonb_build_array('always executes the loaded function correctly', 'makes abstract mappings visible', 'welcomes unusual inputs'),
    'flaws', jsonb_build_array('does not necessarily understand why a rule is meaningful', 'gets overexcited when new input appears'),
    'desire', 'Taste every kind of input and help Leo make abstract mathematics visible.',
    'fear', 'None: Funbo is deterministic and never fears making a calculation mistake.',
    'underPressure', 'Executes the loaded rule exactly. For input outside the domain, the chamber edge glows red and the output drawer remains closed.',
    'humorMechanism', 'Treats inputs like snacks and performs computation as adorable digestion.',
    'mathRelationship', 'Embodies a deterministic function: identical function and input always produce identical output.',
    'speakingStyle', 'Short, excited food metaphors. Output is shown visually rather than announced.',
    'catchphrases', jsonb_build_array('Snack time！开始运算！'),
    'neverSays', jsonb_build_array('I guessed the answer.', 'Maybe the output is...', 'I calculated it wrong.'),
    'entityType', 'cute function robot',
    'silhouette', 'Rounded cream-white capsule body, chest-high beside Leo, with one telescoping antenna.',
    'signatureOutfit', 'Cream-white shell, sky-blue gloves and round boots, transparent sky-blue function chamber.',
    'palette', jsonb_build_array(
      jsonb_build_object('name','cream white','hex','#FFF4DC','usage','main body shell'),
      jsonb_build_object('name','sky blue','hex','#72C7E8','usage','function chamber, gloves, boots and antenna'),
      jsonb_build_object('name','warm yellow','hex','#FFD84D','usage','eyes, antenna light and active highlights'),
      jsonb_build_object('name','screen black','hex','#17252B','usage','rounded face screen')
    ),
    'immutableAnchors', jsonb_build_array(
      'mouth is the input entrance',
      'transparent chest chamber displays the current glowing function or a question mark when hidden',
      'belly drawer is the output exit',
      'single telescoping sky-blue antenna with a yellow glowing tip',
      'black rounded screen face with yellow luminous eyes',
      'three rounded fingers on each sky-blue glove'
    ),
    'forbiddenElements', jsonb_build_array('two antennas', 'sharp corners', 'five realistic fingers', 'random or incorrect outputs', 'spoken output announcement'),
    'expressionRange', jsonb_build_array('hungry anticipation', 'excited discovery', 'content digestion', 'curious surprise', 'domain warning curiosity'),
    'canonicalPrompt', 'A cute chest-high deterministic function robot with a rounded cream-white capsule body, black rounded screen face, glowing yellow eyes, one telescoping sky-blue antenna with yellow light, sky-blue three-finger gloves and round boots. It eats mathematical input through its mouth, adorably digests while a transparent sky-blue chest chamber displays the glowing function, and releases output from a belly drawer. Warm hand-drawn Japanese animation feeling, soft natural light, simple child-friendly shapes.',
    'negativePrompt', 'No second antenna, no sharp edges, no realistic hands, no random output, no incorrect mathematics, no text baked into the illustration.'
  ),
  '{}'
),
(
  '1e000000-0000-4000-8000-000000000001',
  1,
  jsonb_build_object(
    'name', 'Leo / 乐欧',
    'classroomRole', 'The calm student thinker who discovers patterns, explains meaning and verifies Funbo’s deterministic output.',
    'coreTraits', jsonb_build_array('intelligent', 'calm', 'observant'),
    'strengths', jsonb_build_array('usually reaches the correct conclusion', 'finds hidden patterns', 'checks whether output is reasonable', 'asks precise questions'),
    'flaws', jsonb_build_array('abstract ideas can remain hard to communicate without visualization', 'cannot force a unique answer from insufficient information'),
    'desire', 'Discover patterns, understand why rules work, and test conjectures with Funbo.',
    'fear', 'Pretending that an ambiguous problem has one certain answer.',
    'underPressure', 'Slows down, identifies missing information, and asks Funbo to visualize the mapping.',
    'humorMechanism', 'Quietly gives Funbo unusual inputs, then offers a restrained, affectionate observation.',
    'mathRelationship', 'Reasoning and meaning specialist; interprets and verifies rather than merely calculating.',
    'speakingStyle', 'Brief, orderly and calm, with occasional gentle deadpan humor toward Funbo.',
    'catchphrases', jsonb_build_array('先看规律。', '别急，先检查 Output。'),
    'neverSays', jsonb_build_array('Just trust the machine.', 'There must always be one answer.', 'I do not need to verify it.'),
    'entityType', 'human boy, visually 10–12 years old',
    'silhouette', 'Older school-age boy with a neat slim silhouette and naturally fluffy black short hair.',
    'signatureOutfit', 'Warm yellow hoodie with a small function-symbol badge, dark trousers and simple sneakers.',
    'palette', jsonb_build_array(
      jsonb_build_object('name','hoodie yellow','hex','#F4C430','usage','signature hoodie'),
      jsonb_build_object('name','hair black','hex','#242424','usage','fluffy short hair'),
      jsonb_build_object('name','trouser navy','hex','#334155','usage','trousers'),
      jsonb_build_object('name','warm skin','hex','#F2C6A0','usage','skin tone')
    ),
    'immutableAnchors', jsonb_build_array('naturally fluffy black short hair', 'warm yellow hoodie', 'small function-symbol badge', 'calm observant expression', 'visually 10–12 years old'),
    'forbiddenElements', jsonb_build_array('very young toddler proportions', 'frantic or foolish behavior', 'mocking students for mistakes', 'different hair color', 'formal adult clothing'),
    'expressionRange', jsonb_build_array('calm observation', 'quiet confidence', 'gentle amusement', 'focused explanation', 'thoughtful uncertainty'),
    'canonicalPrompt', 'Leo, an intelligent calm boy with a visual age of 10–12, naturally fluffy black short hair, dark expressive eyes, warm yellow hoodie with a tiny function-symbol badge, dark trousers and simple sneakers. He has an observant, reliable older-boy presence and restrained gentle humor. Warm hand-drawn Japanese animation feeling, soft natural light, clean child-friendly shapes.',
    'negativePrompt', 'No toddler proportions, no frantic expression, no different hair color, no formal adult clothing, no text baked into the illustration.'
  ),
  '{}'
)
on conflict (character_id, version) do update set
  bible = excluded.bible,
  reference_image_urls = excluded.reference_image_urls;
