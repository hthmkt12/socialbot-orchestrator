import { GATEWAY_PROTOCOL_VERSION } from '../../packages/shared/src';
import { AUTOJS_CONNECTION_SCRIPT } from './device-setup-autojs-connection';

export function buildAutoJsInitScript(gatewayWsUrl: string) {
  return `// Device bridge AutoJS agent bootstrap
const GATEWAY_URL = "${gatewayWsUrl}";
const PROTOCOL_VERSION = "${GATEWAY_PROTOCOL_VERSION}";
const DEVICE_ID = device.serial || android.os.Build.SERIAL || "unknown";
const DEVICE_NAME = device.brand + " " + device.model;

let ws = null;
let heartbeatTimer = null;
let pointerState = null;

${AUTOJS_CONNECTION_SCRIPT}

function runCommand(command) {
  var params = command.params || {};

  switch (command.action) {
    case "OpenApp":
      var appName = String(params.appName || "");
      app.launchPackage(appName);
      return { appName: appName };

    case "InputText":
      var text = String(params.text || "");
      shell("input text " + escapeInputText(text), true);
      return { text: text };

    case "ExecuteAdb":
      var adb = shell(String(params.command || ""), true);
      return { output: adb.result, code: adb.code };

    case "ExecuteAutoJs":
      var filePath = String(params.filePath || "");
      engines.execScriptFile(filePath);
      return { filePath: filePath, started: true };

    case "CurrentAppInfo":
      return {
        packageName: currentPackage(),
        activityName: currentActivity(),
      };

    case "screen":
      requestScreenCapture(false);
      var image = captureScreen();
      var base64 = images.toBase64(image, "png", 100);
      return {
        base64: base64,
        artifacts: [
          {
            type: "SCREENSHOT",
            contentType: "image/png",
            base64: base64,
          }
        ]
      };

    case "Screen Control":
      return handleScreenControl(params);

    default:
      throw new Error("Unsupported action: " + command.action);
  }
}

function handleScreenControl(params) {
  if (params.type !== "pointerEvent") {
    throw new Error("Unsupported screen-control type: " + params.type);
  }

  var action = String(params.action || "");
  var x = Math.round(Number(params.x || 0));
  var y = Math.round(Number(params.y || 0));

  if (action === "press") {
    pointerState = { startX: x, startY: y, lastX: x, lastY: y };
    return { pointerEvent: action, x: x, y: y };
  }

  if (action === "move") {
    if (!pointerState) {
      pointerState = { startX: x, startY: y, lastX: x, lastY: y };
    }
    pointerState.lastX = x;
    pointerState.lastY = y;
    return { pointerEvent: action, x: x, y: y };
  }

  if (action === "release") {
    var state = pointerState || { startX: x, startY: y, lastX: x, lastY: y };
    pointerState = null;

    if (Math.abs(state.startX - x) <= 8 && Math.abs(state.startY - y) <= 8) {
      shell("input tap " + x + " " + y, true);
      return { gesture: "tap", x: x, y: y };
    }

    shell(
      "input swipe " + state.startX + " " + state.startY + " " + x + " " + y + " 250",
      true
    );
    return {
      gesture: "swipe",
      fromX: state.startX,
      fromY: state.startY,
      toX: x,
      toY: y,
    };
  }

  throw new Error("Unsupported pointer action: " + action);
}

function escapeInputText(text) {
  return String(text)
    .replace(/\\\\/g, "\\\\\\\\")
    .replace(/ /g, "%s");
}

function sendStepResult(message, success, output, error) {
  var normalizedOutput = output || {};
  var artifacts = normalizedOutput.artifacts;

  if (artifacts) {
    delete normalizedOutput.artifacts;
  }

  var result = {
    success: success,
    output: normalizedOutput,
  };

  if (artifacts) {
    result.artifacts = artifacts;
  }

  if (error) {
    result.error = error;
  }

  send({
    type: "step_result",
    protocolVersion: PROTOCOL_VERSION,
    requestId: message.requestId,
    runId: message.runId,
    stepId: message.stepId,
    deviceId: DEVICE_ID,
    result: result,
  });
}

function send(data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

connect();
`;
}


export { GATEWAY_PROTOCOL_EXAMPLE } from './device-setup-protocol-example';
