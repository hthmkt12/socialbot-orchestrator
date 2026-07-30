/**
 * Makes a small database read so a Supabase Free project continues to receive
 * database activity. Credentials must be supplied as environment variables;
 * never add them to this repository.
 */
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  process.exit(1);
}

let endpoint;
try {
  endpoint = new URL('/rest/v1/profiles?select=id&limit=1', supabaseUrl);
} catch {
  console.error('SUPABASE_URL must be a valid URL.');
  process.exit(1);
}

const response = await fetch(endpoint, {
  headers: {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
  },
  signal: AbortSignal.timeout(15_000),
});

if (!response.ok) {
  const body = (await response.text()).slice(0, 500);
  console.error(`Supabase keep-alive failed (${response.status}): ${body}`);
  process.exit(1);
}

console.log(`Supabase keep-alive succeeded at ${new Date().toISOString()}.`);
