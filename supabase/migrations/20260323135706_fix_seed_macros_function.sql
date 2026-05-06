/*
  # Fix seed_demo_macros function

  1. Changes
    - Add unique index on macro_versions(macro_id, version_number) for upsert
    - Replace broken seed_demo_macros() function
      - Fix: was querying non-existent `users` table, now uses `profiles`
      - Fix: was checking for ADMIN role only, now falls back to any authenticated user
      - Fix: add explicit `public.` schema prefix for all table references
      - Fix: set search_path to public for correct resolution

  2. Notes
    - Function is called from frontend "Load Samples" button
    - Idempotent: safe to run multiple times
    - Returns JSON summary with inserted/updated counts
*/

CREATE UNIQUE INDEX IF NOT EXISTS idx_macro_versions_macro_version
  ON public.macro_versions (macro_id, version_number);

CREATE OR REPLACE FUNCTION public.seed_demo_macros()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  owner_id uuid;
  inserted_count int := 0;
  updated_count int := 0;
  macro_record record;
  version_record record;
  macro_data jsonb;
  all_macros jsonb[];
BEGIN
  SELECT id INTO owner_id
  FROM public.profiles
  WHERE role = 'ADMIN'
  LIMIT 1;

  IF owner_id IS NULL THEN
    SELECT id INTO owner_id
    FROM public.profiles
    LIMIT 1;
  END IF;

  IF owner_id IS NULL THEN
    RAISE EXCEPTION 'No user profile found. Please sign in first.';
  END IF;

  all_macros := ARRAY[
    jsonb_build_object(
      'key', 'launch_app_and_capture',
      'name', 'Launch App And Capture',
      'description', 'Launch app, wait, capture screenshot, get current app info',
      'tags', '["basic","screenshot","demo"]'::jsonb,
      'definition', '{
        "version":1,
        "meta":{"key":"launch_app_and_capture","name":"Launch App And Capture","tags":["basic","screenshot","demo"]},
        "inputs":{"appName":{"type":"string","required":true}},
        "target":{"mode":"single_device"},
        "execution":{"defaultTimeoutMs":10000,"maxRetries":1,"onError":"stop"},
        "steps":[
          {"id":"launch_1","type":"launch_app","params":{"appName":"{{appName}}"}},
          {"id":"wait_1","type":"wait","params":{"ms":3000}},
          {"id":"screen_1","type":"screenshot","params":{"saveToArtifact":true}},
          {"id":"current_1","type":"get_current_app","params":{}}
        ]
      }'::jsonb
    ),
    jsonb_build_object(
      'key', 'input_text_demo',
      'name', 'Input Text Demo',
      'description', 'Open app, tap input field, type text, capture screenshot',
      'tags', '["input","demo","ui"]'::jsonb,
      'definition', '{
        "version":1,
        "meta":{"key":"input_text_demo","name":"Input Text Demo","tags":["input","demo","ui"]},
        "inputs":{"appName":{"type":"string","required":true},"textValue":{"type":"string","required":true}},
        "target":{"mode":"single_device"},
        "execution":{"defaultTimeoutMs":12000,"maxRetries":1,"onError":"stop"},
        "steps":[
          {"id":"launch_1","type":"launch_app","params":{"appName":"{{appName}}"}},
          {"id":"wait_1","type":"wait","params":{"ms":2500}},
          {"id":"tap_1","type":"tap","params":{"x":0.5,"y":0.3}},
          {"id":"wait_2","type":"wait","params":{"ms":800}},
          {"id":"input_1","type":"input_text","params":{"text":"{{textValue}}"}},
          {"id":"wait_3","type":"wait","params":{"ms":1000}},
          {"id":"screen_1","type":"screenshot","params":{"saveToArtifact":true}}
        ]
      }'::jsonb
    ),
    jsonb_build_object(
      'key', 'open_and_swipe_feed',
      'name', 'Open And Swipe Feed',
      'description', 'Open app and swipe feed multiple times to verify UI',
      'tags', '["swipe","feed","demo"]'::jsonb,
      'definition', '{
        "version":1,
        "meta":{"key":"open_and_swipe_feed","name":"Open And Swipe Feed","tags":["swipe","feed","demo"]},
        "inputs":{"appName":{"type":"string","required":true}},
        "target":{"mode":"single_device"},
        "execution":{"defaultTimeoutMs":15000,"maxRetries":1,"onError":"stop"},
        "steps":[
          {"id":"launch_1","type":"launch_app","params":{"appName":"{{appName}}"}},
          {"id":"wait_1","type":"wait","params":{"ms":3000}},
          {"id":"swipe_1","type":"swipe","params":{"fromX":0.5,"fromY":0.8,"toX":0.5,"toY":0.25}},
          {"id":"wait_2","type":"wait","params":{"ms":1200}},
          {"id":"swipe_2","type":"swipe","params":{"fromX":0.5,"fromY":0.8,"toX":0.5,"toY":0.25}},
          {"id":"wait_3","type":"wait","params":{"ms":1200}},
          {"id":"screen_1","type":"screenshot","params":{"saveToArtifact":true}}
        ]
      }'::jsonb
    ),
    jsonb_build_object(
      'key', 'current_app_guard',
      'name', 'Current App Guard',
      'description', 'Check current app - screenshot if match, stop if mismatch',
      'tags', '["guard","conditional","validation"]'::jsonb,
      'definition', '{
        "version":1,
        "meta":{"key":"current_app_guard","name":"Current App Guard","tags":["guard","conditional","validation"]},
        "inputs":{"appName":{"type":"string","required":true},"expectedPackage":{"type":"string","required":true}},
        "target":{"mode":"single_device"},
        "execution":{"defaultTimeoutMs":12000,"maxRetries":0,"onError":"stop"},
        "steps":[
          {"id":"launch_1","type":"launch_app","params":{"appName":"{{appName}}"}},
          {"id":"wait_1","type":"wait","params":{"ms":2500}},
          {"id":"current_1","type":"get_current_app","params":{}},
          {"id":"if_1","type":"conditional","params":{"left":"{{steps.current_1.output.appPackage}}","operator":"equals","right":"{{expectedPackage}}"},
           "then":[{"id":"screen_ok","type":"screenshot","params":{"saveToArtifact":true}}],
           "else":[{"id":"stop_fail","type":"stop","params":{"reason":"Current package does not match expectedPackage"}}]}
        ]
      }'::jsonb
    ),
    jsonb_build_object(
      'key', 'multi_device_launch_check',
      'name', 'Multi Device Launch Check',
      'description', 'Run the same flow on multiple devices simultaneously',
      'tags', '["multi-device","batch","monitoring"]'::jsonb,
      'definition', '{
        "version":1,
        "meta":{"key":"multi_device_launch_check","name":"Multi Device Launch Check","tags":["multi-device","batch","monitoring"]},
        "inputs":{"appName":{"type":"string","required":true}},
        "target":{"mode":"multi_device"},
        "execution":{"defaultTimeoutMs":15000,"maxRetries":1,"onError":"continue"},
        "steps":[
          {"id":"launch_1","type":"launch_app","params":{"appName":"{{appName}}"}},
          {"id":"wait_1","type":"wait","params":{"ms":3000}},
          {"id":"screen_1","type":"screenshot","params":{"saveToArtifact":true}},
          {"id":"current_1","type":"get_current_app","params":{}}
        ]
      }'::jsonb
    ),
    jsonb_build_object(
      'key', 'approval_before_adb',
      'name', 'Approval Before ADB',
      'description', 'Requires approval before executing ADB command',
      'tags', '["approval","adb","sensitive"]'::jsonb,
      'definition', '{
        "version":1,
        "meta":{"key":"approval_before_adb","name":"Approval Before ADB","tags":["approval","adb","sensitive"]},
        "inputs":{"adbCommand":{"type":"string","required":true}},
        "target":{"mode":"single_device"},
        "execution":{"defaultTimeoutMs":20000,"maxRetries":0,"onError":"stop"},
        "steps":[
          {"id":"approval_1","type":"approval_checkpoint","params":{"reason":"ADB command requires manual approval"}},
          {"id":"adb_1","type":"adb","params":{"command":"{{adbCommand}}"},"policy":{"requiresApproval":true}},
          {"id":"wait_1","type":"wait","params":{"ms":1000}},
          {"id":"screen_1","type":"screenshot","params":{"saveToArtifact":true}}
        ]
      }'::jsonb
    ),
    jsonb_build_object(
      'key', 'run_autox_with_approval',
      'name', 'Run AutoX With Approval',
      'description', 'Execute AutoX.js script after approval',
      'tags', '["autox","approval","script"]'::jsonb,
      'definition', '{
        "version":1,
        "meta":{"key":"run_autox_with_approval","name":"Run AutoX With Approval","tags":["autox","approval","script"]},
        "inputs":{"filePath":{"type":"string","required":true}},
        "target":{"mode":"single_device"},
        "execution":{"defaultTimeoutMs":30000,"maxRetries":0,"onError":"stop"},
        "steps":[
          {"id":"approval_1","type":"approval_checkpoint","params":{"reason":"Execute AutoX.js requires manual review"}},
          {"id":"autox_1","type":"run_autox","params":{"filePath":"{{filePath}}"},"policy":{"requiresApproval":true}},
          {"id":"wait_1","type":"wait","params":{"ms":4000}},
          {"id":"screen_1","type":"screenshot","params":{"saveToArtifact":true}}
        ]
      }'::jsonb
    ),
    jsonb_build_object(
      'key', 'settings_smoke_test',
      'name', 'Settings Smoke Test',
      'description', 'Open Settings, verify correct package, capture screenshot',
      'tags', '["settings","smoke-test","qa"]'::jsonb,
      'definition', '{
        "version":1,
        "meta":{"key":"settings_smoke_test","name":"Settings Smoke Test","tags":["settings","smoke-test","qa"]},
        "inputs":{},
        "target":{"mode":"single_device"},
        "execution":{"defaultTimeoutMs":12000,"maxRetries":1,"onError":"stop"},
        "steps":[
          {"id":"launch_1","type":"launch_app","params":{"appName":"settings"}},
          {"id":"wait_1","type":"wait","params":{"ms":2500}},
          {"id":"current_1","type":"get_current_app","params":{}},
          {"id":"if_1","type":"conditional","params":{"left":"{{steps.current_1.output.appPackage}}","operator":"contains","right":"settings"},
           "then":[{"id":"screen_ok","type":"screenshot","params":{"saveToArtifact":true}}],
           "else":[{"id":"stop_fail","type":"stop","params":{"reason":"Settings app was not detected"}}]}
        ]
      }'::jsonb
    ),
    jsonb_build_object(
      'key', 'simple_form_fill_demo',
      'name', 'Simple Form Fill Demo',
      'description', 'Fill two input fields then capture screenshot',
      'tags', '["form","input","demo"]'::jsonb,
      'definition', '{
        "version":1,
        "meta":{"key":"simple_form_fill_demo","name":"Simple Form Fill Demo","tags":["form","input","demo"]},
        "inputs":{"appName":{"type":"string","required":true},"firstValue":{"type":"string","required":true},"secondValue":{"type":"string","required":true}},
        "target":{"mode":"single_device"},
        "execution":{"defaultTimeoutMs":15000,"maxRetries":1,"onError":"stop"},
        "steps":[
          {"id":"launch_1","type":"launch_app","params":{"appName":"{{appName}}"}},
          {"id":"wait_1","type":"wait","params":{"ms":3000}},
          {"id":"tap_1","type":"tap","params":{"x":0.5,"y":0.28}},
          {"id":"input_1","type":"input_text","params":{"text":"{{firstValue}}"}},
          {"id":"wait_2","type":"wait","params":{"ms":700}},
          {"id":"tap_2","type":"tap","params":{"x":0.5,"y":0.42}},
          {"id":"input_2","type":"input_text","params":{"text":"{{secondValue}}"}},
          {"id":"wait_3","type":"wait","params":{"ms":1000}},
          {"id":"screen_1","type":"screenshot","params":{"saveToArtifact":true}}
        ]
      }'::jsonb
    ),
    jsonb_build_object(
      'key', 'grouped_demo_sequence',
      'name', 'Grouped Demo Sequence',
      'description', 'Grouped steps: open app, navigate, capture screenshot',
      'tags', '["group","sequence","demo"]'::jsonb,
      'definition', '{
        "version":1,
        "meta":{"key":"grouped_demo_sequence","name":"Grouped Demo Sequence","tags":["group","sequence","demo"]},
        "inputs":{"appName":{"type":"string","required":true}},
        "target":{"mode":"single_device"},
        "execution":{"defaultTimeoutMs":20000,"maxRetries":1,"onError":"stop"},
        "steps":[
          {"id":"group_1","type":"group","params":{"name":"launch_and_navigate"},"steps":[
            {"id":"launch_1","type":"launch_app","params":{"appName":"{{appName}}"}},
            {"id":"wait_1","type":"wait","params":{"ms":2500}},
            {"id":"tap_1","type":"tap","params":{"x":0.85,"y":0.92}},
            {"id":"wait_2","type":"wait","params":{"ms":1200}},
            {"id":"swipe_1","type":"swipe","params":{"fromX":0.5,"fromY":0.75,"toX":0.5,"toY":0.35}}
          ]},
          {"id":"current_1","type":"get_current_app","params":{}},
          {"id":"screen_1","type":"screenshot","params":{"saveToArtifact":true}}
        ]
      }'::jsonb
    )
  ];

  FOREACH macro_data IN ARRAY all_macros
  LOOP
    INSERT INTO public.macros (key, name, description, created_by_user_id, created_at, updated_at)
    VALUES (
      macro_data->>'key',
      macro_data->>'name',
      macro_data->>'description',
      owner_id,
      now(),
      now()
    )
    ON CONFLICT (key) DO UPDATE
    SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      updated_at = now()
    RETURNING * INTO macro_record;

    IF macro_record.created_at >= now() - interval '1 second' THEN
      inserted_count := inserted_count + 1;
    ELSE
      updated_count := updated_count + 1;
    END IF;

    INSERT INTO public.macro_versions (
      macro_id, version_number, status,
      definition_json, input_schema_json, tags_json,
      created_by_user_id, created_at
    )
    VALUES (
      macro_record.id, 1, 'ACTIVE',
      macro_data->'definition',
      macro_data->'definition'->'inputs',
      macro_data->'tags',
      owner_id, now()
    )
    ON CONFLICT (macro_id, version_number) DO UPDATE
    SET
      status = 'ACTIVE',
      definition_json = EXCLUDED.definition_json,
      input_schema_json = EXCLUDED.input_schema_json,
      tags_json = EXCLUDED.tags_json
    RETURNING * INTO version_record;

    UPDATE public.macros
    SET latest_version_id = version_record.id
    WHERE id = macro_record.id;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'inserted', inserted_count,
    'updated', updated_count,
    'total', inserted_count + updated_count,
    'timestamp', now()
  );
END;
$$;
