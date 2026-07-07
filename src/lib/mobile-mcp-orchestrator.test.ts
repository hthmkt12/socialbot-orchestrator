import { describe, expect, it, vi } from 'vitest';
import { executeMobileMcpStep, normalizeMobileMcpBridgeUrl } from './mobile-mcp-orchestrator';

describe('mobile mcp orchestrator', () => {
  it('normalizes bridge URLs', () => {
    expect(normalizeMobileMcpBridgeUrl(' http://127.0.0.1:4321/ ')).toBe('http://127.0.0.1:4321');
    expect(normalizeMobileMcpBridgeUrl('')).toBe('http://127.0.0.1:4321');
  });

  it('OP-NO-008 blocks run_autox before calling the Mobile MCP V1 bridge', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await expect(
      executeMobileMcpStep('http://127.0.0.1:4321', 'serial-1', 'run_autox', { scriptName: 'danger.js' })
    ).rejects.toThrow('run_autox is not supported by Mobile MCP V1');

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
