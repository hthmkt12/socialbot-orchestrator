/*
  # Seed Macros Function

  1. New Function
    - `seed_demo_macros(p_profile_id uuid)` - Creates demo macros for a user
      - Creates 3 macros: launch_app_and_capture, input_text_demo, current_app_check
      - Creates version 1 for each macro with ACTIVE status
      - Sets latest_version_id on each macro
      - Idempotent: skips macros that already exist (by key)

  2. Notes
    - Called from the frontend "Seed Sample Macros" button
    - The function runs as SECURITY DEFINER to bypass RLS for seeding
    - Only creates data if the macros don't already exist
*/

CREATE OR REPLACE FUNCTION seed_demo_macros(p_profile_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_macro_id uuid;
  v_version_id uuid;
  v_count integer := 0;
BEGIN
  -- 1. launch_app_and_capture
  IF NOT EXISTS (SELECT 1 FROM public.macros WHERE key = 'launch_app_and_capture') THEN
    INSERT INTO public.macros (key, name, description, created_by_user_id)
    VALUES ('launch_app_and_capture', 'Launch App And Capture', 'Launch an app, wait, then capture a screenshot', p_profile_id)
    RETURNING id INTO v_macro_id;

    INSERT INTO public.macro_versions (macro_id, version_number, status, definition_json, input_schema_json, tags_json, created_by_user_id)
    VALUES (
      v_macro_id,
      1,
      'ACTIVE',
      '{
        "version": 1,
        "meta": {"key": "launch_app_and_capture", "name": "Launch App And Capture", "description": "Launch an app, wait, then capture a screenshot", "tags": ["demo", "capture"]},
        "inputs": {"appName": {"type": "string", "required": true, "description": "App package name to launch"}},
        "target": {"mode": "single_device"},
        "execution": {"defaultTimeoutMs": 10000, "maxRetries": 1, "onError": "stop"},
        "steps": [
          {"id": "launch", "type": "launch_app", "params": {"appName": "{{appName}}"}},
          {"id": "wait1", "type": "wait", "params": {"ms": 3000}},
          {"id": "screen1", "type": "screenshot", "params": {"saveToArtifact": true}},
          {"id": "current1", "type": "get_current_app", "params": {}}
        ]
      }'::jsonb,
      '{"appName": {"type": "string", "required": true, "description": "App package name to launch"}}'::jsonb,
      '["demo", "capture"]'::jsonb,
      p_profile_id
    )
    RETURNING id INTO v_version_id;

    UPDATE public.macros SET latest_version_id = v_version_id WHERE id = v_macro_id;
    v_count := v_count + 1;
  END IF;

  -- 2. input_text_demo
  IF NOT EXISTS (SELECT 1 FROM public.macros WHERE key = 'input_text_demo') THEN
    INSERT INTO public.macros (key, name, description, created_by_user_id)
    VALUES ('input_text_demo', 'Input Text Demo', 'Tap a field and type text', p_profile_id)
    RETURNING id INTO v_macro_id;

    INSERT INTO public.macro_versions (macro_id, version_number, status, definition_json, input_schema_json, tags_json, created_by_user_id)
    VALUES (
      v_macro_id,
      1,
      'ACTIVE',
      '{
        "version": 1,
        "meta": {"key": "input_text_demo", "name": "Input Text Demo", "description": "Tap a field and type text", "tags": ["demo"]},
        "inputs": {"text": {"type": "string", "required": true, "description": "Text to input"}},
        "target": {"mode": "single_device"},
        "execution": {"defaultTimeoutMs": 10000, "maxRetries": 0, "onError": "stop"},
        "steps": [
          {"id": "tap_field", "type": "tap", "params": {"x": 0.5, "y": 0.3}},
          {"id": "wait1", "type": "wait", "params": {"ms": 500}},
          {"id": "type_text", "type": "input_text", "params": {"text": "{{text}}"}},
          {"id": "screen1", "type": "screenshot", "params": {"saveToArtifact": true}}
        ]
      }'::jsonb,
      '{"text": {"type": "string", "required": true, "description": "Text to input"}}'::jsonb,
      '["demo"]'::jsonb,
      p_profile_id
    )
    RETURNING id INTO v_version_id;

    UPDATE public.macros SET latest_version_id = v_version_id WHERE id = v_macro_id;
    v_count := v_count + 1;
  END IF;

  -- 3. current_app_check
  IF NOT EXISTS (SELECT 1 FROM public.macros WHERE key = 'current_app_check') THEN
    INSERT INTO public.macros (key, name, description, created_by_user_id)
    VALUES ('current_app_check', 'Current App Check', 'Check current app and take conditional screenshot', p_profile_id)
    RETURNING id INTO v_macro_id;

    INSERT INTO public.macro_versions (macro_id, version_number, status, definition_json, input_schema_json, tags_json, created_by_user_id)
    VALUES (
      v_macro_id,
      1,
      'ACTIVE',
      '{
        "version": 1,
        "meta": {"key": "current_app_check", "name": "Current App Check", "description": "Check current app and take conditional screenshot", "tags": ["demo"]},
        "inputs": {"expectedPackage": {"type": "string", "required": true, "description": "Expected package name"}},
        "target": {"mode": "single_device"},
        "execution": {"defaultTimeoutMs": 15000, "maxRetries": 1, "onError": "stop"},
        "steps": [
          {"id": "get_app", "type": "get_current_app", "params": {}},
          {
            "id": "check_app", "type": "conditional",
            "params": {"left": "{{steps.get_app.output.appPackage}}", "operator": "equals", "right": "{{expectedPackage}}"},
            "then": [{"id": "capture_match", "type": "screenshot", "params": {"saveToArtifact": true}}],
            "else": [{"id": "stop_mismatch", "type": "stop", "params": {"reason": "Unexpected app running"}}]
          }
        ]
      }'::jsonb,
      '{"expectedPackage": {"type": "string", "required": true, "description": "Expected package name"}}'::jsonb,
      '["demo"]'::jsonb,
      p_profile_id
    )
    RETURNING id INTO v_version_id;

    UPDATE public.macros SET latest_version_id = v_version_id WHERE id = v_macro_id;
    v_count := v_count + 1;
  END IF;

  RETURN v_count;
END;
$$;
