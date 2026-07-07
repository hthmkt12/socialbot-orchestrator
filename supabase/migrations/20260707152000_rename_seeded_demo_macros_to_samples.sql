/*
  Normalize sample macro seed copy.

  The RPC name remains seed_demo_macros for compatibility with existing
  frontend calls and historical migrations. This migration updates the current
  function body so newly loaded sample macros no longer appear as "Demo" items.
*/

DO $$
DECLARE
  function_sql text;
BEGIN
  SELECT pg_get_functiondef('public.seed_demo_macros()'::regprocedure)
    INTO function_sql;

  function_sql := replace(function_sql, 'Input Text Demo', 'Input Text Sample');
  function_sql := replace(function_sql, 'Simple Form Fill Demo', 'Simple Form Fill Sample');
  function_sql := replace(function_sql, 'Grouped Demo Sequence', 'Grouped Sample Sequence');
  function_sql := replace(function_sql, '"demo"', '"sample"');
  function_sql := replace(function_sql, '''demo''', '''sample''');

  EXECUTE function_sql;
END;
$$;

UPDATE public.macros
SET name = CASE key
    WHEN 'input_text_demo' THEN 'Input Text Sample'
    WHEN 'simple_form_fill_demo' THEN 'Simple Form Fill Sample'
    WHEN 'grouped_demo_sequence' THEN 'Grouped Sample Sequence'
    ELSE name
  END
WHERE key IN ('input_text_demo', 'simple_form_fill_demo', 'grouped_demo_sequence');

UPDATE public.macro_versions
SET
  definition_json = replace(
    replace(definition_json::text, 'Input Text Demo', 'Input Text Sample'),
    '"demo"',
    '"sample"'
  )::jsonb,
  tags_json = replace(tags_json::text, '"demo"', '"sample"')::jsonb
WHERE macro_id IN (
  SELECT id FROM public.macros
  WHERE key IN ('input_text_demo', 'launch_app_and_capture', 'open_and_swipe_feed')
);

UPDATE public.macro_versions
SET
  definition_json = replace(
    replace(definition_json::text, 'Simple Form Fill Demo', 'Simple Form Fill Sample'),
    '"demo"',
    '"sample"'
  )::jsonb,
  tags_json = replace(tags_json::text, '"demo"', '"sample"')::jsonb
WHERE macro_id IN (
  SELECT id FROM public.macros
  WHERE key = 'simple_form_fill_demo'
);

UPDATE public.macro_versions
SET
  definition_json = replace(
    replace(definition_json::text, 'Grouped Demo Sequence', 'Grouped Sample Sequence'),
    '"demo"',
    '"sample"'
  )::jsonb,
  tags_json = replace(tags_json::text, '"demo"', '"sample"')::jsonb
WHERE macro_id IN (
  SELECT id FROM public.macros
  WHERE key = 'grouped_demo_sequence'
);
