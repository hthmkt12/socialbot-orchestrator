/*
  # Fix conditional step template variable format in seeded macro definitions

  ## Problem
  Seeded macro definitions used {{steps.step_id.output.fieldName}} template format,
  but the WorkflowRunner's resolver (resolver.ts) reads step outputs directly from
  the stepOutputs Map, where values are the raw output objects (not wrapped in {output: ...}).
  The correct format is {{steps.step_id.fieldName}}.

  ## Changes
  - Updates definition_json in macro_versions to replace the wrong template format
    with the correct one for all affected conditional step params.
*/

UPDATE macro_versions
SET definition_json = REPLACE(
  definition_json::text,
  '{{steps.current_1.output.appPackage}}',
  '{{steps.current_1.appPackage}}'
)::jsonb
WHERE definition_json::text LIKE '%steps.current_1.output.appPackage%';

UPDATE macro_versions
SET definition_json = REPLACE(
  definition_json::text,
  '{{steps.get_app.output.appPackage}}',
  '{{steps.get_app.appPackage}}'
)::jsonb
WHERE definition_json::text LIKE '%steps.get_app.output.appPackage%';
