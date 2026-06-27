import asyncio
import base64
import os
import re
import threading
import time
from pathlib import Path

from async_adbutils import adb
from mobilerun import AndroidDriver
from mobilerun_core_cli.portal import ensure_portal_ready


class DeviceSession:
    """Wraps a Mobilerun AndroidDriver or IOSDriver for one device.

    Each session owns a dedicated asyncio event loop so the sync bridge
    server can call async driver methods without interference.
    """

    def __init__(self, identifier, platform="android"):
        self.identifier = identifier
        self.platform = platform
        self._loop = asyncio.new_event_loop()

        if platform == "ios":
            from mobilerun.tools.driver.ios import IOSDriver

            self.driver = IOSDriver(url=identifier)
            # No auto-setup — iOS Portal must be pre-installed + iproxy running
        else:
            self.driver = AndroidDriver(serial=identifier)
            self._run(self.driver.connect())
            self._run(ensure_portal_ready(self.driver.device))

    def _run(self, coro):
        return self._loop.run_until_complete(coro)

    # -- health ---------------------------------------------------------------

    def health(self):
        try:
            if self.platform == "ios":
                date_str = self._run(self.driver.get_date())
                return {
                    "serial": self.identifier,
                    "success": True,
                    "state": "ok",
                    "platform": "ios",
                    "date": date_str,
                }
            self._run(self.driver.ensure_connected())
            state = self._run(self.driver.device.get_state())
            return {"serial": self.identifier, "success": True, "state": state, "platform": "android"}
        except Exception as exc:
            return {"serial": self.identifier, "success": False, "error": str(exc), "platform": self.platform}

    # -- step dispatch --------------------------------------------------------

    def execute_step(self, step_type, params, device):
        handler = _STEP_HANDLERS.get(step_type)
        if handler is None:
            return {"success": False, "message": f"Unsupported step type: {step_type}"}
        return handler(self, params, device)

    # -- tool dispatch --------------------------------------------------------

    def call_tool(self, tool_name, args):
        if tool_name == "get_ui_tree":
            tree = self._run(self.driver.get_ui_tree())
            return {"success": True, "tree": tree}
        if tool_name == "get_apps":
            apps = self._run(self.driver.get_apps(include_system=args.get("include_system", True)))
            return {"success": True, "apps": apps}
        if tool_name == "press_button":
            button = str(args.get("button", "back"))
            if button not in self.driver.supported_buttons:
                return {
                    "success": False,
                    "message": f"Button '{button}' not supported on {self.platform}. "
                    f"Supported: {', '.join(sorted(self.driver.supported_buttons))}",
                }
            self._run(self.driver.press_button(button))
            return {"success": True, "message": f"pressed {button}"}
        if tool_name == "list_packages":
            pkgs = self._run(self.driver.list_packages(include_system=args.get("include_system", False)))
            return {"success": True, "packages": pkgs}
        return {"success": False, "message": f"Unknown tool: {tool_name}"}


# -- step handler functions ---------------------------------------------------
# Each receives (session, params, device) and returns a result dict.


def _handle_launch_app(session, params, _device):
    pkg = str(params.get("appName", ""))
    result = session._run(session.driver.start_app(pkg))
    return {"success": True, "message": result, "appName": pkg}


def _handle_tap(session, params, device):
    x = _coord(params.get("x", 0.5), device.get("screenWidth"))
    y = _coord(params.get("y", 0.5), device.get("screenHeight"))
    session._run(session.driver.tap(x, y))
    return {"success": True, "message": "tap completed", "x": x, "y": y}


def _handle_swipe(session, params, device):
    from_x = _coord(params.get("fromX", 0.5), device.get("screenWidth"))
    from_y = _coord(params.get("fromY", 0.7), device.get("screenHeight"))
    to_x = _coord(params.get("toX", 0.5), device.get("screenWidth"))
    to_y = _coord(params.get("toY", 0.2), device.get("screenHeight"))
    duration_ms = float(params.get("durationMs", 500))
    session._run(session.driver.swipe(from_x, from_y, to_x, to_y, duration_ms))
    return {
        "success": True,
        "message": "swipe completed",
        "from": [from_x, from_y],
        "to": [to_x, to_y],
    }


def _handle_input_text(session, params, _device):
    text = str(params.get("text", ""))
    clear = bool(params.get("clear", False))
    ok = session._run(session.driver.input_text(text, clear=clear))
    return {"success": ok, "message": "text input completed" if ok else "text input failed", "text": text}


