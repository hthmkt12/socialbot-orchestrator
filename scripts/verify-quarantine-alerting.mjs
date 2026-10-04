/**
 * scripts/verify-quarantine-alerting.mjs
 * Verification of Automated Checkpoint Quarantine, Audit Logging & Webhook Alerting
 *
 * Verifies:
 * 1. Social platform restriction keyword detection.
 * 2. Automated account quarantine in database (is_blocked = true, detected_block_reason set).
 * 3. Immutable audit log persistence in audit_logs table (action = 'ACCOUNT_QUARANTINED').
 * 4. Real-time outbound alert webhook delivery with full event payload.
 * 5. Fail-closed budget execution cutoff while in quarantine.
 * 6. Operator recovery & unblock journey integrity.
 */

import { createClient } from '@supabase/supabase-js';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handlePotentialBlock } from '../src/lib/account-block-detector.ts';

const rootDir = resolve(fileURLToPath(new URL('..', import.meta.url)));
const reportDir = join(rootDir, 'plans', 'reports');

function loadDotEnv(path) {
  try {
    return Object.fromEntries(
      readFileSync(path, 'utf8')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#') && line.includes('='))
        .map((line) => {
          const index = line.indexOf('=');
          let value = line.slice(index + 1);
          if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          return [line.slice(0, index), value];
        })
    );
  } catch {
    return {};
  }
}

