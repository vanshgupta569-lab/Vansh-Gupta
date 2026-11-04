// FILE: src/data/bridgeRunner.ts
//
// How a screen asks for a bridge (build step 5, job C4). One call, one
// answer: the promise resolves once, with the complete bridge, or rejects
// with the reason. There is no progress callback on purpose — the screen
// shows the bridge after it is finished, never progressively (C-2).
//
// Where the browser has no Worker (an old browser, a test runner), the same
// function runs on the main thread after the current frame, so the answer is
// the same and only the freeze differs.

import { bridgeBetween, type BridgeResult, type BridgeVersion, type BridgeMetric } from './bridge';

/** Measured 4 November 2026: 10 drivers, 1,024 runs, 3.3–4.1s. C-2's line. */
export const BRIDGE_WORKER_THRESHOLD_MS = 2000;

export function bridgeInWorker(
  A: BridgeVersion,
  B: BridgeVersion,
  opts: { metric?: BridgeMetric; exactLimit?: number; orders?: number; seed?: number } = {}
): Promise<BridgeResult> {
  if (typeof Worker === 'undefined') {
    return new Promise((resolve, reject) =>
      setTimeout(() => {
        try {
          resolve(bridgeBetween(A, B, opts));
        } catch (error) {
          reject(error);
        }
      }, 0)
    );
  }
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./bridgeWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent) => {
      worker.terminate();
      const data = event.data || {};
      if (data.ok) resolve(data.result as BridgeResult);
      else reject(new Error(data.error || 'The bridge could not be computed.'));
    };
    worker.onerror = (event: ErrorEvent) => {
      worker.terminate();
      reject(new Error(event.message || 'The bridge worker failed.'));
    };
    worker.postMessage({ A, B, opts });
  });
}

export default { bridgeInWorker, BRIDGE_WORKER_THRESHOLD_MS };
