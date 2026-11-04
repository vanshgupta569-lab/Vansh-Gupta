// FILE: src/design/constrained.ts
//
// A CONSTRAINED DEVICE (`docs/VISUAL_SYSTEM.md` §8; `docs/VISUAL_BUILD_PLAN.md`
// job 8.11). On a phone-width screen or a low-end device the landing page
// drops what it can afford to drop: the WebGL particle field becomes the
// static poster, and the one count-up shows its final value at once.
//
// Low-end is any one of: 4 or fewer logical cores; 4GB or less of memory
// where the browser says (Chromium only); the reader's Data Saver; a 2g or 3g
// connection. A viewport under 640px wide is constrained whatever the device.
// VISUAL_SYSTEM's fifth signal, frames averaging over 24ms in the first
// second, is the particle field's own: it halves its points and then freezes
// on the poster when frames run over 20ms (job 8.7), which is stricter.
//
// The answer is a reason, not a boolean, so the page can say why it chose the
// poster (`data-hero-mode`) and the dashboard check can tell one path from
// another.

import { useSyncExternalStore } from 'react';

export const CONSTRAINED_WIDTH = 640;
export const LOW_END = { cores: 4, memoryGB: 4, slowConnections: ['slow-2g', '2g', '3g'] } as const;

export interface DeviceHints {
  width: number;
  cores?: number;
  memoryGB?: number;
  saveData?: boolean;
  effectiveType?: string;
}

/** Why this device gets the poster, or null when it may have the field. */
export function constrainedReason(h: DeviceHints): string | null {
  if (h.width > 0 && h.width < CONSTRAINED_WIDTH) return 'narrow';
  if (h.saveData) return 'save-data';
  if (h.effectiveType && (LOW_END.slowConnections as readonly string[]).includes(h.effectiveType)) return 'slow-connection';
  if (typeof h.cores === 'number' && h.cores > 0 && h.cores <= LOW_END.cores) return 'few-cores';
  if (typeof h.memoryGB === 'number' && h.memoryGB > 0 && h.memoryGB <= LOW_END.memoryGB) return 'low-memory';
  return null;
}

export function readDeviceHints(): DeviceHints {
  if (typeof window === 'undefined') return { width: 0 };
  const nav: any = navigator;
  const c = nav.connection;
  return {
    width: window.innerWidth,
    cores: nav.hardwareConcurrency,
    memoryGB: nav.deviceMemory,
    saveData: !!c?.saveData,
    effectiveType: c?.effectiveType,
  };
}

const read = () => constrainedReason(readDeviceHints());
function subscribe(onChange: () => void) {
  if (typeof window === 'undefined') return () => {};
  const c: any = (navigator as any).connection;
  window.addEventListener('resize', onChange);
  c?.addEventListener?.('change', onChange);
  return () => {
    window.removeEventListener('resize', onChange);
    c?.removeEventListener?.('change', onChange);
  };
}

/** The reason this device is constrained, kept current across resizes. */
export function useConstrained(): string | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

export default { constrainedReason, readDeviceHints, useConstrained, CONSTRAINED_WIDTH, LOW_END };
