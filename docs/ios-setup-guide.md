# iOS Device Setup Guide

How to connect iOS devices to the Mobilerun bridge via the Portal app and iproxy.

## Architecture

```
iOS Device                 macOS/Linux Host             Bridge
┌──────────┐   USB/WiFi   ┌──────────────────┐   TCP    ┌──────────────────────┐
│ Portal   │ ◄──────────► │ iproxy           │ ◄──────► │ DeviceSession        │
│ App      │              │ localhost:6643    │          │  └─ IOSDriver(url)   │
└──────────┘              └──────────────────┘          └──────────────────────┘
```

The Mobilerun Portal iOS app exposes a REST API on the device. `iproxy` forwards a local port (default 6643) to the device's Portal port. The bridge's `IOSDriver` communicates with Portal over HTTP.

Unlike Android (auto-setup via `ensure_portal_ready()`), iOS setup is manual — you install the Portal app once and keep iproxy running whenever the device is needed.

## Prerequisites

- iOS device (iPhone or iPad) running iOS 15+
- Apple Developer account (free or paid) or a sideloading method
- `iproxy` from `libimobiledevice` installed on the host machine
- USB cable or same-network WiFi

### Install iproxy

**macOS (Homebrew):**
```bash
brew install libimobiledevice
```

**Linux:**
```bash
# Debian/Ubuntu
sudo apt install libimobiledevice-utils

# Fedora
sudo dnf install libimobiledevice-utils
```

**Windows:**
Use the Windows builds from `libimobiledevice` or use WSL with USB passthrough.

## Step 1: Install the Portal App

The Portal iOS app is distributed through TestFlight or enterprise distribution.

1. **Register your device** in the Mobilerun developer portal (if required)
2. **Install the Portal app** via the provided TestFlight link or MDM distribution
3. **Trust the developer certificate** on the device (Settings → General → VPN & Device Management)
4. **Open the Portal app** — it should show a "Ready" or "Listening" status

> The Portal app does NOT auto-start on boot — launch it manually before use, or configure it as a background-launch app.

## Step 2: Find the Device UDID

Connect the device via USB and find its UDID:

```bash
iproxy --help  # verify iproxy is installed

# List connected devices (look for the 40-char hex UDID)
idevice_id -l
```

## Step 3: Start iproxy

Forward a local port to the Portal app on the device:

```bash
# Forward localhost:6643 → device Portal port
iproxy 6643 6643 <UDID>
```

Replace `<UDID>` with the device UDID from step 2. Omit the UDID to forward the only connected device.

Each iOS device needs its own iproxy instance with a unique local port:

```bash
# Device 1
iproxy 6643 6643 <UDID_1>

# Device 2 (different terminal)
iproxy 6644 6643 <UDID_2>
```

Keep the iproxy terminal(s) running. The bridge auto-discovers devices by probing localhost ports 6643-6653.

## Step 4: Configure Environment

In `.env` (or worker env), set the bridge URL and expected serials:

```ini
MOBILE_MCP_BRIDGE_URL=http://127.0.0.1:4321
MOBILE_MCP_EXPECTED_SERIALS=http://127.0.0.1:6643
```

For multiple iOS devices, list all Portal URLs:

```ini
MOBILE_MCP_EXPECTED_SERIALS=http://127.0.0.1:6643,http://127.0.0.1:6644
```

Set the device's platform in `metadata_json` (via Supabase or API):

```json
{
  "platform": "ios"
}
```

If not set, the worker defaults to `"android"`.

## Step 5: Verify the Connection

**Check bridge health:**
```bash
curl http://127.0.0.1:4321/health
```
Expected: `{"service": "mobile-mcp-bridge", "status": "ok", "sessionCount": 1}`

**List discovered devices:**
```bash
curl http://127.0.0.1:4321/devices
```
Expected: includes entry with `"platform": "ios"` and `"serial": "http://127.0.0.1:6643"`

**Check device health:**
```bash
curl "http://127.0.0.1:4321/devices/$(echo -n 'http://127.0.0.1:6643' | jq -sRr @uri)/health"
```
Expected: `{"success": true, "platform": "ios", "state": "ok", "date": "..."}`

## Step 6: Run a Smoke Step

```bash
curl -X POST "http://127.0.0.1:4321/devices/$(echo -n 'http://127.0.0.1:6643' | jq -sRr @uri)/execute-step" \
  -H "content-type: application/json" \
  -d '{"stepType": "screenshot", "params": {}, "device": {"serial": "http://127.0.0.1:6643", "platform": "ios", "screenWidth": 390, "screenHeight": 844}}'
```

Expected: returns `{"success": true, "output": {"captured": true, ...}}` with a base64 screenshot.

## Supported Steps on iOS

| Step | Status | Notes |
|------|--------|-------|
| `launch_app` | ✅ | Uses bundle ID |
| `tap` | ✅ | |
| `swipe` | ✅ | |
| `input_text` | ✅ | |
| `screenshot` | ✅ | |
| `press_button` | ⚠️ | `home` only; `back` and `enter` return errors |
| `get_ui_tree` | ✅ | Accessibility tree via Portal |
| `ai_task` | ✅ | LLM-driven via MobileAgent |
| `get_current_app` | ❌ | Not available — iOS has no ADB dumpsys |
| `adb` | ❌ | Not available — iOS has no ADB |

## Troubleshooting

### iproxy fails to connect
```
Error: Could not connect to device, error code -4
```
- Verify the device is unlocked and the Portal app is running
- Check USB cable or WiFi connection
- Try `ideviceinfo` to confirm the device is reachable

### Portal URL not discovered
```
ConnectionError: Could not find iOS portal on 127.0.0.1 (scanned ports 6643-6652)
```
- Confirm iproxy is running and showing no errors
- Verify the port: `curl http://127.0.0.1:6643/device/date`
- If using a non-default port, update `MOBILE_MCP_EXPECTED_SERIALS`

### Step returns "not supported" for iOS
- Check the step compatibility table above
- `get_current_app` and `adb` are Android-only — adjust your macro
- `press_button` only supports `home` on iOS

### Device shows as Android in the UI
- Set `metadata_json.platform = "ios"` on the device row in Supabase
- The worker reads this field to pass the correct platform to the bridge
