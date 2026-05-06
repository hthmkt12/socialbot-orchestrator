import { useMemo, useState } from 'react';
import {
  buildAutoJsInitScript,
  normalizeBaseUrl,
  toGatewayWsUrl,
} from '../../lib/device-setup';

const DEFAULT_GATEWAY_BASE_URL = import.meta.env.VITE_GATEWAY_BASE_URL ?? 'http://127.0.0.1:8080';
const DEFAULT_WORKER_BASE_URL = import.meta.env.VITE_WORKER_BASE_URL ?? 'http://127.0.0.1:4310';
const DEFAULT_MOBILE_MCP_BRIDGE_URL = import.meta.env.VITE_MOBILE_MCP_BRIDGE_URL ?? 'http://127.0.0.1:4321';

export function useDeviceSetupRuntimeConfig() {
  const [gatewayBaseUrl, setGatewayBaseUrl] = useState(DEFAULT_GATEWAY_BASE_URL);
  const [workerBaseUrl, setWorkerBaseUrl] = useState(DEFAULT_WORKER_BASE_URL);
  const [mobileMcpBridgeUrl, setMobileMcpBridgeUrl] = useState(DEFAULT_MOBILE_MCP_BRIDGE_URL);

  const normalizedGatewayBaseUrl = useMemo(
    () => normalizeBaseUrl(gatewayBaseUrl, DEFAULT_GATEWAY_BASE_URL),
    [gatewayBaseUrl]
  );
  const normalizedWorkerBaseUrl = useMemo(
    () => normalizeBaseUrl(workerBaseUrl, DEFAULT_WORKER_BASE_URL),
    [workerBaseUrl]
  );
  const normalizedMobileMcpBridgeUrl = useMemo(
    () => normalizeBaseUrl(mobileMcpBridgeUrl, DEFAULT_MOBILE_MCP_BRIDGE_URL),
    [mobileMcpBridgeUrl]
  );
  const gatewayWsUrl = useMemo(
    () => toGatewayWsUrl(normalizedGatewayBaseUrl),
    [normalizedGatewayBaseUrl]
  );
  const autoJsScript = useMemo(
    () => buildAutoJsInitScript(gatewayWsUrl),
    [gatewayWsUrl]
  );

  return {
    autoJsScript,
    gatewayBaseUrl,
    gatewayWsUrl,
    mobileMcpBridgeUrl,
    normalizedGatewayBaseUrl,
    normalizedMobileMcpBridgeUrl,
    normalizedWorkerBaseUrl,
    setGatewayBaseUrl,
    setMobileMcpBridgeUrl,
    setWorkerBaseUrl,
    workerBaseUrl,
  };
}
