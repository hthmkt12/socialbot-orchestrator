import sys
import types
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
sys.path.insert(0, str(SRC))


async_adbutils = types.ModuleType("async_adbutils")
async_adbutils.adb = types.SimpleNamespace(device_list=lambda: [])
sys.modules.setdefault("async_adbutils", async_adbutils)

mobilerun = types.ModuleType("mobilerun")
mobilerun.AndroidDriver = object
mobilerun.MobileAgent = object
mobilerun.load_llm = lambda *args, **kwargs: object()
sys.modules.setdefault("mobilerun", mobilerun)

mobilerun_core_cli = types.ModuleType("mobilerun_core_cli")
portal = types.ModuleType("mobilerun_core_cli.portal")
portal.ensure_portal_ready = lambda device: None
sys.modules.setdefault("mobilerun_core_cli", mobilerun_core_cli)
sys.modules.setdefault("mobilerun_core_cli.portal", portal)

from android_session_manager import (  # noqa: E402
    _handle_input_text,
    _handle_screenshot,
    is_valid_base64,
    validate_android_package_name,
    validate_step_platform,
)
import bridge_server  # noqa: E402


class BridgeGuardTests(unittest.TestCase):
    def test_ad_can_010_health_auth_status_requires_explicit_insecure_dev(self):
        self.assertEqual(
            bridge_server.bridge_auth_status(token="secret", allow_insecure_dev=True),
            {
                "authRequired": True,
                "insecureDevMode": False,
                "authConfigured": True,
                "protectedEndpointsAvailable": True,
            },
        )
        self.assertEqual(
            bridge_server.bridge_auth_status(token="", allow_insecure_dev=True),
            {
                "authRequired": False,
                "insecureDevMode": True,
                "authConfigured": True,
                "protectedEndpointsAvailable": True,
            },
        )
        self.assertEqual(
            bridge_server.bridge_auth_status(token="", allow_insecure_dev=False),
            {
                "authRequired": False,
                "insecureDevMode": False,
                "authConfigured": False,
                "protectedEndpointsAvailable": False,
            },
        )

    def test_br_err_004_invalid_android_package(self):
        self.assertIsNone(validate_android_package_name("com.example.app"))

        result = validate_android_package_name("bad package;rm -rf")

        self.assertEqual(result["code"], "INVALID_ANDROID_PACKAGE")
        self.assertFalse(result["success"])

    def test_br_no_002_ios_adb_only_steps(self):
        result = validate_step_platform("ios", "adb")

        self.assertEqual(result["code"], "IOS_ADB_ONLY_STEP")
        self.assertIn("Android/ADB-only", result["message"])

    def test_br_err_006_screenshot_failure_returns_no_fake_artifact(self):
        class Driver:
            async def screenshot(self):
                return b""

        class Session:
            identifier = "serial-1"
            driver = Driver()

            def _run(self, coro):
                try:
                    return coro.send(None)
                except StopIteration as exc:
                    return exc.value

        result = _handle_screenshot(Session(), {}, {})

        self.assertEqual(result["code"], "SCREENSHOT_FAILED")
        self.assertNotIn("artifacts", result)

    def test_base64_validator_rejects_invalid_values(self):
        self.assertTrue(is_valid_base64("aW1hZ2U="))
        self.assertFalse(is_valid_base64("not base64 !!!"))

    def test_br_err_003_session_unavailable_returns_device_error(self):
        class Manager:
            def with_session(self, *_args, **_kwargs):
                raise RuntimeError("serial offline")

        previous = bridge_server.MANAGER
        bridge_server.MANAGER = Manager()
        try:
            status, body = bridge_server._execute_step(
                "offline-serial",
                {
                    "stepType": "tap",
                    "params": {"x": 1, "y": 1},
                    "device": {"platform": "android"},
                },
            )
        finally:
            bridge_server.MANAGER = previous

        self.assertEqual(status, 404)
        self.assertEqual(body["code"], "DEVICE_SESSION_UNAVAILABLE")
        self.assertIn("serial offline", body["error"])

    # -- input_text plaintext containment tests --

    CANARY = "DO_NOT_PERSIST_PASSWORD_123"

    def test_input_text_success_does_not_echo_text(self):
        """Bridge input_text success response must never contain the submitted text."""
        class Driver:
            async def input_text(self, text, clear=False):
                return True

        class Session:
            identifier = "serial-1"
            driver = Driver()

            def _run(self, coro):
                try:
                    return coro.send(None)
                except StopIteration as exc:
                    return exc.value

        result = _handle_input_text(Session(), {"text": self.CANARY, "clear": False}, {})

        self.assertTrue(result["success"])
        self.assertTrue(result.get("accepted"))
        # The canary must not appear anywhere in the response
        self.assertNotIn(self.CANARY, str(result))
        # The old "text" echo field must be absent
        self.assertNotIn("text", result)

    def test_input_text_failure_does_not_echo_text(self):
        """Bridge input_text failure response must never contain the submitted text."""
        class Driver:
            async def input_text(self, text, clear=False):
                return False

        class Session:
            identifier = "serial-1"
            driver = Driver()

            def _run(self, coro):
                try:
                    return coro.send(None)
                except StopIteration as exc:
                    return exc.value

        result = _handle_input_text(Session(), {"text": self.CANARY, "clear": False}, {})

        self.assertFalse(result["success"])
        self.assertNotIn(self.CANARY, str(result))
        self.assertNotIn("text", result)

    def test_input_text_driver_exception_does_not_leak_canary(self):
        """Driver exception containing the canary must be caught and mapped to a fixed safe error."""
        class Driver:
            async def input_text(self, text, clear=False):
                raise RuntimeError(f"Driver error processing text: {text}")

        class Session:
            identifier = "serial-1"
            driver = Driver()

            def _run(self, coro):
                try:
                    return coro.send(None)
                except StopIteration as exc:
                    return exc.value

        result = _handle_input_text(Session(), {"text": self.CANARY, "clear": False}, {})

        self.assertFalse(result["success"])
        self.assertEqual(result["code"], "INPUT_TEXT_FAILED")
        self.assertEqual(result["message"], "input_text failed")
        # The canary must not appear anywhere in the response
        self.assertNotIn(self.CANARY, str(result))

    def test_bridge_handler_auth_enforcement(self):
        class DummyHandler:
            def __init__(self, headers, bridge_token, allow_insecure):
                self.headers = headers
                self.bridge_token = bridge_token
                self.allow_insecure = allow_insecure
                self.responses = []

            def _send_json(self, status, payload):
                self.responses.append((status, payload))

            _check_auth = bridge_server.BridgeHandler._check_auth

        # 1. Valid token succeeds
        orig_token, orig_insecure = bridge_server.BRIDGE_TOKEN, bridge_server.ALLOW_INSECURE_DEV
        try:
            bridge_server.BRIDGE_TOKEN = "valid-token-123"
            bridge_server.ALLOW_INSECURE_DEV = False

            handler = DummyHandler({"x-bridge-token": "valid-token-123"}, "valid-token-123", False)
            self.assertTrue(handler._check_auth())
            self.assertEqual(len(handler.responses), 0)

            # 2. Missing/invalid token returns 401
            handler_invalid = DummyHandler({"x-bridge-token": "wrong"}, "valid-token-123", False)
            self.assertFalse(handler_invalid._check_auth())
            self.assertEqual(handler_invalid.responses[0][0], 401)
            self.assertEqual(handler_invalid.responses[0][1]["code"], "BRIDGE_UNAUTHORIZED")

            # 3. Unconfigured auth without insecure dev returns 503
            bridge_server.BRIDGE_TOKEN = ""
            bridge_server.ALLOW_INSECURE_DEV = False
            handler_unconfigured = DummyHandler({}, "", False)
            self.assertFalse(handler_unconfigured._check_auth())
            self.assertEqual(handler_unconfigured.responses[0][0], 503)
            self.assertEqual(handler_unconfigured.responses[0][1]["code"], "BRIDGE_AUTH_NOT_CONFIGURED")

            # 4. Insecure dev mode allows unauthenticated
            bridge_server.ALLOW_INSECURE_DEV = True
            handler_insecure = DummyHandler({}, "", True)
            self.assertTrue(handler_insecure._check_auth())
            self.assertEqual(len(handler_insecure.responses), 0)
        finally:
            bridge_server.BRIDGE_TOKEN = orig_token
            bridge_server.ALLOW_INSECURE_DEV = orig_insecure


if __name__ == "__main__":
    unittest.main()
