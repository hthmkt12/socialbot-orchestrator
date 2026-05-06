const DEMO_MACRO_DEFINITION = `{
  "version": 1,
  "meta": {
    "key": "demo_launch_capture",
    "name": "Demo: Launch & Capture",
    "tags": ["demo"]
  },
  "inputs": {
    "appName": { "type": "string", "required": true }
  },
  "target": { "mode": "single_device" },
  "execution": {
    "defaultTimeoutMs": 15000,
    "maxRetries": 0,
    "onError": "stop"
  },
  "steps": [
    { "id": "launch",   "type": "launch_app",      "params": { "appName": "{{appName}}" } },
    { "id": "wait1",    "type": "wait",             "params": { "ms": 3000 } },
    { "id": "screen1",  "type": "screenshot",       "params": { "saveToArtifact": true } },
    { "id": "current1", "type": "get_current_app",  "params": {} }
  ]
}`;

export function DemoMacroDefinitionPanel() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Macro Definition</h3>
      <pre className="text-[11px] text-gray-600 font-mono bg-gray-50 rounded-lg p-4 overflow-auto max-h-64">
        {DEMO_MACRO_DEFINITION}
      </pre>
    </div>
  );
}
