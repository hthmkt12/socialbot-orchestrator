import type { LaixiCommandRequest } from '../../shared/src';
import { GATEWAY_PROTOCOL_VERSION } from '../../shared/src';

function buildCommand(
  action: LaixiCommandRequest['action'],
  deviceIds?: string,
  params?: Record<string, unknown>
): LaixiCommandRequest {
  return {
    action,
    deviceIds,
    params,
    protocolVersion: GATEWAY_PROTOCOL_VERSION,
  };
}

export function buildGetAllInfo(): LaixiCommandRequest {
  return buildCommand('All Info');
}

export function buildScreenshot(deviceIds: string, savePath?: string): LaixiCommandRequest {
  return buildCommand('screen', deviceIds, savePath ? { savePath } : {});
}

export function buildTap(deviceIds: string, x: number, y: number): LaixiCommandRequest[] {
  return [
    buildCommand('Screen Control', deviceIds, {
      type: 'pointerEvent',
      action: 'press',
      x,
      y,
    }),
    buildCommand('Screen Control', deviceIds, {
      type: 'pointerEvent',
      action: 'release',
      x,
      y,
    }),
  ];
}

export function buildSwipe(
  deviceIds: string,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  steps: number = 10
): LaixiCommandRequest[] {
  const commands: LaixiCommandRequest[] = [
    buildCommand('Screen Control', deviceIds, {
      type: 'pointerEvent',
      action: 'press',
      x: fromX,
      y: fromY,
    }),
  ];

  for (let i = 1; i <= steps; i++) {
    const ratio = i / steps;
    commands.push(
      buildCommand('Screen Control', deviceIds, {
        type: 'pointerEvent',
        action: 'move',
        x: fromX + (toX - fromX) * ratio,
        y: fromY + (toY - fromY) * ratio,
      })
    );
  }

  commands.push(
    buildCommand('Screen Control', deviceIds, {
      type: 'pointerEvent',
      action: 'release',
      x: toX,
      y: toY,
    })
  );

  return commands;
}

export function buildLaunchApp(deviceIds: string, appName: string): LaixiCommandRequest {
  return buildCommand('OpenApp', deviceIds, { appName });
}

export function buildInputText(deviceIds: string, text: string): LaixiCommandRequest {
  return buildCommand('InputText', deviceIds, { text });
}

export function buildExecuteAdb(deviceIds: string, command: string): LaixiCommandRequest {
  return buildCommand('ExecuteAdb', deviceIds, { command });
}

export function buildExecuteAutoJs(deviceIds: string, filePath: string): LaixiCommandRequest {
  return buildCommand('ExecuteAutoJs', deviceIds, { filePath });
}

export function buildGetCurrentAppInfo(deviceIds: string): LaixiCommandRequest {
  return buildCommand('CurrentAppInfo', deviceIds);
}
