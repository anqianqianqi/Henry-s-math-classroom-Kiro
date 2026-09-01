-- Prefer comprehension over a fixed six-panel length.

update public.manga_generation_preferences
set preference = preference || jsonb_build_object(
      'layout', 'adaptive 2-column manga pages',
      'preferredPanelsPerPage', 6,
      'panelsPerPageRange', '4–8',
      'totalPanelRange', '6–18',
      'continuation', 'Add pages freely when more context, dialogue or intermediate reasoning makes the story easier to understand.',
      'storyDensity', 'visually low, narratively complete',
      'panelRule', 'one main action and one main idea per panel; use additional panels instead of compressing context',
      'dialogue', 'Use enough short speech bubbles to establish context and connect the reasoning. Never remove an explanation merely to make the comic shorter.',
      'priority', 'Clarity, context, mathematical understanding and fun are more important than panel count.'
    ),
    updated_at = now()
where preference_key = 'henry-classroom-default-v1';
