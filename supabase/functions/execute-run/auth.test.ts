import { beforeEach, describe, expect, it, vi } from 'vitest';

const env: Record<string, string | undefined> = {};
let handler: (req: Request) => Promise<Response>;
const mockAuthGetUser = vi.fn();
const mockFrom = vi.fn();

(globalThis as Record<string, unknown>).Deno = {
  serve: vi.fn((fn: (req: Request) => Promise<Response>) => { handler = fn; }),
  env: { get: vi.fn((key: string) => env[key]) },
};

vi.mock('npm:@supabase/supabase-js@2.57.4', () => ({
  createClient: vi.fn(() => ({ auth: { getUser: mockAuthGetUser }, from: mockFrom })),
}));

let loaded = false;
async function loadHandler() {
  if (!loaded) {
    await import('./index.ts');
    loaded = true;
  }
}

function profileQuery(role: string, id = 'profile-1') {
  return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: { id, role }, error: null }) }) }) };
}

function runQuery(data: unknown) {
  return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data, error: null }) }) }) };
}

function updateQuery() {
  return { update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) };
}

function request(headers: Record<string, string> = {}) {
  return new Request('https://example.test/functions/v1/execute-run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ runId: 'run-1', action: 'start' }),
  });
}

describe('execute-run authorization', () => {
  beforeEach(async () => {
    Object.assign(env, { SUPABASE_URL: 'https://test.supabase.co', SUPABASE_ANON_KEY: 'anon-test-key', SUPABASE_SERVICE_ROLE_KEY: 'service-test-key', EXECUTE_RUN_ALLOWED_ORIGIN: 'https://app.example.com' });
    mockAuthGetUser.mockReset();
    mockFrom.mockReset();
    await loadHandler();
  });

  it('rejects missing bearer with 401', async () => {
    expect((await handler(request())).status).toBe(401);
  });

  it('rejects viewer before any run lookup', async () => {
    mockAuthGetUser.mockResolvedValue({ data: { user: { id: 'viewer-1' } }, error: null });
    mockFrom.mockReturnValueOnce(profileQuery('VIEWER'));
    expect((await handler(request({ Authorization: 'Bearer user-token' }))).status).toBe(403);
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it('returns 404 for authenticated admin with unknown run', async () => {
    mockAuthGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null });
    mockFrom.mockReturnValueOnce(profileQuery('ADMIN')).mockReturnValueOnce(runQuery(null));
    expect((await handler(request({ Authorization: 'Bearer admin-token' }))).status).toBe(404);
  });

  it('rejects a non-owning operator before mutation', async () => {
    mockAuthGetUser.mockResolvedValue({ data: { user: { id: 'auth-user-1' } }, error: null });
    mockFrom.mockReturnValueOnce(profileQuery('OPERATOR', 'profile-1')).mockReturnValueOnce(runQuery({ id: 'run-1', status: 'RUNNING', summary_json: {}, triggered_by_user_id: 'profile-2' }));
    expect((await handler(request({ Authorization: 'Bearer operator-token' }))).status).toBe(403);
    expect(mockFrom).toHaveBeenCalledTimes(2);
  });

  it('returns 400 for malformed JSON after authentication', async () => {
    mockAuthGetUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null });
    mockFrom.mockReturnValueOnce(profileQuery('ADMIN'));
    const malformed = new Request('https://example.test/functions/v1/execute-run', { method: 'POST', headers: { Authorization: 'Bearer admin-token', 'Content-Type': 'application/json' }, body: '{' });
    expect((await handler(malformed)).status).toBe(400);
  });

  it('allows an owning operator when profile id differs from auth user id', async () => {
    mockAuthGetUser.mockResolvedValue({ data: { user: { id: 'auth-user-1' } }, error: null });
    const completedRun = { id: 'run-1', status: 'COMPLETED', summary_json: {}, triggered_by_user_id: 'profile-1' };
    mockFrom
      .mockReturnValueOnce(profileQuery('OPERATOR', 'profile-1'))
      .mockReturnValueOnce(runQuery(completedRun))
      .mockReturnValueOnce(runQuery(completedRun))
      .mockReturnValueOnce(updateQuery());
    const response = await handler(request({ Authorization: 'Bearer operator-token' }));
    expect(response.status).toBe(200);
  });

  it('omits CORS allow-origin for an untrusted origin', async () => {
    expect((await handler(request({ Origin: 'https://evil.example.com' }))).headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});
