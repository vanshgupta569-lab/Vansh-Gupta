// FILE: src/components/useSectionGlide.ts
//
// ONE GESTURE, ONE SECTION (Nihar, 16 November 2026, decision 1).
//
// The landing page used to morph its object continuously as you scrolled, so
// a shape existed only while you kept moving and was always some blend of two.
// Now a single scroll, swipe, arrow key or Page Down glides to the next
// section, and the object finishes forming there on its own.
//
// WHAT THIS DELIBERATELY DOES NOT DO:
//
//   - IT NEVER TRAPS THE READER. It only intervenes between the first and
//     last shape section. Above them and below them -- the coverage band, the
//     margin table, the notes, the footer -- the page scrolls exactly as it
//     always did, because a long section a reader needs to read is not
//     something to ration one gesture at a time.
//   - IT NEVER TOUCHES HISTORY. Back, forward and anchor links keep working:
//     nothing here calls pushState or preventDefault on a link. When the page
//     moves by some other means the index is read back from the page.
//   - IT STANDS ASIDE UNDER REDUCED MOTION, on a narrow screen, and whenever
//     a dialog is open, so the search palette and the menu sheet keep their
//     own keys.
//
// FAST TRACKPADS ARE THE HARD PART. A trackpad fires wheel events in a stream
// of dozens, so "one event, one section" would skip five sections on a flick.
// The lock below is held for the whole glide AND for a short settling time
// after it, and any wheel event arriving during the lock is swallowed rather
// than queued -- so a flick moves one section and the rest of the stream is
// spent against a closed door.
import { useEffect, useRef, useState } from 'react';

/** How long one move takes. The decision sets 800-1200ms. */
export const GLIDE_MS = 950;
/** Wheel deltas under this are a settling trackpad, not a gesture. */
const WHEEL_MIN = 12;
/** The door stays shut this long after a glide, to swallow the tail. */
const SETTLE_MS = 180;
/** A touch has to travel this far to count as a swipe. */
const SWIPE_PX = 48;

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export interface SectionGlide {
  /** The section the page is on, for the object to form. */
  index: number;
  /** True while a glide is running. */
  moving: boolean;
}

