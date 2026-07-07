import json
import os
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlparse

from android_session_manager import DeviceSessionManager
from json_response import make_response, to_json_bytes


MANAGER = DeviceSessionManager()
SERIAL_RE = re.compile(r"^/devices/([^/]+)/(health|execute-step|tools/call)$")
BRIDGE_TOKEN = os.environ.get("MOBILE_MCP_BRIDGE_TOKEN", "")
ALLOW_INSECURE_DEV = os.environ.get("MOBILE_MCP_ALLOW_INSECURE_DEV", "").lower() in ("1", "true", "yes")
ALLOWED_ORIGIN = os.environ.get("BRIDGE_CORS_ORIGIN", "http://localhost:5173")


def bridge_auth_status(token=BRIDGE_TOKEN, allow_insecure_dev=ALLOW_INSECURE_DEV):
    protected_available = bool(token) or bool(allow_insecure_dev)
    return {
        "authRequired": bool(token),
        "insecureDevMode": bool(allow_insecure_dev and not token),
        "authConfigured": protected_available,
        "protectedEndpointsAvailable": protected_available,
    }


class BridgeHandler(BaseHTTPRequestHandler):
    def _check_auth(self):
        """Validate X-Bridge-Token header. Returns True if OK, sends 401 and returns False otherwise."""
        if not BRIDGE_TOKEN:
            if ALLOW_INSECURE_DEV:
                return True
            self._send_json(503, {
                "success": False,
                "code": "BRIDGE_AUTH_NOT_CONFIGURED",
                "error": "Mobile MCP bridge token is not configured. Set MOBILE_MCP_BRIDGE_TOKEN or explicitly set MOBILE_MCP_ALLOW_INSECURE_DEV=true for local-only development.",
            })
            return False
        token = self.headers.get("x-bridge-token", "")
        if token != BRIDGE_TOKEN:
            self._send_json(401, {"success": False, "code": "BRIDGE_UNAUTHORIZED", "error": "Unauthorized: invalid or missing X-Bridge-Token"})
            return False
        return True

    def do_OPTIONS(self):
        self._send(204, {})

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/health":
            self._send_json(200, {
                "service": "mobile-mcp-bridge",
                "status": "ok",
                **bridge_auth_status(),
                "sessionCount": MANAGER.session_count(),
            })
            return
        if not self._check_auth():
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
        if not self._check_auth():
            return
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
        self.send_header("access-control-allow-origin", ALLOWED_ORIGIN)
        self.send_header("access-control-allow-methods", "GET,POST,OPTIONS")
        self.send_header("access-control-allow-headers", "content-type, x-bridge-token")
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

    try:
        return MANAGER.with_session(serial, run, platform=platform)
    except Exception as exc:
        return 404, {"success": False, "code": "DEVICE_SESSION_UNAVAILABLE", "error": str(exc)}


def _call_tool(serial, payload):
    tool_name = str(payload.get("tool", ""))
    args = payload.get("args") if isinstance(payload.get("args"), dict) else {}
    platform = str(payload.get("platform", "android"))

    def run(session):
        result = session.call_tool(tool_name, args)
        normalized = result if isinstance(result, dict) else {"result": result}
        success = bool(normalized.get("success", True))
        return make_response(success, normalized, None if success else normalized.get("message"), 200)

    try:
        return MANAGER.with_session(serial, run, platform=platform)
    except Exception as exc:
        return 404, {"success": False, "code": "DEVICE_SESSION_UNAVAILABLE", "error": str(exc)}


def main():
    port = int(os.environ.get("MOBILE_MCP_BRIDGE_PORT", "4321"))
    server = ThreadingHTTPServer(("127.0.0.1", port), BridgeHandler)
    print(f"[mobile-mcp-bridge] listening on 127.0.0.1:{port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
