// FILE: src/components/figuresHint.tsx
//
// Marginalia — the ⓘ, and the row menu behind it
//
// WHY THESE ARE THEIR OWN FILE
//
// The figures screen used to explain itself in prose: a sentence under every
// line saying where its default head came from, a paragraph on every head
// saying what the forecast does with it, three disclosures above the table and
// a notice about the captions. All of it true, and all of it on screen at once,
// which made a table of figures into a wall of grey text — and made the page
// four times longer than the figures in it.
//
// None of it is deleted. It moves behind a ⓘ beside the thing it is about.
//
// THE THREE WAYS IN, AND WHY ALL THREE ARE NEEDED
//
//   · HOVER, for a mouse. The obvious one, and on its own the useless one.
//   · FOCUS, for a keyboard. The ⓘ is a real <button> in the tab order with
//     `aria-describedby` pointing at the panel, so a screen reader announces
//     the explanation as the button's description rather than leaving a reader
//     to guess what an unlabelled icon does.
//   · TAP, for a phone, which has no hover at all. A tap toggles it, and a tap
//     anywhere else closes it. Without this the whole explanation layer is
//     simply absent on a phone, which is the failure mode of every tooltip
//     written for a desktop and tested on one.
//
// THE PANEL IS `position: fixed`, AND THAT IS NOT A STYLE CHOICE.
//
// The table scrolls sideways inside `overflow-x: auto`. A popover positioned
// inside that container is CLIPPED by it — the explanation renders, and the
// reader sees a sliver of it or nothing, depending how far along the row the ⓘ
// sits. Fixed positioning takes the panel out of the scrolling box altogether,
// so it is measured against the viewport and clipped by nothing. The position
// is computed when it opens, from the button's own rectangle.

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { DARK } from '../design/tokens';

const { ink: INK, read: READ, muted: MUTED, quiet: DIM, line: LINE, panel: PANEL, accent: RED } = DARK;

/** Where a panel should sit, in viewport coordinates. */
interface At {
  left: number;
  top: number;
}

/**
 * Put a panel under a trigger, kept inside the viewport.
 *
 * The width is fixed so the measure is predictable; the left edge is pulled
 * back where the trigger is near the right edge, and the panel flips above the
 * trigger where there is no room below. A panel that opens off-screen is a
 * panel that was never written.
 */
function place(rect: DOMRect, width: number, height: number): At {
  const margin = 12;
  let left = rect.left;
  if (left + width > window.innerWidth - margin) left = window.innerWidth - width - margin;
  if (left < margin) left = margin;
  let top = rect.bottom + 6;
  if (top + height > window.innerHeight - margin) {
    const above = rect.top - height - 6;
    if (above > margin) top = above;
    else top = Math.max(margin, window.innerHeight - height - margin);
  }
  return { left, top };
}

interface HintProps {
  /** What the ⓘ explains. Plain text or a small tree; never a paragraph wall. */
  children: React.ReactNode;
  /** Said to a screen reader in place of "information". */
  label: string;
  /** A quieter dot, for a line that only carries a short note. */
  tone?: 'normal' | 'quiet';
}

/**
 * The ⓘ. A real button, described by the panel it opens.
 */
export const Hint: React.FC<HintProps> = ({ children, label, tone = 'normal' }) => {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [at, setAt] = useState<At | null>(null);
  const button = useRef<HTMLButtonElement | null>(null);
  const id = useId();

  const show = useCallback(() => {
    const rect = button.current?.getBoundingClientRect();
    if (!rect) return;
    setAt(place(rect, 320, 180));
    setOpen(true);
  }, []);

  const hide = useCallback(() => {
    if (pinned) return;
    setOpen(false);
  }, [pinned]);

  // A TAP PINS IT, AND A TAP ELSEWHERE LETS IT GO. Without the second half a
  // phone reader opens an explanation and has no way to close it.
  useEffect(() => {
    if (!pinned) return;
    const away = (e: Event) => {
      if (button.current && e.target instanceof Node && button.current.contains(e.target)) return;
      setPinned(false);
      setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPinned(false);
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', key);
    };
  }, [pinned]);

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        data-hint
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={(e) => {
          e.stopPropagation();
          if (pinned) {
            setPinned(false);
            setOpen(false);
          } else {
            setPinned(true);
            show();
          }
        }}
        className="mg-hint"
      >
        {/* Drawn rather than loaded: an icon font for one glyph is a request
            per page load, and this one has to sit on the text baseline. */}
        <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" focusable="false">
          <circle cx="8" cy="8" r="6.6" fill="none" stroke="currentColor" strokeWidth="1.1" />
          <circle cx="8" cy="4.9" r="0.85" fill="currentColor" />
          <path d="M8 7.2v4.3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </button>
      {open && at && (
        <div
          id={id}
          role="tooltip"
          style={{
            position: 'fixed',
            left: at.left,
            top: at.top,
            width: 320,
            background: PANEL,
            border: `1px solid ${LINE}`,
            color: READ,
            zIndex: 60,
            padding: '10px 12px',
            fontSize: 13,
            lineHeight: 1.5,
          }}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={hide}
        >
          {children}
        </div>
      )}
    </>
  );
};