export function useSectionGlide(sectionIds: string[], enabled: boolean): SectionGlide {
  const [index, setIndex] = useState(0);
  const [moving, setMoving] = useState(false);
  /**
   * THE DOOR, AS A TIME RATHER THAN A FLAG.
   *
   * It used to be a boolean cleared by a `setTimeout` at the end of the
   * glide's animation frame loop. That loop is cancelled by the effect's own
   * cleanup -- `cancelAnimationFrame` -- and the cleanup did NOT clear the
   * flag, so an effect that re-ran or unmounted DURING a glide left the door
   * shut for good. From then on every arrow key and every wheel notch was
   * swallowed: `preventDefault` ran, nothing moved, and the browser's own
   * scroll was suppressed too, so the press did nothing at all.
   *
   * A timestamp cannot strand. It expires by itself whether or not any
   * clean-up runs, whether or not a frame is ever delivered, and whether or
   * not the tab was hidden for the duration.
   */
  const shutUntil = useRef(0);
  const shut = () => performance.now() < shutUntil.current;
  const indexRef = useRef(0);
  const frame = useRef(0);

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const tops = () =>
      sectionIds.map((id) => {
        const el = document.getElementById(id);
        return el ? Math.round(el.getBoundingClientRect().top + window.scrollY) : -1;
      });

    /** The section whose top is nearest the top of the window. */
    const nearest = () => {
      const t = tops();
      let best = 0;
      let gap = Infinity;
      for (let i = 0; i < t.length; i++) {
        if (t[i] < 0) continue;
        const d = Math.abs(t[i] - window.scrollY);
        if (d < gap) {
          gap = d;
          best = i;
        }
      }
      return best;
    };

    /** Is the reader inside the run of shape sections at all? */
    const inRun = () => {
      const t = tops();
      const first = t.find((v) => v >= 0);
      const last = [...t].reverse().find((v) => v >= 0);
      if (first === undefined || last === undefined) return false;
      const lastEl = document.getElementById(sectionIds[sectionIds.length - 1]);
      const end = lastEl ? lastEl.getBoundingClientRect().height + last : last;
      // A little tolerance at each end so the boundary is not a cliff edge.
      return window.scrollY >= first - 2 && window.scrollY < end - 2;
    };

    /** Anything that should keep its own keys and wheel. */
    const busy = () =>
      !!document.querySelector('[data-search-palette], [data-menu-sheet], [role="dialog"]');

    const glideTo = (next: number) => {
      const t = tops();
      if (next < 0 || next >= sectionIds.length || t[next] < 0) return false;
      const from = window.scrollY;
      const to = t[next];
      if (Math.abs(to - from) < 2) {
        setIndex(next);
        return false;
      }
      // SHUT FOR THE WHOLE MOVE AND A MOMENT AFTER, so the tail of a trackpad
      // flick is spent against a closed door rather than queued into another
      // move. Set once, in one place, and it expires on its own.
      shutUntil.current = performance.now() + GLIDE_MS + SETTLE_MS;
      setMoving(true);
      setIndex(next);
      const started = performance.now();
      cancelAnimationFrame(frame.current);
      const step = (now: number) => {
        const p = Math.min(1, (now - started) / GLIDE_MS);
        window.scrollTo(0, Math.round(from + (to - from) * easeInOutCubic(p)));
        if (p < 1) {
          frame.current = requestAnimationFrame(step);
          return;
        }
        setMoving(false);
      };
      frame.current = requestAnimationFrame(step);
      return true;
    };

    const move = (dir: 1 | -1) => glideTo(indexRef.current + dir);

    const onWheel = (e: WheelEvent) => {
      if (busy() || !inRun()) return;
      if (shut()) {
        e.preventDefault();
        return;
      }
      if (Math.abs(e.deltaY) < WHEEL_MIN) return;
      // Resync first: the reader may have arrived by anchor or by Find.
      indexRef.current = nearest();
      if (move(e.deltaY > 0 ? 1 : -1)) e.preventDefault();
    };

    const onKey = (e: KeyboardEvent) => {
      if (busy() || !inRun()) return;
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      const down = e.key === 'ArrowDown' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey);
      const up = e.key === 'ArrowUp' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey);
      if (!down && !up) return;
      /* AUTO-REPEAT IS NOT A SECOND PRESS. Holding the key down sends a
         stream of `keydown`s, and once the door opened mid-hold the next
         repeat moved another section -- so holding walked the reader through
         the page. One press, one section: a repeat is swallowed, and the
         default scroll with it. */
      if (e.repeat) {
        e.preventDefault();
        return;
      }
      if (shut()) {
        e.preventDefault();
        return;
      }
      indexRef.current = nearest();
      if (move(down ? 1 : -1)) e.preventDefault();
    };

    let startY = 0;
    const onTouchStart = (e: TouchEvent) => {
      startY = e.touches[0]?.clientY ?? 0;
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (busy() || !inRun() || shut()) return;
      const endY = e.changedTouches[0]?.clientY ?? startY;
      const travelled = startY - endY;
      if (Math.abs(travelled) < SWIPE_PX) return;
      indexRef.current = nearest();
      move(travelled > 0 ? 1 : -1);
    };

    /* WHEN THE PAGE MOVES BY SOME OTHER MEANS -- an anchor, the back button,
       Find in page, a scrollbar drag -- the index is read back rather than
       asserted, so the object follows the reader instead of fighting them. */
    const onScroll = () => {
      if (shut()) return;
      const n = nearest();
      if (n !== indexRef.current) {
        indexRef.current = n;
        setIndex(n);
      }
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame.current);
      // AND THE DOOR IS LEFT OPEN. Cancelling the frame loop without this is
      // what used to strand the lock and swallow every press afterwards.
      shutUntil.current = 0;
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('scroll', onScroll);
    };
  }, [enabled, sectionIds]);

  return { index, moving };
}

export default useSectionGlide;
