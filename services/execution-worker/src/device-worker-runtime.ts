import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Worker, type WorkerOptions } from 'node:worker_threads';

interface DeviceWorkerRuntime {
  workerFile: string;
  entryUrl?: string;
  eval: boolean;
  workerOptions: Pick<WorkerOptions, 'execArgv'>;
}

function resolveDeviceWorkerRuntime(dirname: string): DeviceWorkerRuntime {
  const jsWorkerFile = resolve(dirname, './execute-device-worker-thread.js');
  if (existsSync(jsWorkerFile)) {
    return { workerFile: jsWorkerFile, eval: false, workerOptions: {} };
  }

  const tsWorkerFile = resolve(dirname, './execute-device-worker-thread.ts');
  if (existsSync(tsWorkerFile)) {
    const tsxPreflightFile = resolve(dirname, '../node_modules/tsx/dist/preflight.cjs');
    const tsxLoaderFile = resolve(dirname, '../node_modules/tsx/dist/loader.mjs');
    const execArgv =
      existsSync(tsxPreflightFile) && existsSync(tsxLoaderFile)
        ? ['--require', tsxPreflightFile, '--import', pathToFileURL(tsxLoaderFile).href]
        : ['--import', 'tsx'];

    return {
      workerFile: "import { workerData } from 'node:worker_threads'; await import(workerData.__entryUrl);",
      entryUrl: pathToFileURL(tsWorkerFile).href,
      eval: true,
      workerOptions: { execArgv },
    };
  }

  return { workerFile: jsWorkerFile, eval: false, workerOptions: {} };
}

export function hasCompiledDeviceWorker(dirname: string): boolean {
  return existsSync(resolve(dirname, './execute-device-worker-thread.js'));
}

export function createDeviceWorker(dirname: string, workerData: unknown): Worker {
  const runtime = resolveDeviceWorkerRuntime(dirname);
  return new Worker(runtime.workerFile, {
    workerData: runtime.entryUrl && typeof workerData === 'object' && workerData !== null
      ? { ...workerData, __entryUrl: runtime.entryUrl }
      : workerData,
    eval: runtime.eval,
    ...runtime.workerOptions,
  });
}