def _handle_screenshot(session, params, _device):
    raw_bytes = session._run(session.driver.screenshot())
    b64 = base64.b64encode(raw_bytes).decode("ascii")

    # Also persist to disk for artifact archival
    safe_desc = "".join(
        ch if ch.isalnum() or ch in ("-", "_") else "_"
        for ch in str(params.get("description", ""))
    ).strip("_")
    filename = f"screenshot_{session.identifier}_{safe_desc or 'step'}_{int(time.time() * 1000)}.png"
    path = Path.cwd() / "artifacts" / session.identifier / filename
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(raw_bytes)

    return {
        "success": True,
        "screenshot_path": str(path),
        "artifacts": [{"type": "SCREENSHOT", "contentType": "image/png", "base64": b64}],
    }


def _handle_get_current_app(session, _params, _device):
    if session.platform == "ios":
        return {"success": False, "message": "get_current_app is not supported on iOS"}
    try:
        output = session._run(session.driver.device.shell("dumpsys activity activities"))
        package, activity = _parse_current_app(output)
        return {"success": True, "package": package, "activity": activity}
    except Exception as exc:
        return {"success": False, "message": f"get_current_app failed: {exc}"}


def _handle_adb(session, params, _device):
    if session.platform == "ios":
        return {"success": False, "message": "ADB shell is not supported on iOS"}
    command = str(params.get("command", "")).strip()
    if not command:
        return {"success": False, "message": "ADB command is required"}
    try:
        output = session._run(session.driver.device.shell(command))
        return {"success": True, "command": command, "output": output, "code": 0, "message": "adb shell completed"}
    except Exception as exc:
        return {"success": False, "command": command, "output": "", "stderr": str(exc), "code": 1, "message": "adb shell failed"}


def _handle_press_button(session, params, _device):
    button = str(params.get("button", "back"))
    if button not in session.driver.supported_buttons:
        return {
            "success": False,
            "message": f"Button '{button}' not supported on {session.platform}. "
            f"Supported: {', '.join(sorted(session.driver.supported_buttons))}",
        }
    session._run(session.driver.press_button(button))
    return {"success": True, "message": f"pressed {button}"}


def _handle_get_ui_tree(session, _params, _device):
    tree = session._run(session.driver.get_ui_tree())
    return {"success": True, "tree": tree}


# -- ai_task (MobileAgent) -------------------------------------------------------


import re
import json

def _handle_extract_var(session, params, _device):
    # Needs to extract text from a shell command or ui_tree
    source = params.get("source", "adb") # adb or ui_tree
    
    if source == "adb":
        if session.platform == "ios":
            return {"success": False, "message": "ADB shell source is not supported on iOS"}
        command = str(params.get("command", "")).strip()
        if not command:
            return {"success": False, "message": "command is required for adb source"}
        try:
            output = session._run(session.driver.device.shell(command))
            
            # Apply regex extraction if specified
            regex = params.get("regex")
            if regex:
                match = re.search(regex, output)
                if match:
                    extracted = match.group(1) if len(match.groups()) > 0 else match.group(0)
                else:
                    extracted = ""
            else:
                extracted = output.strip()
                
            return {"success": True, "value": extracted, "raw_output": output}
        except Exception as exc:
            return {"success": False, "message": f"extract_var adb failed: {str(exc)}"}
            
    elif source == "ui_tree":
        # Extract from a UI tree element
        text_match = params.get("text_match")
        id_match = params.get("id_match")
        try:
            tree = session._run(session.driver.get_ui_tree())
            # For this simple MVP, we just find the node
            # This is complex and depends on the ui tree format (xml/json)
            # Leaving basic extraction
            return {"success": False, "message": "ui_tree source not fully implemented yet, use adb"}
        except Exception as exc:
            return {"success": False, "message": f"extract_var ui_tree failed: {str(exc)}"}
            
    return {"success": False, "message": f"Unknown extract_var source: {source}"}
