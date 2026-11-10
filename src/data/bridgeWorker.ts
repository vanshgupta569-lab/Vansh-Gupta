// FILE: src/data/bridgeWorker.ts
//
// THE BRIDGE, OFF THE MAIN THREAD (build step 5, job C4; decision C-2).
//
// Measured on 4 November 2026: a bridge over 10 drivers is 1,024 engine runs
// and took 3.3–4.1 seconds on the paper company, over the 2-second line C-2
// set. Run on the page's own thread, that is a frozen screen. So the runs
// happen here, in a worker, and the page is sent ONE message: the finished
// bridge, or the reason there is none. Never a part-way result — a bridge that
// is half computed does not add up (rule 17).

import { bridgeBetween } from './bridge';

self.onmessage = (event: MessageEvent) => {
  const { A, B, opts } = event.data || {};
  try {
    const result = bridgeBetween(A, B, opts || {});
    (self as any).postMessage({ ok: true, result });
  } catch (error: any) {
    (self as any).postMessage({ ok: false, error: error?.message || 'The bridge could not be computed.' });
  }
};
