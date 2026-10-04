import WebSocket from 'ws';

if (typeof globalThis.WebSocket === 'undefined') {
  // @ts-expect-error Node < 22 WebSocket polyfill for Supabase Realtime
  globalThis.WebSocket = WebSocket;
}

export { WebSocket };
