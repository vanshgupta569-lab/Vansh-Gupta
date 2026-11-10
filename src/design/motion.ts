// FILE: src/design/motion.ts
//
// WHETHER THINGS MAY MOVE. One answer, read by everything that moves.
//
// Two things can ask for less motion: the reader's operating system
// (`prefers-reduced-motion: reduce`) and the site's own setting, stored in this
// browser, which the phone menu's "Reduce motion" switch will write (build
// step 9, job 9.1). The stored setting wins when it is set; otherwise the
// operating system decides. `docs/VISUAL_SYSTEM.md` §7.
//
// THE ANSWER LIVES IN THREE PLACES, KEPT IN STEP BY THIS FILE:
//   - `<html data-motion="reduced|full">`, which the stylesheet reads, so CSS
//     transitions and animations follow the stored setting as well as the
//     operating system;
//   - `useReducedMotion()`, which a component reads, and which re-renders it
//     when either source changes — a CSS media query override does nothing
//     to motion driven from JavaScript, so JavaScript has to be told;
//   - the root `MotionConfig` in `App.tsx`, which hands the same answer to the
//     animation library, so every `motion.*` element skips its transform and
//     layout animations when motion is reduced.
//
// Both sources are LISTENED to, not read once: a reader who turns the
// operating-system setting on with the page open gets a still page at once.

import { useSyncExternalStore } from 'react';

export type MotionSetting = 'reduced' | 'full';

/** Where the site's own setting is kept, in this browser only. */
export const MOTION_STORAGE_KEY = 'marginalia:motion';
const QUERY = '(prefers-reduced-motion: reduce)';
const CHANGED = 'marginalia:motion-changed';

const query = (): MediaQueryList | null =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(QUERY) : null;

/** The site's own setting, or null when the reader has not chosen one. */
export function storedMotionSetting(): MotionSetting | null {
  try {
    const v = window.localStorage.getItem(MOTION_STORAGE_KEY);
    return v === 'reduced' || v === 'full' ? v : null;
  } catch {
    return null;
  }
}

/** True when motion should be reduced, from both sources. */
export function motionReduced(): boolean {
  const stored = storedMotionSetting();
  if (stored) return stored === 'reduced';
  return query()?.matches ?? false;
}

/** Record the reader's choice (`null` returns the decision to the system). */
export function setMotionSetting(next: MotionSetting | null): void {
  try {
    if (next) window.localStorage.setItem(MOTION_STORAGE_KEY, next);
    else window.localStorage.removeItem(MOTION_STORAGE_KEY);
  } catch {
    /* storage unavailable: the system setting still applies */
  }
  window.dispatchEvent(new Event(CHANGED));
}

/** Call `listener` whenever either source of the answer changes. */
export function subscribeMotion(listener: () => void): () => void {
  const mq = query();
  mq?.addEventListener('change', listener);
  window.addEventListener('storage', listener);
  window.addEventListener(CHANGED, listener);
  return () => {
    mq?.removeEventListener('change', listener);
    window.removeEventListener('storage', listener);
    window.removeEventListener(CHANGED, listener);
  };
}

const applyAttribute = () => {
  document.documentElement.dataset.motion = motionReduced() ? 'reduced' : 'full';
};

/**
 * Keep `<html data-motion>` in step with the answer. Called once, at startup;
 * returns the function that stops listening.
 */
export function installMotionAttribute(): () => void {
  if (typeof document === 'undefined') return () => {};
  applyAttribute();
  return subscribeMotion(applyAttribute);
}

/** The answer, for a component, re-rendering it when the answer changes. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeMotion, motionReduced, () => false);
}

export default { motionReduced, useReducedMotion, installMotionAttribute, setMotionSetting, subscribeMotion };
