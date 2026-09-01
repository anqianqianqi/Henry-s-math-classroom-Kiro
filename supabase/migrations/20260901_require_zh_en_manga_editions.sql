-- Every approved storyboard produces separate Chinese and English editions.

update public.manga_generation_preferences
set preference = preference || jsonb_build_object(
      'outputLanguages', jsonb_build_array('zh', 'en'),
      'editionMode', 'separate',
      'translationPolicy', 'After storyboard approval, render separate Chinese and English editions from the same locked panels. Translate copy only; preserve character poses, camera, visual math, pacing and answer exactly.',
      'avoidBilingualCrowding', true
    ),
    updated_at = now()
where preference_key = 'henry-classroom-default-v1';
