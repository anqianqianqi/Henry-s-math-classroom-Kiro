-- Keep scale-bearing math props visually consistent across every comic panel.

update public.manga_generation_preferences
set preference = jsonb_set(
      preference,
      '{propContinuity}',
      to_jsonb('When mathematical props have different capacities, lengths or sizes, give them persistently different outer silhouettes across every panel. Keep source and target direction explicit; internal fill level must never change the prop''s physical dimensions.'::text),
      true
    ),
    updated_at = now()
where preference_key = 'henry-classroom-default-v1';
