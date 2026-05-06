export const AUTOJS_CONNECTION_SCRIPT = `
function connect() {
  log("Connecting to Laixi Gateway...");
  ws = new WebSocket(GATEWAY_URL);

  ws.onopen = function () {
    log("Connected");
    send({
      type: "register",
      deviceId: DEVICE_ID,
      deviceName: DEVICE_NAME,
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
`;
