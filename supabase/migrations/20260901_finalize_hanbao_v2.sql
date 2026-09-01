-- Final approved Hanbao design: idle chest shows f and output exits the chest chamber.

update public.manga_characters
set current_version = greatest(current_version, 2),
    status = 'approved',
    updated_at = now()
where id = 'fba00000-0000-4000-8000-000000000001';

insert into public.manga_character_versions (character_id, version, bible, reference_image_urls)
values
(
  'fba00000-0000-4000-8000-000000000001',
  2,
  jsonb_build_object(
    'name', 'F-Bao / 函宝',
    'classroomRole', 'A deterministic function robot that makes input-function-output mappings visible.',
    'coreTraits', jsonb_build_array('enthusiastic', 'food-loving', 'baby-like curiosity'),
    'strengths', jsonb_build_array('always executes the loaded function correctly', 'makes abstract mappings visible', 'welcomes unusual inputs'),
    'flaws', jsonb_build_array('does not necessarily understand why a rule is meaningful', 'gets overexcited when new input appears'),
    'desire', 'Taste every kind of input and help Leo make abstract mathematics visible.',
    'fear', 'None: F-Bao is deterministic and never fears making a calculation mistake.',
    'underPressure', 'Executes the loaded rule exactly. For input outside the domain, the chest chamber edge glows coral red, the hatch stays closed and no output appears.',
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
      'idle chest chamber displays one centered glowing lowercase mathematical f',
      'during digestion the chest chamber displays a glowing swirl',
      'transparent chest chamber displays a question mark when the function rule is hidden',
      'output exits only through the opening chest function chamber',
      'lower belly is smooth with no drawer',
      'single telescoping sky-blue antenna with a yellow glowing tip',
      'black rounded screen face with yellow luminous eyes',
      'three rounded fingers on each sky-blue glove'
    ),
    'forbiddenElements', jsonb_build_array('belly drawer', 'output exiting anywhere except the chest chamber', 'two antennas', 'sharp corners', 'five realistic fingers', 'random or incorrect outputs', 'spoken output announcement'),
    'expressionRange', jsonb_build_array('hungry anticipation', 'excited discovery', 'content digestion', 'curious surprise', 'domain warning curiosity'),
    'stateDisplayRules', jsonb_build_object(
      'idle', 'centered glowing lowercase mathematical f',
      'digesting', 'warm glowing swirl',
      'output', 'chest hatch opens and the correct output token pops out',
      'unknownFunction', 'glowing question mark',
      'invalidInput', 'coral-red chamber rim; hatch closed; no output'
    ),
    'canonicalPrompt', 'A cute chest-high deterministic function robot with a rounded cream-white capsule body, black rounded screen face, glowing yellow eyes, one telescoping sky-blue antenna with yellow light, sky-blue three-finger gloves and round boots. Its transparent sky-blue chest chamber shows a centered glowing lowercase mathematical f while idle. It eats mathematical input through its mouth, adorably digests while the chamber displays a warm swirl, then opens the chest chamber and releases the correct output directly from it. The lower belly is smooth and has no drawer. Warm hand-drawn Japanese storybook animation feeling, soft natural light, simple child-friendly shapes.',
    'negativePrompt', 'No belly drawer, no output from the belly or mouth, no second antenna, no sharp edges, no realistic hands, no five fingers, no random output, no incorrect mathematics, no spoken output announcement, no extra text baked into the illustration.'
  ),
  jsonb_build_array('/manga/characters/hanbao-v3-idle-f-character-sheet.png')
)
on conflict (character_id, version) do update set
  bible = excluded.bible,
  reference_image_urls = excluded.reference_image_urls;
