/*
  # Fix seed_demo_macros() — correct conditional step template variable format

  ## Problem
  The seed_demo_macros() function contained conditional step params using
  {{steps.current_1.output.appPackage}} which is invalid for the WorkflowRunner
  resolver. The correct format is {{steps.current_1.appPackage}} (no .output layer).

  ## Changes
  - Replaces the seed_demo_macros() function body with corrected template strings
    for current_app_guard and settings_smoke_test macro definitions.
  - All other macro definitions are unchanged.
*/

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
  macro_data jsonb;
  existing_macro_id uuid;
  existing_version_id uuid;
  new_macro_id uuid;
  new_version_id uuid;
  macro_list jsonb[] := ARRAY[
    jsonb_build_object(
      'key', 'launch_app_and_capture',
      'name', 'Launch App And Capture',
      'description', 'Open an app, wait a few seconds, take a screenshot, get current app info',
      'tags', '["basic","screenshot","demo"]'::jsonb,
      'definition', '{
        "version":1,
        "meta":{"key":"launch_app_and_capture","name":"Launch App And Capture","tags":["basic","screenshot","demo"]},
        "inputs":{"appName":{"type":"string","required":true,"description":"App package name to launch"}},
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
      'description', 'Open app, tap input area, type text, screenshot',
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
      'description', 'Open app and swipe through feed to test UI scrolling',
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
      'description', 'Check current app matches expected, screenshot if match, stop if not',
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
          {"id":"if_1","type":"conditional","params":{"left":"{{steps.current_1.appPackage}}","operator":"equals","right":"{{expectedPackage}}"},
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
          {"id":"if_1","type":"conditional","params":{"left":"{{steps.current_1.appPackage}}","operator":"contains","right":"settings"},
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
      'description', 'Grouped steps: launch app, light interactions, screenshot',
      'tags', '["group","sequence","demo"]'::jsonb,
      'definition', '{
        "version":1,
        "meta":{"key":"grouped_demo_sequence","name":"Grouped Demo Sequence","tags":["group","sequence","demo"]},
        "inputs":{"appName":{"type":"string","required":true}},
        "target":{"mode":"single_device"},
        "execution":{"defaultTimeoutMs":20000,"maxRetries":1,"onError":"stop"},
        "steps":[
          {"id":"group_1","type":"group","params":{"name":"launch_and_navigate"},
           "steps":[
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
BEGIN
  SELECT id INTO owner_id FROM public.profiles LIMIT 1;
  IF owner_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No profiles found');
  END IF;

  FOREACH macro_data IN ARRAY macro_list LOOP
    SELECT id INTO existing_macro_id
      FROM public.macros WHERE key = macro_data->>'key';

    IF existing_macro_id IS NULL THEN
      INSERT INTO public.macros (key, name, description, created_by_user_id)
      VALUES (
        macro_data->>'key',
        macro_data->>'name',
        macro_data->>'description',
        owner_id
      )
      RETURNING id INTO new_macro_id;

      INSERT INTO public.macro_versions (
        macro_id, version_number, status,
        definition_json, input_schema_json, tags_json, created_by_user_id
      ) VALUES (
        new_macro_id, 1, 'ACTIVE',
        macro_data->'definition',
        COALESCE(macro_data->'definition'->'inputs', '{}'::jsonb),
        COALESCE(macro_data->'tags', '[]'::jsonb),
        owner_id
      )
      RETURNING id INTO new_version_id;

      UPDATE public.macros SET latest_version_id = new_version_id WHERE id = new_macro_id;
      inserted_count := inserted_count + 1;
    ELSE
      SELECT id INTO existing_version_id
        FROM public.macro_versions
        WHERE macro_id = existing_macro_id AND version_number = 1;

      IF existing_version_id IS NOT NULL THEN
        UPDATE public.macro_versions SET
          definition_json = macro_data->'definition',
          input_schema_json = COALESCE(macro_data->'definition'->'inputs', '{}'::jsonb),
          tags_json = COALESCE(macro_data->'tags', '[]'::jsonb),
          status = 'ACTIVE'
        WHERE id = existing_version_id;

        UPDATE public.macros SET
          name = macro_data->>'name',
          description = macro_data->>'description',
          latest_version_id = existing_version_id
        WHERE id = existing_macro_id;

        updated_count := updated_count + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'inserted', inserted_count,
    'updated', updated_count,
    'total', inserted_count + updated_count
  );
END;
$$;