def _handle_ai_task(session, params, _device):
    """Execute a natural-language goal on the device via Mobilerun MobileAgent.

    Requires LLM credentials configured via env vars:

        MOBILERUN_LLM_PROVIDER  (default: OpenAIResponses)
        MOBILERUN_LLM_MODEL     (default: gpt-4o)
        MOBILERUN_LLM_API_KEY   (default: None -> falls back to env default)

    The MobileAgent module is imported lazily so the bridge starts fast
    even when the heavy llama-index dependency is present.
    """
    goal = str(params.get("goal", "")).strip()
    if not goal:
        return {"success": False, "message": "ai_task requires a non-empty 'goal' param"}

    # Lazy import -- MobileAgent pulls in llama-index et al.
    from mobilerun import MobileAgent, load_llm

    # Build / retrieve cached LLM for this session
    if not hasattr(session, "_mobile_llm") or session._mobile_llm is None:
        provider = os.environ.get("MOBILERUN_LLM_PROVIDER", "OpenAIResponses")
        model = os.environ.get("MOBILERUN_LLM_MODEL", "gpt-4o")
        api_key = os.environ.get("MOBILERUN_LLM_API_KEY")
        kwargs = {}
        if api_key:
            kwargs["api_key"] = api_key
        session._mobile_llm = load_llm(provider, model=model, **kwargs)

    timeout = int(params.get("timeout", 300))

    agent = MobileAgent(
        goal=goal,
        llms={"fast_agent": session._mobile_llm},
        driver=session.driver,
        timeout=timeout,
    )

    try:
        handler = session._run(agent.run())
        result = session._run(handler)
        return {
            "success": result.success,
            "reason": result.reason,
            "steps": result.steps,
            "structured_output": (result.structured_output.model_dump() if result.structured_output else None),
        }
    except Exception as exc:
        return {"success": False, "reason": str(exc), "steps": 0, "structured_output": None}


_STEP_HANDLERS = {
    "launch_app": _handle_launch_app,
    "tap": _handle_tap,
    "swipe": _handle_swipe,
    "input_text": _handle_input_text,
    "screenshot": _handle_screenshot,
    "get_current_app": _handle_get_current_app,
    "adb": _handle_adb,
    "press_button": _handle_press_button,
    "get_ui_tree": _handle_get_ui_tree,
    "ai_task": _handle_ai_task,
    "extract_var": _handle_extract_var,
}


# -- session manager ----------------------------------------------------------


class DeviceSessionManager:
    """Thread-safe manager that lazily creates one DeviceSession per (platform, identifier) pair."""

    def __init__(self):
        self._sessions = {}
        self._locks = {}
        self._guard = threading.Lock()

    def list_devices(self):
        loop = asyncio.new_event_loop()
        try:
            # Android devices via ADB
            devices = loop.run_until_complete(adb.device_list())
            result = [
                {"serial": str(d.serial), "state": "device", "platform": "android"}
                for d in devices
            ]

            # iOS devices via Portal probe
            try:
                from mobilerun.tools.driver.ios import discover_ios_portal

                ios_url = loop.run_until_complete(discover_ios_portal())
                result.append({"serial": ios_url, "state": "device", "platform": "ios"})
            except Exception:
                pass  # No iOS Portal reachable

            return result
        finally:
            loop.close()

    def with_session(self, identifier, action, platform="android"):
        key = (platform, identifier)
        lock = self._lock_for(key)
        with lock:
            session = self._session_for(key, identifier, platform)
            return action(session)

    def session_count(self):
        with self._guard:
            return len(self._sessions)

    def _session_for(self, key, identifier, platform):
        with self._guard:
            if key not in self._sessions:
                self._sessions[key] = DeviceSession(identifier, platform)
            return self._sessions[key]

    def _lock_for(self, key):
        with self._guard:
            if key not in self._locks:
                self._locks[key] = threading.Lock()
            return self._locks[key]


# Backward-compatible alias so existing imports in bridge_server.py keep working
AndroidSessionManager = DeviceSessionManager


# -- helpers ------------------------------------------------------------------


def _coord(value, screen_dimension):
    numeric = float(value or 0)
    if 0 <= numeric <= 1 and screen_dimension:
        return round(numeric * int(screen_dimension))
    return round(numeric)


_RESUMED_RE = re.compile(r"mResumedActivity:.*?(?:ActivityRecord\{[^}]+\s+)?(\S+)/(\S+)")


def _parse_current_app(dumpsys_output):
    """Extract (package, activity) from 'dumpsys activity activities' output."""
    match = _RESUMED_RE.search(dumpsys_output)
    if match:
        return match.group(1), match.group(2)
    # Fallback: try mFocusedApp pattern
    focused = re.search(r"mFocusedApp.*?(\S+)/(\S+)", dumpsys_output)
    if focused:
        return focused.group(1), focused.group(2)
    return "", ""
