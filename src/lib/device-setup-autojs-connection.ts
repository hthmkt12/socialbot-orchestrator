export const AUTOJS_CONNECTION_SCRIPT = `
var pendingSignedDeviceEvents = {};

function connect() {
  log("Connecting to Device Gateway...");
  ws = new WebSocket(GATEWAY_URL);

  ws.onopen = function () {
    log("Connected");
    send({
      type: "register",
      deviceId: DEVICE_ID,
      deviceName: DEVICE_NAME,
      enrollmentToken: typeof globalThis.GATEWAY_DEVICE_ENROLLMENT_TOKEN === "string"
        ? globalThis.GATEWAY_DEVICE_ENROLLMENT_TOKEN
        : undefined,
    });

    heartbeatTimer = setInterval(function () {
      send({ type: "heartbeat", deviceId: DEVICE_ID });
    }, 15000);
  };

  ws.onmessage = function (event) {
    try {
      handleMessage(JSON.parse(event.data));
    } catch (error) {
      log("Parse error: " + error);
    }
  };

  ws.onerror = function (error) {
    log("WebSocket error: " + error);
  };

  ws.onclose = function () {
    log("Disconnected. Reconnecting in 5s...");
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    setTimeout(connect, 5000);
  };
}

function handleMessage(message) {
  if (message.type === "register_ack" || message.type === "heartbeat_ack") {
    log("Gateway ACK: " + message.type);
    return;
  }

  if (message.type === "signed_device_event_ack") {
    acknowledgeSignedDeviceEvent(message.eventId);
    return;
  }

  if (message.type === "error") {
    log("Gateway error: " + message.message);
    return;
  }

  if (message.type === "dispatch_step") {
    handleDispatchStep(message);
    return;
  }

  log("Unsupported message: " + message.type);
}

function handleDispatchStep(message) {
  try {
    var output = runCommand(message.command || {});
    sendStepResult(message, true, output);
  } catch (error) {
    sendStepResult(message, false, {}, String(error));
  }
}

function emitSignedDeviceEvent(eventId, envelope) {
  if (typeof eventId !== "string" || !eventId || typeof envelope !== "string" || !envelope) {
    throw new Error("Signed device event requires a non-empty event ID and envelope");
  }

  acknowledgeSignedDeviceEvent(eventId);
  pendingSignedDeviceEvents[eventId] = { envelope: envelope };
  sendSignedDeviceEvent(eventId);
}

function sendSignedDeviceEvent(eventId) {
  var pending = pendingSignedDeviceEvents[eventId];
  if (!pending) return;
  send({
    type: "signed_device_event",
    protocolVersion: PROTOCOL_VERSION,
    eventId: eventId,
    deviceId: DEVICE_ID,
    envelope: pending.envelope,
  });
  pending.retryTimer = setTimeout(function () {
    sendSignedDeviceEvent(eventId);
  }, 3000);
}

function acknowledgeSignedDeviceEvent(eventId) {
  var pending = pendingSignedDeviceEvents[eventId];
  if (!pending) return;
  if (pending.retryTimer) clearTimeout(pending.retryTimer);
  delete pendingSignedDeviceEvents[eventId];
}
`;
