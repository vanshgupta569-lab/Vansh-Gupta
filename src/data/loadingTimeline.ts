// FILE: src/data/loadingTimeline.ts
//
// WHEN THE LOADING SCREEN OPENS, SPEAKS AND CLOSES (`docs/NAV_SEARCH_SPEC.md`
// §5.2–5.3; build step 9, job 9.3). One pure function of when the build
// finished, so the timeline is checked with fake times in Node rather than
// only by watching a browser.
//
//   0–1,000ms       only the 2px page rule; a build done here never opens
//                   the modal.
//   1,000ms         the modal opens; the belief appears with it if its
//                   correction can follow (stage 2 or earlier — there is no
//                   server estimate, so the spec's fallback applies).
//   belief+2,200ms  the correction.
//   done            if the correction is not up yet it is shown at once; the
//                   modal then holds until the correction has been visible
//                   1,200ms and the modal up at least 500ms. Worst-case extra
//                   wait: 1,200ms.
//   15,000ms        "Taking longer than usual."
//   90,000ms        the build is given up as an error.

export const LOADING = Object.freeze({
  modalAfterMs: 1000,
  beliefAloneMs: 2200,
  correctionHoldMs: 1200,
  modalMinMs: 500,
  slowAfterMs: 15000,
  giveUpAfterMs: 90000,
  closeMs: 168,
  /** The stage the build must be at or before for the belief to be shown. */
  beliefLatestStage: 2,
});

export interface Timeline {
  /** When the modal opens, or null when the build finished first. */
  modalAt: number | null;
  beliefAt: number | null;
  correctionAt: number | null;
  /** When the screen gives way to the next one. */
  closeAt: number;
}

/** The whole timeline for a build that finished at `doneAt` ms. */
export function loadingTimeline(doneAt: number, stageAtOpen = 1): Timeline {
  const L = LOADING;
  if (doneAt < L.modalAfterMs) return { modalAt: null, beliefAt: null, correctionAt: null, closeAt: doneAt };
  const modalAt = L.modalAfterMs;
  const belief = stageAtOpen <= L.beliefLatestStage;
  if (!belief) return { modalAt, beliefAt: null, correctionAt: null, closeAt: Math.max(doneAt, modalAt + L.modalMinMs) };
  const beliefAt = modalAt;
  const scheduled = beliefAt + L.beliefAloneMs;
  const correctionAt = Math.min(scheduled, Math.max(doneAt, beliefAt));
  const closeAt = Math.max(doneAt, correctionAt + L.correctionHoldMs, modalAt + L.modalMinMs);
  return { modalAt, beliefAt, correctionAt, closeAt };
}

/** How long to hold the screen after the build finished, from its start. */
export const holdFor = (doneAt: number): number => Math.max(0, loadingTimeline(doneAt).closeAt - doneAt);

export default { LOADING, loadingTimeline, holdFor };
