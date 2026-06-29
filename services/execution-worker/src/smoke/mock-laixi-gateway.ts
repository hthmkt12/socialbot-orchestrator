import { createServer } from 'node:http';
import type { GatewayDispatchRequest, GatewayDispatchResponse } from '../../../../packages/shared/src';

const PORT = 8080;

const server = createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/dispatch-step') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body) as GatewayDispatchRequest;
        console.log(`[Mock Gateway] Received dispatch for device ${payload.deviceId}, action: ${payload.command.action}`);
        
        const response: GatewayDispatchResponse = {
          success: true,
          outcome: 'completed',
          requestId: `mock-req-${Date.now()}`,
          result: {
            success: true,
            deviceId: payload.deviceId,
            data: { message: 'Mock response data', simulated: true }
          }
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`[Mock Gateway] Listening on http://127.0.0.1:${PORT}`);
});
