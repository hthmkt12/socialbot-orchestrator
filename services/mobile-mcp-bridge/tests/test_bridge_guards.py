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


if __name__ == "__main__":
    unittest.main()
