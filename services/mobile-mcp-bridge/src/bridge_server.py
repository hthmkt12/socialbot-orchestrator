import json
import os
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlparse

from android_session_manager import DeviceSessionManager
from json_response import make_response, to_json_bytes


MANAGER = DeviceSessionManager()
SERIAL_RE = re.compile(r"^/devices/([^/]+)/(health|execute-step|tools/call)$")


class BridgeHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self._send(204, {})

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/health":
            self._send_json(200, {
                "service": "mobile-mcp-bridge",
                "status": "ok",
                "sessionCount": MANAGER.session_count(),
            })
            return
        if path == "/devices":
            self._handle_result(lambda: make_response(True, {"devices": MANAGER.list_devices()}))
            return

        match = SERIAL_RE.match(path)
        if match and match.group(2) == "health":
            serial = unquote(match.group(1))
            # Detect platform from serial format: iOS Portal URLs start with http
            platform = "ios" if serial.startswith("http://") or serial.startswith("https://") else "android"
            self._handle_result(lambda: make_response(True, MANAGER.with_session(serial, lambda s: s.health(), platform=platform)))
            return

        self._send_json(404, {"success": False, "error": "Not found"})

    def do_POST(self):
        match = SERIAL_RE.match(urlparse(self.path).path)
        if not match:
            self._send_json(404, {"success": False, "error": "Not found"})
            return

        serial, action = unquote(match.group(1)), match.group(2)
        payload = self._read_json()
        if payload is None:
            self._send_json(400, {"success": False, "error": "Invalid JSON"})
            return

        if action == "execute-step":
            self._handle_result(lambda: _execute_step(serial, payload))
            return
        if action == "tools/call":
            self._handle_result(lambda: _call_tool(serial, payload))
            return

        self._send_json(404, {"success": False, "error": "Not found"})

    def log_message(self, fmt, *args):
        print(f"[mobile-mcp-bridge] {self.address_string()} {fmt % args}")

    def _read_json(self):
        try:
            length = int(self.headers.get("content-length", "0"))
            return json.loads(self.rfile.read(length).decode("utf-8") or "{}")
        except Exception:
            return None

    def _handle_result(self, factory):
        try:
            status, body = factory()
            self._send_json(status, body)
        except Exception as exc:
            self._send_json(500, {"success": False, "error": str(exc)})

    def _send_json(self, status, value):
        self._send(status, {"content-type": "application/json"}, to_json_bytes(value))

    def _send(self, status, headers, body=b""):
        self.send_response(status)
        self.send_header("access-control-allow-origin", "*")
        self.send_header("access-control-allow-methods", "GET,POST,OPTIONS")
        self.send_header("access-control-allow-headers", "content-type")
        for key, value in headers.items():
            self.send_header(key, value)
        self.end_headers()
        if body:
            self.wfile.write(body)


def _execute_step(serial, payload):
    step_type = str(payload.get("stepType", ""))
    params = payload.get("params") if isinstance(payload.get("params"), dict) else {}
    device = payload.get("device") if isinstance(payload.get("device"), dict) else {}
    platform = str(device.get("platform", "android"))

    def run(session):
        result = session.execute_step(step_type, params, device)
        normalized = result if isinstance(result, dict) else {"result": result}
        success = bool(normalized.get("success", True))
        return make_response(success, normalized, None if success else normalized.get("message"), 200)

    return MANAGER.with_session(serial, run, platform=platform)


def _call_tool(serial, payload):
    tool_name = str(payload.get("tool", ""))
    args = payload.get("args") if isinstance(payload.get("args"), dict) else {}
    platform = str(payload.get("platform", "android"))

    def run(session):
        result = session.call_tool(tool_name, args)
        normalized = result if isinstance(result, dict) else {"result": result}
        success = bool(normalized.get("success", True))
        return make_response(success, normalized, None if success else normalized.get("message"), 200)

    return MANAGER.with_session(serial, run, platform=platform)


def main():
    port = int(os.environ.get("MOBILE_MCP_BRIDGE_PORT", "4321"))
    server = ThreadingHTTPServer(("127.0.0.1", port), BridgeHandler)
    print(f"[mobile-mcp-bridge] listening on 127.0.0.1:{port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
