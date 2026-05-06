import assert from 'node:assert/strict';
import { exportSocialMacroToAutoJs } from '../../../../src/contracts/autojs-social-exporter';
import {
  SOCIAL_DRAFT_POST_SAMPLE,
  compileSocialMacroToMacroDefinition,
  validateSocialMacroDefinition,
} from '../../../../src/contracts/social-macro-dsl';
import { validateMacroDefinition } from '../../../../src/contracts/macro';

const socialValidation = validateSocialMacroDefinition(SOCIAL_DRAFT_POST_SAMPLE);
assert.deepEqual(socialValidation.errors, []);

const macro = compileSocialMacroToMacroDefinition(SOCIAL_DRAFT_POST_SAMPLE);
const macroValidation = validateMacroDefinition(macro);
assert.deepEqual(macroValidation.errors, []);
assert(macro.steps.some((step) => step.type === 'approval_checkpoint'));
assert(macro.steps.some((step) => step.id === 'publish_post' && step.policy?.requiresApproval));

const autoJs = exportSocialMacroToAutoJs(SOCIAL_DRAFT_POST_SAMPLE);
assert(autoJs.includes('config.allowPublish'));
assert(autoJs.includes('Publish blocked by default'));
assert(autoJs.includes('launchPackage(valueOf(config.appPackage))'));

console.log('[social-macro-exporter-smoke] PASS Social DSL compiles to macro and AutoJS');