interface MenuItem {
  key: string;
  label: string;
  note?: string;
  onPick: () => void;
}

interface RowMenuProps {
  label: string;
  heading: string;
  items: MenuItem[];
}

/**
 * The ⋯ on a row: "Move to…", for anyone not using a mouse.
 *
 * The screen's own way of moving a line is to drag it, and a drag is a gesture
 * a keyboard cannot make. A control that only works with a pointer is a
 * judgement some readers cannot make at all, so every movable row carries this
 * as well — shown on hover or focus so it is not sixteen dots down a quiet
 * column, present in the tab order either way.
 */
export const RowMenu: React.FC<RowMenuProps> = ({ label, heading, items }) => {
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState<At | null>(null);
  const button = useRef<HTMLButtonElement | null>(null);
  const panel = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => {
      const t = e.target;
      if (!(t instanceof Node)) return;
      if (button.current?.contains(t) || panel.current?.contains(t)) return;
      setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', key);
    };
  }, [open]);

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="menu"
        data-row-menu
        onClick={(e) => {
          e.stopPropagation();
          const rect = button.current?.getBoundingClientRect();
          if (rect) setAt(place(rect, 260, Math.min(360, 48 + items.length * 44)));
          setOpen((v) => !v);
        }}
        className="mg-rowmenu"
      >
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
          <circle cx="3" cy="8" r="1.3" fill="currentColor" />
          <circle cx="8" cy="8" r="1.3" fill="currentColor" />
          <circle cx="13" cy="8" r="1.3" fill="currentColor" />
        </svg>
      </button>
      {open && at && (
        <div
          ref={panel}
          role="menu"
          style={{
            position: 'fixed',
            left: at.left,
            top: at.top,
            width: 260,
            background: PANEL,
            border: `1px solid ${LINE}`,
            zIndex: 70,
            maxHeight: 360,
            overflowY: 'auto',
          }}
        >
          <div style={{ padding: '8px 12px 6px', color: DIM, fontSize: 12, borderBottom: `1px solid ${LINE}` }}>
            {heading}
          </div>
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              onClick={() => {
                item.onPick();
                setOpen(false);
              }}
              className="mg-menuitem"
            >
              <span style={{ color: INK, fontSize: 13 }}>{item.label}</span>
              {item.note && (
                <span style={{ color: DIM, fontSize: 12, display: 'block', marginTop: 1 }}>{item.note}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </>
  );
};

/** The styles both controls need, mounted once by the screen that uses them. */
export const HINT_STYLES = `
  .mg-hint {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    margin-left: 5px;
    vertical-align: -2px;
    color: ${DIM};
    background: none;
    border: 0;
    padding: 0;
    cursor: help;
    flex: none;
  }
  .mg-hint:hover, .mg-hint:focus-visible { color: ${INK}; }
  .mg-rowmenu {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    color: ${MUTED};
    background: none;
    border: 0;
    padding: 0;
    cursor: pointer;
    opacity: 0;
    transition: opacity 120ms ease, color 120ms ease;
    flex: none;
  }
  /* SHOWN ON HOVER OR FOCUS, never hidden from the keyboard. Fading it with
     opacity rather than removing it with display is what keeps it in the tab
     order while it is invisible, so tabbing onto it reveals it instead of
     moving focus to something nobody can see. */
  tr:hover .mg-rowmenu,
  .mg-rowmenu:focus-visible { opacity: 1; }
  .mg-rowmenu:hover, .mg-rowmenu:focus-visible { color: ${INK}; }
  .mg-menuitem {
    display: block;
    width: 100%;
    text-align: left;
    padding: 8px 12px;
    background: none;
    border: 0;
    cursor: pointer;
  }
  .mg-menuitem:hover, .mg-menuitem:focus-visible { background: rgba(139,30,30,0.18); }
  .mg-grip {
    display: inline-flex;
    width: 12px;
    color: ${DIM};
    opacity: 0;
    cursor: grab;
    transition: opacity 120ms ease;
    flex: none;
  }
  tr:hover .mg-grip { opacity: 1; }
  .mg-grip:active { cursor: grabbing; }
`;

export default { Hint, RowMenu, HINT_STYLES };