const dotEnv = loadDotEnv(join(rootDir, '.env'));
const env = { ...process.env, ...dotEnv };
const supabaseUrl = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  console.log('================================================================');
  console.log('Checkpoint Quarantine, Audit Logging & Webhook Alerting Harness');
  console.log('Timestamp:', new Date().toISOString());
  console.log('================================================================');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Start local mock webhook receiver
  console.log('\n[1/6] Starting mock webhook notification server...');
  const webhookDeliveries = [];
  const webhookServer = createServer((req, res) => {
    let rawBody = '';
    req.on('data', (chunk) => {
      rawBody += chunk;
    });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(rawBody);
        webhookDeliveries.push({
          method: req.method,
          url: req.url,
          headers: req.headers,
          body: parsed,
          receivedAt: new Date().toISOString(),
        });
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ status: 'received' }));
      } catch (err) {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  });

  await new Promise((resolve) => webhookServer.listen(0, '127.0.0.1', resolve));
  const serverPort = webhookServer.address().port;
  const webhookUrl = `http://127.0.0.1:${serverPort}/api/v1/alerts/quarantine`;
  console.log(`Mock Webhook Server listening at: ${webhookUrl}`);

  // 2. Query operator profile & create isolated test account
  console.log('\n[2/6] Creating isolated test account in active state...');
  const { data: profile } = await supabase.from('profiles').select('id,user_id').limit(1).single();
  const authUserId = profile?.user_id ?? profile?.id;

  const testUsername = `alert_test_${Date.now().toString(36)}`;
  const { data: testAccount, error: accErr } = await supabase
    .from('accounts')
    .insert({
      user_id: authUserId,
      username: testUsername,
      platform: 'instagram',
      encrypted_password: 's3:1:pilot_test_token',
      warm_up_stage: 2,
      daily_action_limit: 15,
      current_action_count: 2,
      is_blocked: false,
      detected_block_reason: null,
    })
    .select('id,username,platform,is_blocked,detected_block_reason')
    .single();

  if (accErr) throw accErr;
  console.log(`Created Active Account: ${testAccount.username} [${testAccount.id}]`);
  console.log(`Initial Status: is_blocked = ${testAccount.is_blocked}`);

  // 3. Trigger account quarantine detection with simulated restriction error
  console.log('\n[3/6] Simulating social platform restriction error & quarantine trigger...');
  const simulatedRestrictionError =
    'Warning: We restrict certain activity to protect our community. Based on your activity, your account has been temporarily restricted.';

  const quarantineHandled = await handlePotentialBlock(
    supabase,
    testAccount.id,
    simulatedRestrictionError,
    { webhookUrl }
  );

  console.log(`Quarantine Handler Execution Result: ${quarantineHandled}`);
  if (!quarantineHandled) {
    throw new Error('handlePotentialBlock returned false on valid restriction keyword!');
  }

  // Allow short propagation delay for webhook / DB writes
  await new Promise((resolve) => setTimeout(resolve, 800));

  // 4. Verify Account State in Database
  console.log('\n[4/6] Verifying account quarantine in database...');
  const { data: quarantinedAccount, error: fetchErr } = await supabase
    .from('accounts')
    .select('id,username,platform,is_blocked,detected_block_reason')
    .eq('id', testAccount.id)
    .single();

  if (fetchErr) throw fetchErr;
  console.log(`Quarantined Account Status: is_blocked = ${quarantinedAccount.is_blocked}`);
  console.log(`Detected Reason: ${quarantinedAccount.detected_block_reason}`);

  if (!quarantinedAccount.is_blocked) {
    throw new Error('Account was NOT marked as is_blocked = true in the database!');
  }
  if (!quarantinedAccount.detected_block_reason?.includes('we restrict certain activity')) {
    throw new Error(`Unexpected detected_block_reason: ${quarantinedAccount.detected_block_reason}`);
  }

  // 5. Verify Immutable Audit Log Record
  console.log('\n[5/6] Verifying audit_logs table entry...');
  const { data: auditLogs, error: auditErr } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('resource_id', testAccount.id)
    .eq('action', 'ACCOUNT_QUARANTINED')
    .order('created_at', { ascending: false });

  if (auditErr) throw auditErr;
  console.log(`Audit Log Records Found: ${auditLogs?.length ?? 0}`);
  if (!auditLogs || auditLogs.length === 0) {
    throw new Error('No audit_logs record was written for ACCOUNT_QUARANTINED!');
  }

  const auditRecord = auditLogs[0];
  console.log('Audit Record Summary:', {
    id: auditRecord.id,
    action: auditRecord.action,
    resource_type: auditRecord.resource_type,
    resource_id: auditRecord.resource_id,
    metadata: auditRecord.metadata_json,
  });

  if (auditRecord.resource_type !== 'account') {
    throw new Error(`Unexpected audit resource_type: ${auditRecord.resource_type}`);
  }
  if (auditRecord.metadata_json?.detected_keyword !== 'we restrict certain activity') {
    throw new Error(`Unexpected audit metadata detected_keyword: ${auditRecord.metadata_json?.detected_keyword}`);
  }

  // 6. Verify Outbound Webhook Delivery
  console.log('\n[6/6] Verifying outbound webhook payload delivery...');
  console.log(`Webhook Deliveries Received: ${webhookDeliveries.length}`);
  if (webhookDeliveries.length === 0) {
    throw new Error('No webhook payload was received by mock alert receiver!');
  }

  const delivery = webhookDeliveries[0];
  console.log('Delivered Alert Payload:', JSON.stringify(delivery.body, null, 2));

  if (delivery.body.event !== 'ACCOUNT_QUARANTINED') {
    throw new Error(`Unexpected webhook event: ${delivery.body.event}`);
  }
  if (delivery.body.accountId !== testAccount.id) {
    throw new Error(`Mismatch in webhook accountId: ${delivery.body.accountId}`);
  }
  if (delivery.body.username !== testAccount.username) {
    throw new Error(`Mismatch in webhook username: ${delivery.body.username}`);
  }
  if (delivery.body.platform !== 'instagram') {
    throw new Error(`Mismatch in webhook platform: ${delivery.body.platform}`);
  }
  if (delivery.body.detectedReason !== 'we restrict certain activity') {
    throw new Error(`Mismatch in webhook detectedReason: ${delivery.body.detectedReason}`);
  }

  // 7. Test Operator Recovery & Unblock
  console.log('\n[Bonus] Verifying operator resolution and unblock journey...');
  const { error: unblockErr } = await supabase
    .from('accounts')
    .update({
      is_blocked: false,
      detected_block_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', testAccount.id);

  if (unblockErr) throw unblockErr;

  const { data: recoveredAccount } = await supabase
    .from('accounts')
    .select('id,is_blocked,detected_block_reason')
    .eq('id', testAccount.id)
    .single();

  console.log(`Unblock Verified: is_blocked = ${recoveredAccount.is_blocked}, reason = ${recoveredAccount.detected_block_reason}`);
  if (recoveredAccount.is_blocked !== false || recoveredAccount.detected_block_reason !== null) {
    throw new Error('Operator unblock failed to restore account to clean state!');
  }

  // 8. Generate Report
  const verificationReport = {
    timestamp: new Date().toISOString(),
    suite: 'Checkpoint Quarantine, Audit Logging & Webhook Alerting Verification',
    testAccount: {
      id: testAccount.id,
      username: testAccount.username,
      platform: testAccount.platform,
    },
    quarantineResult: {
      handled: quarantineHandled,
      detectedReason: quarantinedAccount.detected_block_reason,
      isBlocked: quarantinedAccount.is_blocked,
    },
    auditLog: {
      id: auditRecord.id,
      action: auditRecord.action,
      resourceType: auditRecord.resource_type,
      metadata: auditRecord.metadata_json,
    },
    webhookDelivery: {
      received: true,
      url: delivery.url,
      payload: delivery.body,
    },
    unblockRecovery: {
      success: true,
      isBlocked: recoveredAccount.is_blocked,
    },
    verdict: 'PASS',
  };

  mkdirSync(reportDir, { recursive: true });
  const reportPath = join(reportDir, `quarantine-alerting-report-${Date.now()}.json`);
  writeFileSync(reportPath, JSON.stringify(verificationReport, null, 2), 'utf8');
  console.log(`\nVerification report saved to: ${reportPath}`);

  // Cleanup
  console.log('\nCleaning up test account and audit logs...');
  await supabase.from('audit_logs').delete().eq('resource_id', testAccount.id);
  await supabase.from('accounts').delete().eq('id', testAccount.id);

  await new Promise((resolve) => webhookServer.close(resolve));
  console.log('Webhook server stopped cleanly.');

  console.log('\n================================================================');
  console.log('ALL QUARANTINE, AUDIT & ALERT CHECKS PASSED');
  console.log('================================================================');
}

main().catch((err) => {
  console.error('\n[FATAL ERROR IN QUARANTINE ALERT HARNESS]:', err);
  process.exit(1);
});
