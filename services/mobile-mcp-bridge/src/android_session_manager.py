import asyncio
import base64
import subprocess
import threading
import time
from pathlib import Path


class AndroidDeviceSession:
    def __init__(self, serial):
        from mobile_mcp.core.basic_tools_lite import BasicMobileToolsLite
        from mobile_mcp.core.mobile_client import MobileClient

        self.serial = serial
        self.client = MobileClient(device_id=serial, platform="android")
        self.tools = BasicMobileToolsLite(self.client)

    def health(self):
        result = self.tools.check_connection()
        return {"serial": self.serial, **_normalize_result(result)}

    def execute_step(self, step_type, params, device):
        if step_type == "launch_app":
            return _run_async(self.tools.launch_app(str(params.get("appName", ""))))
        if step_type == "tap":
            x = _coord(params.get("x", 0.5), device.get("screenWidth"))
            y = _coord(params.get("y", 0.5), device.get("screenHeight"))
            return self.tools.click_at_coords(x, y)
        if step_type == "swipe":
            from_x = _coord(params.get("fromX", 0.5), device.get("screenWidth"))
            from_y = _coord(params.get("fromY", 0.7), device.get("screenHeight"))
            to_x = _coord(params.get("toX", 0.5), device.get("screenWidth"))
            to_y = _coord(params.get("toY", 0.2), device.get("screenHeight"))
            self.client.u2.swipe(from_x, from_y, to_x, to_y, duration=0.5)
            return {"success": True, "message": "swipe completed", "from": [from_x, from_y], "to": [to_x, to_y]}
        if step_type == "input_text":
            return self._input_text(str(params.get("text", "")), params, device)
        if step_type == "screenshot":
            return self._screenshot(str(params.get("description", "")))
        if step_type == "get_current_app":
            return self.tools.get_current_app()
        if step_type == "adb":
            return self._adb_shell(str(params.get("command", "")))
        return {"success": False, "message": f"Unsupported step type: {step_type}"}

    def call_tool(self, tool_name, args):
        if not hasattr(self.tools, tool_name):
            return {"success": False, "message": f"Unknown tool: {tool_name}"}
        tool = getattr(self.tools, tool_name)
        result = tool(**args)
        if asyncio.iscoroutine(result):
            return _run_async(result)
        return result

    def _input_text(self, text, params, device):
        resource_id = params.get("resourceId") or params.get("resource_id")
        if resource_id:
            return self.tools.input_text_by_id(str(resource_id), text)
        if "x" in params and "y" in params:
            x = _coord(params.get("x"), device.get("screenWidth"))
            y = _coord(params.get("y"), device.get("screenHeight"))
            return self.tools.input_at_coords(x, y, text)
        try:
            self.client.u2.send_keys(text, clear=False)
            return {"success": True, "message": "text input completed", "text": text}
        except Exception as exc:
            return {"success": False, "message": f"text input failed: {exc}"}

    def _screenshot(self, description):
        safe_description = "".join(ch if ch.isalnum() or ch in ("-", "_") else "_" for ch in description).strip("_")
        filename = f"screenshot_{self.serial}_{safe_description or 'step'}_{int(time.time() * 1000)}.png"
        path = Path.cwd() / "artifacts" / self.serial / filename
        path.parent.mkdir(parents=True, exist_ok=True)
        self.client.u2.screenshot(str(path))
        raw = path.read_bytes()
        return {
            "success": True,
            "screenshot_path": str(path),
            "artifacts": [{
                "type": "SCREENSHOT",
                "contentType": "image/png",
                "base64": base64.b64encode(raw).decode("ascii"),
            }],
        }

    def _adb_shell(self, command):
        if not command.strip():
            return {"success": False, "message": "ADB command is required"}

        result = subprocess.run(
            ["adb", "-s", self.serial, "shell", command],
            capture_output=True,
            text=True,
            timeout=30,
        )
        return {
            "success": result.returncode == 0,
            "command": command,
            "code": result.returncode,
            "output": result.stdout,
            "stderr": result.stderr,
            "message": "adb shell completed" if result.returncode == 0 else "adb shell failed",
        }


class AndroidSessionManager:
    def __init__(self):
        self._sessions = {}
        self._locks = {}
        self._guard = threading.Lock()

    def list_devices(self):
        from mobile_mcp.core.device_manager import DeviceManager

        manager = DeviceManager(platform="android")
        return manager.list_devices()

    def with_session(self, serial, action):
        lock = self._lock_for(serial)
        with lock:
            session = self._session_for(serial)
            return action(session)

    def session_count(self):
        with self._guard:
            return len(self._sessions)

    def _session_for(self, serial):
        with self._guard:
            if serial not in self._sessions:
                self._sessions[serial] = AndroidDeviceSession(serial)
            return self._sessions[serial]

    def _lock_for(self, serial):
        with self._guard:
            if serial not in self._locks:
                self._locks[serial] = threading.Lock()
            return self._locks[serial]


def _coord(value, screen_dimension):
    numeric = float(value or 0)
    if 0 <= numeric <= 1 and screen_dimension:
        return round(numeric * int(screen_dimension))
    return round(numeric)


def _normalize_result(result):
    return result if isinstance(result, dict) else {"success": True, "result": result}


def _run_async(awaitable):
    return asyncio.run(awaitable)
