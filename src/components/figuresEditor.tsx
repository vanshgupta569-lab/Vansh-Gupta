// FILE: src/components/figuresEditor.tsx
//
// Marginalia — the figures, under the heads the model forecasts them on
//
// This screen sits between the search and the questions, and it exists because
// the data is the weakest part of the site. It shows every line the source
// returned for this company, grouped under the head the engine assigns by
// default, with the reason for that default — and it lets the reader move a
// line to another head or correct any figure, in the same row, in one place.
//
// WHAT CHANGED, AND WHY IT IS ONE SCREEN NOW (`ROADMAP.md` §19b)
//
// It used to be two screens stacked: a correction table of filed fields, then a
// separate band asking whether each of four cost lines was direct, indirect,
// selling or administrative. Both were judgements about the same rows, in two
// places, in two vocabularies — and three of the five classification categories
// changed no number the model forecasts, because nothing downstream read them.
//
// So there is one table. Each row is a filed line; it sits under a model head;
// the head is what the forecast actually does with the money; and the figure in
// the row is editable. Correcting a figure and deciding which head it belongs
// under are the two judgements a reader makes about a line, and they are now
// made in the same row.
//
// THE FOUR STATES, KEPT VISIBLY APART
//
//   Reported      what the source filed. Plain type.
//   Corrected     what the reader supplied. Marked, with the filed figure still
//                 printed beside it in grey, and one click to put it back.
//   Reclassified  a line the reader moved to another head. Marked, with the
//                 default head still named beside it.
//   Modelled      anything the engine computes. Not on this screen at all.
//
// The site's whole promise rests on those never being confused, so a changed
// row never stands alone: the filed figure and the default head travel with it.
//
// WHAT THE SCREEN IS HONEST ABOUT
//
// These are the fields OUR SOURCE provides for this company, not yet the
// company's own line captions. Both sources return a normalised schema, so the
// set of lines differs company by company — which is real — while the captions
// are ours rather than the filing's. The screen says so in those words, rather
// than letting a reader assume they are reading the annual report's own
// wording. `DATA_CONSTRAINTS.md` records it, and the captions arrive with the
// primary-filings data layer.
//
// THE TWO CHECKS AT THE FOOT
//
// Both are subtractions the reader could do on the filing themselves, so
// neither is a judgement:
//
//   · Revenue less the cost lines, against reported operating profit. A large
//     gap means the source has not returned every operating cost. This is the
//     check that would have caught Reliance, where a narrow SG&A figure left
//     the model 91% above the reported operating profit.
//   · Total assets against liabilities plus equity. A gap means the balance
//     sheet came back incomplete.
//
// They are stated as differences and left there. What to do about one is the
// reader's call, which is the same rule the rest of the site follows.

import React, { useMemo, useState } from 'react';
import { ArrowRight, RotateCcw, Pencil, GripVertical } from 'lucide-react';
import {
  Corrections,
  CorrectionReasons,
  FIELDS,
  GROUPS,
  correctionCount,
  yearChecks,
} from '../data/corrections';
import { buildEbitdaBridge } from '../data/ebitdaBridge';
import {
  HEAD_BY_KEY,
  RECONCILING_LINE,
  dropTargets,
  groupByHead,
  headOf,
  isMoved,
  moveCount,
  reasonOf,
  type FiledLine,
  type HeadAssignment,
  type HeadKey,
  type Statement,
} from '../data/heads';
import { valueUnder } from '../data/autoCompany';
import { DARK } from '../design/tokens';
import { Disclose, EYEBROW, LABEL, UI, useBottomBarInset } from './instrument';
import { Mark } from '../design/Mark';

// Colours come from the one palette. They used to be local constants at the
// top of this file, and copies of the same values at the top of its neighbours.
const { accent: RED, accentText: RED_TEXT, ink: INK, read: READ, muted: MUTED, quiet: DIM, line: LINE, panel: PANEL } = DARK;

const DISPLAY: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 800,
  letterSpacing: '-0.045em',
  lineHeight: 0.98,
};

const Eyebrow: React.FC<{ children: React.ReactNode; centred?: boolean }> = ({
  children,
  centred,
}) => (
  <p
    className={`font-mono text-[12px] tracking-[0.22em] uppercase mb-6 flex items-center gap-3 ${
      centred ? 'justify-center' : ''
    }`}
    style={{ color: RED_TEXT }}
  >
    <span className="h-px w-8 shrink-0" style={{ background: RED }} />
    {children}
  </p>
);

/* Money is carried in millions everywhere in the engine; share counts are whole
   counts. Both are printed the way a person writes them, and an absent figure
   prints as an em dash rather than as a zero — the filing not saying something
   and the filing saying nothing are different facts. */
const show = (v: any, count?: boolean, locale = 'en-US'): string => {
  if (typeof v !== 'number' || !isFinite(v)) return '—';
  if (count) return Math.round(v).toLocaleString(locale);
  // A balance check that comes out at floating-point noise is zero. Printing
  // it as "-0.0" makes arithmetic that worked look like arithmetic that did
  // not.
  if (Math.abs(v) < 0.05) return '0';
  const abs = Math.abs(v);
  // Big figures read better whole; small ones lose their meaning rounded.
  const dp = abs >= 10000 ? 0 : abs >= 100 ? 1 : 2;
  return v.toLocaleString(locale, {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  });
};

interface Props {
  ticker: string;
  name: string;
  source: string;
  sourceUrl?: string | null;
  currencySymbol: string;
  /** ISO code from the filing, e.g. INR or USD. Decides the digit grouping. */
  currency?: string;
  /** The payload exactly as the fetcher returned it. Never mutated. */
  statements: any[];
  corrections: Corrections;
  onChange: (next: Corrections) => void;
  /** The head the reader has put each filed line under. */
  heads: HeadAssignment;
  onHeads: (next: HeadAssignment) => void;
  /** One line per corrected field, for the EBITDA bridge to carry. */
  correctionReasons: CorrectionReasons;
  onReason: (next: CorrectionReasons) => void;
  /**
   * The payload itself, so the model can be REBUILT here rather than described:
   * the judgement layer's rule is that a change rebuilds the model immediately
   * with the previous value still beside it, and on this screen there is no
   * model yet to rebuild unless this screen builds one.
   */
  payload?: any;
  onContinue: () => void;
  onBack: () => void;
  /** True when the reader came back here from a model that is already built. */
  returning?: boolean;
  building?: boolean;
}

export const FiguresEditor: React.FC<Props> = ({
  ticker,
  name,
  source,
  sourceUrl,
  currencySymbol,
  currency,
  statements,
  corrections,
  onChange,
  heads,
  onHeads,
  correctionReasons,
  onReason,
  payload,
  onContinue,
  onBack,
  returning,
  building,
}) => {
  /* Which statement's heads are on screen. ONE AT A TIME, and that is a design
     decision rather than a shortcut: there are ten income heads and eight
     balance-sheet ones, and a single column of eighteen head bands is the
     "never messy or cluttered" rule broken in the most ordinary way. A reader
     works down one statement at a time anyway. */
  const [statement, setStatement] = useState<Statement>('income');
  /* The remaining correctable groups — cash flow, share count — keep the
     accordion they had. They have no heads: nothing in them is a line of the
     forecast's cost structure, so grouping them under heads would invent a
     judgement nobody is being asked to make. */
  const [openGroup, setOpenGroup] = useState<string>('');
  /* Which cell the cursor is in. A figure is grouped and rounded while it is
     being read and shown raw the moment it is being edited: 988107.1270000001
     is the truth, but it is not a number anybody can read down a column, and
     rounding what somebody is halfway through typing is worse. */
  const [editing, setEditing] = useState<string>('');
  /** The line being dragged, and the head the cursor is over. */
  const [dragging, setDragging] = useState<string>('');
  const [over, setOver] = useState<string>('');

  /* Digit grouping belongs to the company, not to the reader. An Indian filing
     reads in lakh and crore; a dollar filing does not, and printing 3,91,035
     for a US figure is simply wrong. */
  const locale =
    currency === 'INR' || currencySymbol === '₹' ? 'en-IN' : 'en-US';
  const fmt = (v: any, count?: boolean) => show(v, count, locale);

  const years = useMemo(() => statements.map((s) => String(s.fiscalYear)), [statements]);
  const changed = correctionCount(corrections);
  const moved = moveCount(heads);

  /* The checks and the grouping run on what the model will actually be built
     from, so they respond as the reader types. */
  const patched = useMemo(
    () =>
      statements.map((row) => {
        const patch = corrections[String(row.fiscalYear)];
        return patch ? { ...row, ...patch } : row;
      }),
    [statements, corrections]
  );
  const checks = useMemo(() => yearChecks(patched), [patched]);
  const grouped = useMemo(() => groupByHead(patched, heads), [patched, heads]);

  const filed = (year: string, key: string) => {
    const row = statements.find((s) => String(s.fiscalYear) === year);
    return row ? row[key] : null;
  };

  const current = (year: string, key: string) => {
    const c = corrections[year];
    if (c && Object.prototype.hasOwnProperty.call(c, key)) return c[key];
    return filed(year, key);
  };

  const isChanged = (year: string, key: string) =>
    !!corrections[year] && Object.prototype.hasOwnProperty.call(corrections[year], key);

  const setCell = (year: string, key: string, raw: string) => {
    const next: Corrections = { ...corrections, [year]: { ...(corrections[year] || {}) } };
    const text = raw.trim().replace(/,/g, '');

    if (text === '') {
      // Emptying a cell puts the filed figure back rather than setting zero.
      delete next[year][key];
    } else {
      const n = Number(text);
      if (!isFinite(n)) return;
      const original = filed(year, key);
      if (typeof original === 'number' && Math.abs(original - n) < 1e-9) {
        delete next[year][key];
      } else {
        next[year][key] = n;
      }
    }
    if (Object.keys(next[year]).length === 0) delete next[year];
    onChange(next);
  };

  const revert = (year: string, key: string) => {
    const next: Corrections = { ...corrections, [year]: { ...(corrections[year] || {}) } };
    delete next[year][key];
    if (Object.keys(next[year]).length === 0) delete next[year];
    onChange(next);
  };

  const resetAll = () => onChange({});

  // ------------------------------------------------------------------------
  // THE JUDGEMENT: WHICH HEAD THIS LINE BELONGS UNDER
  // ------------------------------------------------------------------------
  const setHead = (field: string, head: HeadKey) => {
    const next: HeadAssignment = { ...heads };
    const existing = next[field];
    next[field] = { head, ...(existing?.reason ? { reason: existing.reason } : {}) };
    onHeads(next);
  };
  const setHeadReason = (field: string, reason: string) => {
    const next: HeadAssignment = { ...heads };
    const head = headOf(field, heads);
    if (!reason.trim() && !isMoved(field, heads)) delete next[field];
    else next[field] = { head, ...(reason.trim() ? { reason } : {}) };
    onHeads(next);
  };
  /** The visible return to the default, which is rule three. */
  const toDefault = (field: string) => {
    const next: HeadAssignment = { ...heads };
    delete next[field];
    onHeads(next);
  };
  const headsToDefaults = () => onHeads({});

  // THE MODEL IS REBUILT HERE, NOT DESCRIBED.
  //
  // Rule four of the judgement layer: a change rebuilds the model immediately
  // with the previous value still visible beside it. `valueNow` is the value on
  // the reader's judgements; `valueOnDefaults` is the engine's own, kept on
  // screen beside it for as long as anything is moved. Both run the whole
  // chain, because scaling one answer into the other would be our judgement
  // sitting on top of theirs.
  const valueNow = useMemo(
    () => (payload && moved ? valueUnder(payload, corrections, heads) : null),
    [payload, corrections, heads, moved]
  );
  const valueOnDefaults = useMemo(
    () => (payload && moved ? valueUnder(payload, corrections, {}) : null),
    [payload, corrections, moved]
  );

  // ------------------------------------------------------------------------
  // THE ADJUSTED EBITDA BRIDGE
  // ------------------------------------------------------------------------
  // Built from the SAME function the workbook reads (`buildEbitdaBridge`), on
  // the untouched filed statements plus the two judgements this screen makes.
  // A second derivation of the same bridge could disagree with the first and
  // nothing would catch it.
  const bridge = useMemo(
    () => buildEbitdaBridge(statements, corrections, heads, correctionReasons),
    [statements, corrections, heads, correctionReasons]
  );
  /** One reason per adjustment, whichever kind it is, typed in one place. */
  const setAdjustmentReason = (key: string, text: string) => {
    if (key.startsWith('oneOff:')) {
      setHeadReason(key.slice('oneOff:'.length), text);
      return;
    }
    const field = key.slice('correction:'.length);
    const next: CorrectionReasons = { ...correctionReasons };
    if (text.trim()) next[field] = text;
    else delete next[field];
    onReason(next);
  };

  // The standing bar is painted over this page, so the page is told how tall
  // it actually is rather than guessing. See useBottomBarInset.
  const bar = useBottomBarInset();

  const sheet = statement === 'income' ? grouped.income : grouped.balance;
  const targets = dropTargets(statement);

  /**
   * Drop a dragged line on a head. The only path a drag takes.
   *
   * THE FIELD COMES OUT OF THE `dataTransfer`, not out of React state. The
   * state is for the highlight; the payload is what the drag actually carries,
   * and reading the state here made the drop depend on a re-render having
   * happened between `dragstart` and `drop`. A browser gives you that most of
   * the time, which is the worst kind of bug — it worked by hand and failed
   * when the three events were dispatched in one go, which is exactly how
   * `verify:dashboard` drives it, because Playwright cannot drive HTML5
   * drag-and-drop with the mouse.
   */
  const drop = (head: HeadKey, carried: string) => {
    const field = carried || dragging;
    setDragging('');
    setOver('');
    if (!field) return;
    // Looked up across the whole statement rather than the bands in view, so a
    // line already moved is still found under the head it is sitting on.
    const spec = sheet.flatMap((h) => h.lines).find((l) => l.field === field);
    if (!spec || !spec.movable) return;
    if (!spec.movableTo.includes(head) && head !== spec.defaultHead) return;
    if (head === spec.defaultHead) toDefault(field);
    else setHead(field, head);
  };

  // ------------------------------------------------------------------------
  // ONE LINE OF THE TABLE
  // ------------------------------------------------------------------------
  const Line: React.FC<{ line: FiledLine }> = ({ line }) => {
    const movedHere = isMoved(line.field, heads);
    const spec = line;
    const options = spec.movable
      ? [HEAD_BY_KEY[spec.defaultHead], ...spec.movableTo.map((k) => HEAD_BY_KEY[k])]
      : [];
    return (
      <>
        <tr
          /* Named so a browser check can find one line's controls without
             matching a sentence that also appears in the bridge below. */
          data-line={line.field}
          data-head={headOf(line.field, heads)}
          draggable={spec.movable}
          onDragStart={(e) => {
            setDragging(line.field);
            e.dataTransfer.effectAllowed = 'move';
            // Some browsers will not start a drag without payload.
            e.dataTransfer.setData('text/plain', line.field);
          }}
          onDragEnd={() => {
            setDragging('');
            setOver('');
          }}
          className="border-t align-top"
          style={{
            borderColor: LINE,
            background: dragging === line.field ? 'rgba(139,30,30,0.10)' : 'transparent',
          }}
        >
          <td className="py-3 pr-5">
            <div className="flex items-start gap-2">
              {spec.movable ? (
                <GripVertical
                  className="w-3.5 h-3.5 mt-1 shrink-0 cursor-grab"
                  style={{ color: DIM }}
                  aria-hidden="true"
                />
              ) : (
                <span className="w-3.5 shrink-0" aria-hidden="true" />
              )}
              <div className="min-w-0">
                <div className="text-[15px]" style={{ color: INK }}>
                  {line.label}
                  {line.derived && (
                    <span className={`${LABEL} ml-2.5`} style={{ color: DIM }}>
                      computed
                    </span>
                  )}
                  {line.componentOf && (
                    <span className={`${LABEL} ml-2.5`} style={{ color: DIM }}>
                      inside {line.componentOf}
                    </span>
                  )}
                </div>
                {/* WHAT STAYS INLINE IS THE STATE, NOT THE ESSAY.
                    A line the reader has moved must be distinguishable at a
                    glance — that is the third of the four visible states — so
                    it says so here, in oxblood, with the head it left named.
                    Where every default's basis also sat inline the table came
                    out of the first screenshot three to six lines of grey prose
                    per row, with the figures a minority of the ink: correct,
                    and cluttered, which DESIGN.md's first principle rules out.
                    The bases now sit in one disclosure per head, which is where
                    a reader goes to ask "why is this here" and nowhere else. */}
                {movedHere && (
                  <div className="text-[13px] leading-[1.5] mt-1" style={{ color: RED_TEXT }}>
                    Yours. The default is {HEAD_BY_KEY[spec.defaultHead].label.toLowerCase()}.
                  </div>
                )}
              </div>
            </div>
          </td>

          {/* THE KEYBOARD ALTERNATIVE TO THE DRAG, and on a desktop the faster
              of the two. A drag that is the only way to make a judgement is a
              judgement a keyboard cannot make. */}
          <td className="py-3 pr-5 whitespace-nowrap">
            {spec.movable ? (
              <select
                aria-label={`Which head ${line.label} belongs under`}
                data-head-select={line.field}
                value={headOf(line.field, heads)}
                onChange={(e) => {
                  const head = e.target.value as HeadKey;
                  if (head === spec.defaultHead) toDefault(line.field);
                  else setHead(line.field, head);
                }}
                className="mg-select font-mono text-[12px] px-2 py-1.5 outline-none"
                style={movedHere ? { borderColor: RED, color: INK } : undefined}
              >
                {options.map((h) => (
                  <option key={h.key} value={h.key}>
                    {h.label}
                    {h.key === spec.defaultHead ? ' · default' : ''}
                  </option>
                ))}
              </select>
            ) : (
              <span className={LABEL} style={{ color: DIM }}>
                fixed
              </span>
            )}
          </td>

          {years.map((y) => {
            const dirty = isChanged(y, line.field);
            // THE RECONCILING LINE HAS NO CELL TO TYPE IN. It is a residual:
            // filed operating profit less the named lines. Offering an input
            // would invite a reader to set a figure the next keystroke on
            // another row recomputes.
            if (line.derived) {
              const i = years.indexOf(y);
              return (
                <td key={y} className="py-3 pl-5 text-right font-mono text-[14px]" style={{ color: READ }}>
                  {fmt(line.amounts[i])}
                </td>
              );
            }
            const value = current(y, line.field);
            const original = filed(y, line.field);
            return (
              <td key={y} className="py-3 pl-5 text-right">
                <input
                  inputMode="decimal"
                  title={`${line.label}, FY${y} — click and type to change it`}
                  value={
                    typeof value !== 'number' || !isFinite(value)
                      ? ''
                      : editing === `${y}:${line.field}`
                      ? String(value)
                      : fmt(value)
                  }
                  placeholder="—"
                  onFocus={(e) => {
                    setEditing(`${y}:${line.field}`);
                    e.currentTarget.select();
                  }}
                  onBlur={() => setEditing('')}
                  onChange={(e) => setCell(y, line.field, e.target.value)}
                  className={`mg-cell w-full font-mono text-[14px] text-right px-2 py-1.5 outline-none transition-colors ${
                    dirty ? 'mg-dirty' : ''
                  }`}
                />
                {dirty && (
                  <div className="flex items-center justify-end gap-2 mt-1.5">
                    <span className="font-mono text-[11px]" style={{ color: DIM }}>
                      filed {fmt(original)}
                    </span>
                    <button
                      type="button"
                      onClick={() => revert(y, line.field)}
                      title="Put the filed figure back"
                      className="shrink-0"
                    >
                      <RotateCcw className="w-3 h-3" style={{ color: RED_TEXT }} />
                    </button>
                  </div>
                )}
              </td>
            );
          })}
        </tr>

        {/* EVERY OVERRIDE TAKES AN OPTIONAL ONE-LINE REASON, which is rule two,
            and a visible way back, which is rule three. Optional on purpose: a
            reason nobody can skip is a reason nobody reads. */}
        {movedHere && (
          <tr style={{ background: 'rgba(139,30,30,0.06)' }}>
            <td colSpan={2 + years.length} className="px-5 pb-3.5">
              <div className="flex flex-wrap items-center gap-3">
                <label
                  className={`${LABEL} shrink-0`}
                  htmlFor={`why-${line.field}`}
                  style={{ color: DIM }}
                >
                  Why
                </label>
                <input
                  id={`why-${line.field}`}
                  value={reasonOf(line.field, heads)}
                  onChange={(e) => setHeadReason(line.field, e.target.value)}
                  placeholder="One line, optional — it travels with the workbook"
                  maxLength={200}
                  className="mg-cell flex-1 min-w-[18rem] font-sans text-[14px] px-2.5 py-2 outline-none transition-colors"
                />
                <button
                  type="button"
                  onClick={() => toDefault(line.field)}
                  title={`Put ${line.label} back on the engine's default head`}
                  className={`${LABEL} flex items-center gap-2 cursor-pointer shrink-0`}
                  style={{ color: RED_TEXT }}
                >
                  <RotateCcw className="w-3 h-3" />
                  Back to the default
                </button>
              </div>
            </td>
          </tr>
        )}
      </>
    );
  };

  return (
    <div className="min-h-screen" style={{ background: '#0B0B0D' }}>
      {/* A FIELD HAS TO LOOK LIKE A FIELD.
          The first version drew every cell with a transparent border on a
          transparent ground, which is honest to the page and useless to the
          reader: a text input that looks exactly like printed text tells
          nobody they may type in it. Every figure now sits on a hairline, the
          way an entry line does on a paper form, lifts under the cursor, and
          turns oxblood while it is being edited. Written as real CSS because
          an inline style cannot carry a hover or a focus state. */}
      <style>{`
        .mg-cell {
          background: transparent;
          border: 1px solid transparent;
          border-bottom-color: #38352E;
          color: #C6C1B7;
          cursor: text;
        }
        .mg-cell::placeholder { color: #4A4740; }
        .mg-cell:hover {
          background: #17171B;
          border-bottom-color: #7A756A;
          color: #F2F0EA;
        }
        .mg-cell:focus {
          background: #131316;
          border-color: #8B1E1E;
          color: #F2F0EA;
        }
        .mg-cell.mg-dirty {
          background: rgba(139,30,30,0.13);
          border-color: #8B1E1E;
          color: #F2F0EA;
        }
        /* The head control. Square, hairline, mono — a field, like the figure
           cells, because it carries the same kind of judgement. The native
           menu is kept: it is the one control that already works with a
           keyboard, a screen reader and a thumb. */
        .mg-select {
          background: #0B0B0D;
          border: 1px solid #262521;
          color: #A8A29A;
          border-radius: 0;
          appearance: none;
          padding-right: 1.75rem;
          background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2385816F' stroke-width='1.4' fill='none'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 0.5rem center;
          cursor: pointer;
          max-width: 100%;
        }
        .mg-select:hover { border-color: #7A756A; color: #F2F0EA; }
        .mg-select:focus { border-color: #8B1E1E; color: #F2F0EA; }
      `}</style>
      <div className="max-w-[1380px] mx-auto px-6 sm:px-10 lg:px-16 pt-20 lg:pt-24 pb-16">
        {/* ==================================================================
            WHAT THIS SCREEN IS, IN THE SPACE IT DESERVES.

            The figures are the screen. A reader who came here to check what
            the source returned should not scroll past an essay to reach them,
            so the headline is left-aligned at the Screen Title step, one line
            says what to do, and the explanations are disclosures above the
            table rather than a wall in front of it.
            ================================================================== */}
        <Eyebrow>Before the model is built</Eyebrow>
        <h1
          /* The Screen Title step (DESIGN.md): one clamp, not three
             breakpoint literals, for the same reason the hero figure is one. */
          className="text-[clamp(27px,3.2vw,40px)] max-w-[24ch]"
          style={{ ...DISPLAY, color: INK }}
        >
          Read the figures before the model does
          <Mark />
        </h1>
        <p className="text-[16px] leading-[1.6] mt-4 max-w-[70ch]" style={{ color: READ }}>
          Every line {name} was returned with, from {source}, under the head the model forecasts it
          on. Change a figure the annual report contradicts, move a line to the head you think it
          belongs under, or leave all of it alone and carry on.
          {returning && (
            <>
              {' '}
              Anything you changed before is still marked, with the filed figure and the default head
              beside it.
            </>
          )}
        </p>

        {/* A closing rule under the last one: Disclose draws its own rule
            ABOVE each row, so a stack of them ends on open air and reads as
            though a third row failed to render. */}
        <div className="mt-6 max-w-[70ch] border-b" style={{ borderColor: LINE }}>
          <Disclose
            summary="What the four states mean"
            trailing="reported · corrected · reclassified · modelled"
          >
            <dl className="space-y-3">
              {[
                ['Reported', 'What the source filed, under the head the engine assigns. Left alone unless you change it.'],
                ['Corrected', 'A figure you supplied. Marked, with the filed one still shown beside it.'],
                ['Reclassified', 'A line you moved to another head. Marked, with the default head still named.'],
                ['Modelled', 'Anything the engine works out. None of it is on this screen.'],
              ].map(([term, line]) => (
                <div key={term} className="flex flex-wrap gap-x-3">
                  <dt className={`${EYEBROW} shrink-0 pt-0.5`} style={{ color: RED_TEXT, minWidth: '7.5rem' }}>
                    {term}
                  </dt>
                  <dd className="flex-1 min-w-[16rem]" style={{ color: READ }}>
                    {line}
                  </dd>
                </div>
              ))}
            </dl>
          </Disclose>

          <Disclose summary="Which moves change the value, and which only change the composition" trailing="measured">
            <p className="max-w-prose">
              Reported operating profit is tied to the filed figure: the engine carries the
              difference between it and the named cost lines on its own reconciling line. So money
              taken out of one operating cost reappears there, and{' '}
              <span style={{ color: INK }}>
                moving a line between research, selling and administrative, and other operating costs
                changes what each line is called and not what the company earns
              </span>
              . On Reliance, SG&amp;A moved to research and development leaves value per share at the
              same 706.52.
            </p>
            <p className="max-w-prose mt-2">
              <span style={{ color: INK }}>Four moves do change the value</span>, and they are the
              ones that cross from one forecast rule to another. One-offs: nil in every forecast
              year, so Reliance&rsquo;s other operating costs set aside takes 706.52 to 1,683.09, and
              its SG&amp;A to 1,044.32. Depreciation: charged from the plant roll-forward and added
              back in cash flow, so Apple&rsquo;s SG&amp;A moved there takes 154.72 to 183.39. Cost of
              sales: the gross margin is read off it. And on the balance sheet, anything crossing into
              or out of cash or fixed assets — Apple&rsquo;s short-term investments moved to other
              assets takes 154.72 to 152.86, because net debt stops reading them.
            </p>
            <p className="max-w-prose mt-2">
              Reported years never move. Reported operating profit ties to the filing whatever you
              choose, and the tie is the last row of the table.
            </p>
          </Disclose>

          <Disclose summary="What happens to a change">
            <p className="max-w-prose">
              Nothing is uploaded, nothing is stored and nothing leaves this browser tab. A change is
              remembered for as long as the tab is open, and the filed figure is kept beside it the
              whole time.
            </p>
            {sourceUrl ? (
              <p className="mt-2">
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4"
                  style={{ color: RED_TEXT }}
                >
                  Open the filings
                </a>
              </p>
            ) : null}
          </Disclose>
        </div>

        {/* ---------------------------------------------------------- */}
        {/* The statements, under their heads                          */}
        {/* ---------------------------------------------------------- */}
        <div className="mt-10 lg:mt-12">
          <div className="flex items-baseline justify-between gap-6 flex-wrap mb-4">
            <h2 className="text-[24px]" style={{ ...DISPLAY, color: INK }}>
              {ticker} as filed
              <Mark />
            </h2>
            <div className="font-sans text-[13px] leading-snug text-right" style={{ color: MUTED }}>
              Figures in millions of {currencySymbol} unless the row says otherwise
            </div>
          </div>

          {/* WHAT A READER MUST NOT ASSUME, SAID PLAINLY AND NOT FOLDED AWAY.
              The line captions are ours, not the filing's. The set of lines
              genuinely differs company by company — it is what this source
              returned for this one — but a reader who took these for the
              annual report's own wording would be wrong, and would have no way
              to find that out. DATA_CONSTRAINTS.md carries the same words. */}
          <div
            className="border-t border-b py-3 mb-6 max-w-[88ch]"
            style={{ borderColor: LINE }}
          >
            <p className={UI} style={{ color: READ }}>
              <span style={{ color: INK, fontWeight: 600 }}>
                These are the fields our source provides for {ticker}, not yet its own line captions.
              </span>{' '}
              Which lines appear is real and differs company by company — this is what the source
              returned for {ticker} — but the wording of each is ours. The company&rsquo;s own
              captions arrive with the primary-filings data layer.
            </p>
          </div>

          <div
            className="flex items-center gap-2.5 border-t border-b py-2.5 mb-6"
            style={{ borderColor: LINE }}
          >
            <Pencil className="w-3.5 h-3.5 shrink-0" style={{ color: RED_TEXT }} />
            <p className={UI} style={{ color: READ }}>
              <span style={{ color: INK, fontWeight: 600 }}>
                Every figure can be changed and every line can be moved.
              </span>{' '}
              Click a figure and type over it; an empty box puts the original back. Drag a row onto
              another head, or use the menu beside it.
            </p>
          </div>

          {/* The two statements. A tab, not an accordion: a reader is in one
              statement at a time and both being open at once is the clutter
              the first design principle rules out. */}
          <div className="flex items-center gap-px mb-2" role="tablist" aria-label="Statement">
            {(
              [
                ['income', 'Profit and loss'],
                ['balance', 'Balance sheet'],
              ] as [Statement, string][]
            ).map(([key, label]) => {
              const on = statement === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setStatement(key)}
                  className={`${LABEL} px-4 py-2.5 border transition-colors cursor-pointer`}
                  style={
                    on
                      ? { borderColor: RED, background: 'rgba(139,30,30,0.22)', color: INK }
                      : { borderColor: LINE, background: 'transparent', color: MUTED }
                  }
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ minWidth: 860 }}>
              <thead>
                <tr>
                  <th
                    className="text-left font-mono text-[11px] uppercase tracking-[0.18em] pb-3 pr-5 align-bottom"
                    style={{ color: DIM, minWidth: 300 }}
                  >
                    Line
                  </th>
                  <th
                    className="text-left font-mono text-[11px] uppercase tracking-[0.18em] pb-3 pr-5 align-bottom"
                    style={{ color: DIM, minWidth: 230 }}
                  >
                    Head
                  </th>
                  {years.map((y) => (
                    <th
                      key={y}
                      className="text-right font-mono text-[12px] pb-3 pl-5 align-bottom"
                      style={{ color: INK, minWidth: 120 }}
                    >
                      FY{y}
                    </th>
                  ))}
                </tr>
              </thead>
              {sheet.map((group) => {
                const head = group.head;
                // A head with no lines and nothing that can be dropped on it is
                // not shown: an empty band for a head this company has nothing
                // under is furniture, not information.
                if (!group.lines.length && !head.dropTarget) return null;
                const active = dragging && head.dropTarget;
                const hot = active && over === head.key;
                // The lines that actually add up under this head. A component
                // sits inside its parent and an anchor is what the model ties
                // itself to, so neither is part of the sum.
                const contributing = group.lines.filter((l) => !l.componentOf);
                const sums = contributing.length > 1;
                // The lines under the head that owe an account of themselves.
                // The anchors are not here: they are drawn in their own band
                // at the foot of the statement, with their own disclosure.
                const explain = group.lines;
                return (
                  <tbody
                    key={head.key}
                    data-head-band={head.key}
                    onDragOver={(e) => {
                      if (!head.dropTarget) return;
                      e.preventDefault();
                      setOver(head.key);
                    }}
                    onDragLeave={() => setOver((k) => (k === head.key ? '' : k))}
                    onDrop={(e) => {
                      if (!head.dropTarget) return;
                      e.preventDefault();
                      drop(head.key, e.dataTransfer.getData('text/plain'));
                    }}
                  >
                    {/* THE HEAD BAND. A rule and space, not a box (DESIGN.md):
                        the head name, what the forecast does with it, and its
                        total per year. Oxblood while a line is over it, which
                        is the only thing on this screen that needs to say
                        "drop here". */}
                    <tr
                      style={{
                        background: hot
                          ? 'rgba(139,30,30,0.22)'
                          : active
                          ? 'rgba(139,30,30,0.07)'
                          : 'transparent',
                      }}
                    >
                      <td colSpan={2} className="pt-7 pb-2.5 pr-5 border-t" style={{ borderColor: active ? RED : LINE }}>
                        <div className="text-[20px]" style={{ ...DISPLAY, color: INK, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                          {head.label}
                        </div>
                        {/* THE PROSE IS CAPPED TO THE TWO LEFT COLUMNS, in
                            pixels rather than characters, and that is a phone
                            fix rather than a taste one. The table scrolls
                            horizontally below about 860px, and a band sentence
                            measured in `ch` ran wider than the columns it sits
                            in — so on a 390px screen it was cut off mid-word
                            with nothing to say it continued, and the rest of it
                            was only reachable by scrolling a table sideways to
                            read a sentence. */}
                        <div
                          className="text-[13px] leading-[1.5] mt-1.5"
                          style={{ color: MUTED, maxWidth: 'min(500px, calc(100vw - 80px))' }}
                        >
                          {head.forecast}
                          {/* A HEAD THE ENGINE CANNOT HONOUR SAYS SO, rather
                              than offering a control that moves a line and
                              changes no number. The MARKER is the fact and
                              stays visible; the reason is four lines of prose
                              and goes in the disclosure below with the rest. */}
                          {!head.dropTarget && (
                            <span
                              className={`${LABEL} ml-2.5 inline-block whitespace-nowrap`}
                              style={{ color: RED_TEXT }}
                            >
                              Not a drop target
                            </span>
                          )}
                        </div>
                      </td>
                      {years.map((y, i) => (
                        <td
                          key={y}
                          data-head-total={`${head.key}:${y}`}
                          className="pt-7 pb-2.5 pl-5 text-right font-mono text-[14px] border-t align-bottom"
                          style={{ borderColor: active ? RED : LINE, color: group.totals[i] === null ? DIM : INK }}
                        >
                          {/* A TOTAL OF ONE LINE IS NOT A TOTAL. Where a head
                              carries a single contributing line, the row
                              beneath prints the same figure, and two identical
                              numbers in consecutive rows read as a mistake
                              rather than as a sum. */}
                          {sums ? (group.totals[i] === null ? '—' : fmt(group.totals[i])) : ''}
                        </td>
                      ))}
                    </tr>

                    {/* WHERE EVERY DEFAULT UNDER THIS HEAD CAME FROM.
                        One disclosure per head rather than a sentence per row:
                        the rule is that every default states its basis, not
                        that every basis is read every time. This is the
                        "number first, explanation on demand" pattern applied
                        to the thing being explained — and it is grouped under
                        the head, which is the question a reader is actually
                        asking when they open it. */}
                    {(explain.length > 0 || !head.dropTarget) && (
                      <tr>
                        <td colSpan={2 + years.length} className="pb-1">
                          <div style={{ maxWidth: 'min(520px, calc(100vw - 80px))' }}>
                            <Disclose
                              summary={
                                head.dropTarget
                                  ? 'Where these defaults came from'
                                  : 'Where these defaults came from, and why nothing can be moved here'
                              }
                            >
                              {!head.dropTarget && (
                                <p className="max-w-prose mb-3" style={{ color: READ }}>
                                  <span className={LABEL} style={{ color: RED_TEXT }}>
                                    Not a drop target.
                                  </span>{' '}
                                  {head.notYetBecause}
                                </p>
                              )}
                              <dl className="space-y-3">
                                {explain.map((l) => (
                                  <div key={l.field} className="flex flex-wrap gap-x-3">
                                    <dt
                                      className="shrink-0 pt-0.5 text-[13px]"
                                      style={{ color: INK, minWidth: '13rem' }}
                                    >
                                      {l.label}
                                    </dt>
                                    <dd className="flex-1 min-w-[18rem]" style={{ color: READ }}>
                                      {l.basis}
                                      {!l.movable && l.fixedBecause ? ` ${l.fixedBecause}` : ''}
                                    </dd>
                                  </div>
                                ))}
                              </dl>
                            </Disclose>
                          </div>
                        </td>
                      </tr>
                    )}
                    {group.lines.length === 0 ? (
                      <tr className="border-t" style={{ borderColor: LINE }}>
                        <td
                          colSpan={2 + years.length}
                          className="py-3 pr-5 text-[13px] leading-[1.5]"
                          style={{ color: DIM }}
                        >
                          Nothing under this head. {ticker} filed no line the engine puts here, and
                          nothing has been moved here.
                        </td>
                      </tr>
                    ) : (
                      group.lines.map((line) => <Line key={line.field} line={line} />)
                    )}
                  </tbody>
                );
              })}

              {/* ==========================================================
                  THE FILED ANCHORS AND SUBTOTALS.

                  Shown, and never under a head. These are the figures the
                  model ties ITSELF to — operating profit, pretax profit, net
                  income, the balance-sheet totals — so they are not part of
                  any head's sum and putting them in one was a double count
                  that broke the tie row by 2,627,630 on Reliance.

                  They are still EDITABLE, and that matters more than it looks:
                  the engine plugs other current assets from total current
                  assets and other liabilities from total liabilities, so a
                  reader correcting one of these changes where every unnamed
                  balance lands.
                  ========================================================== */}
              {(() => {
                const anchors = grouped.anchors.filter((a) => a.statement === statement);
                if (!anchors.length) return null;
                return (
                  <tbody>
                    <tr>
                      <td colSpan={2} className="pt-9 pb-2.5 pr-5 border-t" style={{ borderColor: LINE }}>
                        <div
                          className="text-[20px]"
                          style={{ ...DISPLAY, color: INK, letterSpacing: '-0.02em', lineHeight: 1.2 }}
                        >
                          As filed, and never moved
                        </div>
                        <div
                          className="text-[13px] leading-[1.5] mt-1.5"
                          style={{ color: MUTED, maxWidth: 'min(500px, calc(100vw - 80px))' }}
                        >
                          The figures the model ties itself to. They sit under no head, and the reported column
                          is these figures whatever you move.
                        </div>
                      </td>
                      {years.map((y) => (
                        <td key={y} className="pt-9 pb-2.5 pl-5 border-t" style={{ borderColor: LINE }} />
                      ))}
                    </tr>
                    <tr>
                      <td colSpan={2 + years.length} className="pb-1">
                        <div style={{ maxWidth: 'min(520px, calc(100vw - 80px))' }}>
                          <Disclose summary="What each of these anchors does">
                            <dl className="space-y-3">
                              {anchors.map((a) => (
                                <div key={a.field} className="flex flex-wrap gap-x-3">
                                  <dt className="shrink-0 pt-0.5 text-[13px]" style={{ color: INK, minWidth: '13rem' }}>
                                    {a.label}
                                  </dt>
                                  <dd className="flex-1 min-w-[18rem]" style={{ color: READ }}>
                                    {a.basis} {a.fixedBecause}
                                  </dd>
                                </div>
                              ))}
                            </dl>
                          </Disclose>
                        </div>
                      </td>
                    </tr>
                    {anchors.map((a) => (
                      <Line key={a.field} line={a} />
                    ))}
                  </tbody>
                );
              })()}

              {/* ---- the tie, and the forecast base ---- */}
              {statement === 'income' && (
                <tbody>
                  <tr>
                    <td colSpan={2} className="pt-9 pb-3 pr-5 border-t" style={{ borderColor: LINE }}>
                      <div className="text-[15px]" style={{ color: INK }}>
                        Operating profit, as filed
                      </div>
                      <div className="text-[13px] leading-[1.5] mt-1 max-w-[62ch]" style={{ color: DIM }}>
                        The filed figure. It does not move, whatever you put where.
                      </div>
                    </td>
                    {grouped.operatingProfitFiled.map((v, i) => (
                      <td
                        key={i}
                        className="pt-9 pb-3 pl-5 text-right font-mono text-[15px] border-t"
                        style={{ borderColor: LINE, color: INK }}
                      >
                        {fmt(v)}
                      </td>
                    ))}
                  </tr>
                  {grouped.operatingProfitUnderlying.some(
                    (v, i) => v !== null && grouped.operatingProfitFiled[i] !== null && Math.abs(v - (grouped.operatingProfitFiled[i] as number)) > 0.05
                  ) && (
                    <tr className="border-t" style={{ borderColor: LINE }}>
                      <td colSpan={2} className="py-3 pr-5">
                        <div className="text-[15px]" style={{ color: RED_TEXT }}>
                          Operating profit, with the one-offs set aside
                        </div>
                        <div className="text-[13px] leading-[1.5] mt-1 max-w-[62ch]" style={{ color: DIM }}>
                          Shown beside the filed figure, never instead of it. This is the one the
                          forecast is built from.
                        </div>
                      </td>
                      {grouped.operatingProfitUnderlying.map((v, i) => (
                        <td key={i} className="py-3 pl-5 text-right font-mono text-[14px]" style={{ color: RED_TEXT }}>
                          {fmt(v)}
                        </td>
                      ))}
                    </tr>
                  )}
                  <tr className="border-t border-b" style={{ borderColor: LINE }}>
                    <td colSpan={2} className="py-3 pr-5">
                      <div className="text-[15px]" style={{ color: INK }}>
                        Filed operating profit, less revenue and every head above
                      </div>
                      <div className="text-[13px] leading-[1.5] mt-1 max-w-[62ch]" style={{ color: DIM }}>
                        Nil wherever you put a line. Anything else would mean one had been counted
                        twice or dropped.
                      </div>
                    </td>
                    {grouped.tie.map((v, i) => (
                      <td
                        key={i}
                        data-head-tie={years[i]}
                        className="py-3 pl-5 text-right font-mono text-[14px]"
                        style={{ color: v === null || Math.abs(v) < 0.05 ? READ : RED_TEXT }}
                      >
                        {fmt(v)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              )}
            </table>
          </div>

          {/* ---- the model, rebuilt on these judgements ---- */}
          {moved > 0 && valueNow && (
            <div className="mt-8 border-t pt-6" style={{ borderColor: LINE }}>
              <div className={EYEBROW} style={{ color: RED_TEXT }}>
                Rebuilt on your judgements
              </div>
              {valueNow.refusal ? (
                <p className="text-[15px] leading-[1.6] mt-2 max-w-[70ch]" style={{ color: READ }}>
                  On these judgements the engine refuses a value: {valueNow.refusal}
                </p>
              ) : (
                <div className="mt-3 flex flex-wrap gap-x-12 gap-y-4">
                  {(
                    [
                      ['Perpetuity', valueNow.perpetuity, valueOnDefaults?.perpetuity],
                      ['Exit multiple', valueNow.exitMultiple, valueOnDefaults?.exitMultiple],
                    ] as [string, number | null, number | null | undefined][]
                  ).map(([label, now, before]) => (
                    <div key={label}>
                      <div className={LABEL} style={{ color: DIM }}>
                        {label}, value per share
                      </div>
                      <div className="font-mono text-[20px] mt-1" style={{ color: INK }}>
                        {currencySymbol}
                        {fmt(now)}
                      </div>
                      {/* THE PREVIOUS VALUE STAYS ON SCREEN, which is rule four. */}
                      <div className="font-mono text-[12px] mt-1" style={{ color: MUTED }}>
                        {typeof before === 'number'
                          ? `on the engine's defaults ${currencySymbol}${fmt(before)}`
                          : 'the engine refuses a value on its own defaults'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[13px] leading-[1.55] mt-4 max-w-[70ch]" style={{ color: DIM }}>
                Built by running the whole chain again — derivation, model, discounted cash flow — on
                the judgements above, not by scaling the old answer.
              </p>
            </div>
          )}
        </div>

        {/* ---------------------------------------------------------- */}
        {/* The lines that have no head                                */}
        {/* ---------------------------------------------------------- */}
        <div className="mt-16 lg:mt-20">
          <Eyebrow>And the rest of what was returned</Eyebrow>
          <h2 className="text-[clamp(22px,2.4vw,30px)] max-w-[28ch]" style={{ ...DISPLAY, color: INK }}>
            Cash flow and the share count
            <Mark />
          </h2>
          <p className="text-[16px] leading-[1.6] mt-4 max-w-[70ch]" style={{ color: READ }}>
            These carry no head, because none of them is a line of the cost structure the forecast
            reads a margin off. They are no less important — the share count is the divisor under
            every per-share figure on the site — so every one of them can be corrected.
          </p>

          <div className="mt-8">
            {GROUPS.filter((g) => g.key === 'cash' || g.key === 'shares').map((group) => {
              const open = openGroup === group.key;
              const rows = FIELDS.filter((f) => f.group === group.key);
              const groupChanged = rows.reduce(
                (n, f) => n + years.filter((y) => isChanged(y, f.key)).length,
                0
              );

              return (
                <div key={group.key} className="border-t" style={{ borderColor: LINE }}>
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpenGroup(open ? '' : group.key)}
                    className="w-full text-left py-6 flex items-baseline justify-between gap-6"
                  >
                    <span className="flex items-baseline gap-5 min-w-0">
                      <span className="text-[19px] lg:text-[22px]" style={{ ...DISPLAY, color: INK }}>
                        {group.title}
                      </span>
                      <span className="text-[15px] hidden sm:inline" style={{ color: MUTED }}>
                        {group.standfirst}
                      </span>
                    </span>
                    <span className={`${LABEL} shrink-0`} style={{ color: groupChanged ? RED_TEXT : DIM }}>
                      {groupChanged ? `${groupChanged} corrected` : open ? 'Hide' : 'Show'}
                    </span>
                  </button>

                  {open && (
                    <div className="overflow-x-auto pb-8">
                      <table className="w-full border-collapse" style={{ minWidth: 640 }}>
                        <thead>
                          <tr>
                            <th
                              className="text-left font-mono text-[11px] uppercase tracking-[0.18em] pb-3 pr-6 align-bottom"
                              style={{ color: DIM, minWidth: 240 }}
                            >
                              Line &mdash; click a figure to change it
                            </th>
                            {years.map((y) => (
                              <th
                                key={y}
                                className="text-right font-mono text-[12px] pb-3 pl-6 align-bottom"
                                style={{ color: INK, minWidth: 128 }}
                              >
                                FY{y}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((f) => (
                            <tr key={f.key} className="border-t align-top" style={{ borderColor: LINE }}>
                              <td className="py-3 pr-6">
                                <div className="text-[15px]" style={{ color: INK }}>
                                  {f.label}
                                </div>
                                {f.note && (
                                  <div className="text-[13px] leading-[1.5] mt-1 max-w-[44ch]" style={{ color: DIM }}>
                                    {f.note}
                                  </div>
                                )}
                              </td>
                              {years.map((y) => {
                                const dirty = isChanged(y, f.key);
                                const value = current(y, f.key);
                                const original = filed(y, f.key);
                                return (
                                  <td key={y} className="py-3 pl-6 text-right">
                                    <input
                                      inputMode="decimal"
                                      title={`${f.label}, FY${y} — click and type to change it`}
                                      value={
                                        typeof value !== 'number' || !isFinite(value)
                                          ? ''
                                          : editing === `${y}:${f.key}`
                                          ? String(value)
                                          : fmt(value, f.count)
                                      }
                                      placeholder="—"
                                      onFocus={(e) => {
                                        setEditing(`${y}:${f.key}`);
                                        e.currentTarget.select();
                                      }}
                                      onBlur={() => setEditing('')}
                                      onChange={(e) => setCell(y, f.key, e.target.value)}
                                      className={`mg-cell w-full font-mono text-[14px] text-right px-2 py-1.5 outline-none transition-colors ${
                                        dirty ? 'mg-dirty' : ''
                                      }`}
                                    />
                                    {dirty && (
                                      <div className="flex items-center justify-end gap-2 mt-1.5">
                                        <span className="font-mono text-[11px]" style={{ color: DIM }}>
                                          filed {fmt(original, f.count)}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => revert(y, f.key)}
                                          title="Put the filed figure back"
                                          className="shrink-0"
                                        >
                                          <RotateCcw className="w-3 h-3" style={{ color: RED_TEXT }} />
                                        </button>
                                      </div>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
            <div className="border-t" style={{ borderColor: LINE }} />
          </div>
        </div>

        {/* ---------------------------------------------------------- */}
        {/* Two subtractions, stated and left there                     */}
        {/* ---------------------------------------------------------- */}
        <div className="mt-16 lg:mt-20">
          <Eyebrow>What the figures say about themselves</Eyebrow>
          <p className="text-[16px] leading-[1.6] max-w-[68ch] mb-8" style={{ color: READ }}>
            Neither of these is a judgement. Both are subtractions you could do on
            the filing yourself, shown here because they are the two that catch a
            source returning less than the whole picture.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ minWidth: 640 }}>
              <thead>
                <tr>
                  <th
                    className="text-left font-mono text-[11px] uppercase tracking-[0.18em] pb-3 pr-6"
                    style={{ color: DIM, minWidth: 300 }}
                  >
                    Check
                  </th>
                  {checks.map((c) => (
                    <th
                      key={c.year}
                      className="text-right font-mono text-[12px] pb-3 pl-6"
                      style={{ color: INK, minWidth: 128 }}
                    >
                      FY{c.year}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-t align-top" style={{ borderColor: LINE }}>
                  <td className="py-4 pr-6">
                    <div className="text-[15px]" style={{ color: INK }}>
                      Revenue less the cost lines, against reported operating profit
                    </div>
                    <div className="text-[13px] leading-[1.5] mt-1 max-w-[46ch]" style={{ color: DIM }}>
                      A large gap means the source has not returned every operating
                      cost. The model carries the difference on its own reconciling
                      line rather than letting it inflate operating profit.
                    </div>
                  </td>
                  {checks.map((c) => {
                    const big =
                      c.operatingGap !== null &&
                      c.operatingIncome !== null &&
                      Math.abs(c.operatingIncome) > 0 &&
                      Math.abs(c.operatingGap) / Math.abs(c.operatingIncome) > 0.05;
                    return (
                      <td key={c.year} className="py-4 pl-6 text-right">
                        <div className="font-mono text-[14px]" style={{ color: big ? RED_TEXT : READ }}>
                          {fmt(c.operatingGap)}
                        </div>
                        {big && (
                          <div className="font-mono text-[11px] mt-1" style={{ color: DIM }}>
                            {Math.round(
                              (Math.abs(c.operatingGap as number) /
                                Math.abs(c.operatingIncome as number)) *
                                100
                            )}
                            % of operating profit
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
                <tr className="border-t border-b align-top" style={{ borderColor: LINE }}>
                  <td className="py-4 pr-6">
                    <div className="text-[15px]" style={{ color: INK }}>
                      Total assets, against liabilities plus equity
                    </div>
                    <div className="text-[13px] leading-[1.5] mt-1 max-w-[46ch]" style={{ color: DIM }}>
                      Zero on a complete balance sheet. Anything else means one of the
                      three totals did not come back.
                    </div>
                  </td>
                  {checks.map((c) => {
                    const big =
                      c.balanceGap !== null &&
                      c.totalAssets !== null &&
                      Math.abs(c.totalAssets) > 0 &&
                      Math.abs(c.balanceGap) / Math.abs(c.totalAssets) > 0.01;
                    return (
                      <td key={c.year} className="py-4 pl-6 text-right">
                        <div className="font-mono text-[14px]" style={{ color: big ? RED_TEXT : READ }}>
                          {fmt(c.balanceGap)}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ==================================================================
            THE ADJUSTED EBITDA BRIDGE — the closing artefact of this screen.

            Last on purpose. The sections above are the work: the filed lines
            under their heads, the rest of what was returned, and two
            subtractions about the source. This one names what the reader has
            built out of them. Correcting a filed figure and setting a line
            aside as a one-off are, between them, exactly how an adjusted
            EBITDA is arrived at, and the bridge is the page a valuer, a lender
            or a buyer actually receives.
            ================================================================== */}
        <div className="mt-16 lg:mt-20">
          <Eyebrow>What you have built</Eyebrow>
          <h2 className="text-[clamp(22px,2.4vw,30px)] max-w-[26ch]" style={{ ...DISPLAY, color: INK }}>
            The adjusted EBITDA bridge
            <Mark />
          </h2>
          <p className="text-[16px] leading-[1.6] mt-4 max-w-[70ch]" style={{ color: READ }}>
            Reported EBITDA as the accounts state it, every adjustment you have made with your reason
            beside it, and the adjusted figure. Every reported year, because the question asked of an
            adjustment is almost always whether it recurs.
          </p>

          <div className="mt-6 max-w-[70ch] border-b" style={{ borderColor: LINE }}>
            <Disclose summary="What is in this bridge, and what is not" trailing="read this first">
              <p className="max-w-prose">
                <span style={{ color: INK }}>In:</span> filed operating profit, filed depreciation and
                amortisation added back, every figure you replaced, and every line you put under the
                one-offs head.
              </p>
              <p className="max-w-prose mt-2">
                <span style={{ color: INK }}>Not in:</span> stock-based compensation, which stays a
                cost — this is EBITDA, not EBITDA before share-based pay, because the peer multiples on
                this site are computed that way and pay settled in shares is still pay. Nor any
                normalisation nobody has filed a figure for. Nor anything about a forecast year: this
                bridge is about reported years.
              </p>
              <p className="max-w-prose mt-2">
                <span style={{ color: INK }}>The D&amp;A add-back is not an adjustment.</span> It is what
                makes this EBITDA rather than operating profit, so it is on its own line with its amount
                named. Depreciation cannot be moved to another head above, because the money already
                sits inside the filed cost lines and moving it would move money cost of sales still
                reports — which would classify the same money twice.
              </p>
              <p className="max-w-prose mt-2">
                A one-off is set aside in <span style={{ color: INK }}>every</span> reported year. A
                cost paid once is better handled as a correction to that year&rsquo;s operating profit,
                which appears here as a correction line.
              </p>
            </Disclose>
          </div>

          <div className="mt-8 overflow-x-auto">
            <table className="w-full border-collapse" style={{ minWidth: 640 }}>
              <thead>
                <tr>
                  <th
                    className="text-left font-mono text-[11px] uppercase tracking-[0.18em] pb-3 pr-6"
                    style={{ color: DIM, minWidth: 300 }}
                  >
                    Line
                  </th>
                  {bridge.years.map((y) => (
                    <th
                      key={y}
                      className="text-right font-mono text-[12px] pb-3 pl-6"
                      style={{ color: INK, minWidth: 128 }}
                    >
                      FY{y}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-t" style={{ borderColor: LINE }}>
                  <td className="py-2.5 pr-6 text-[15px]" style={{ color: INK }}>
                    Operating profit, as filed
                  </td>
                  {bridge.operatingProfitFiled.map((v, i) => (
                    <td key={i} className="py-2.5 pl-6 text-right font-mono text-[14px]" style={{ color: READ }}>
                      {fmt(v)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 pr-6 text-[15px]" style={{ color: INK }}>
                    Plus: depreciation and amortisation
                    <div className="text-[13px] leading-[1.5] mt-1 max-w-[46ch]" style={{ color: DIM }}>
                      Filed D&amp;A. Not an adjustment — it is what makes the line below EBITDA.
                    </div>
                  </td>
                  {bridge.depreciationAddedBack.map((v, i) => (
                    <td key={i} className="py-2.5 pl-6 text-right font-mono text-[14px]" style={{ color: READ }}>
                      {v === null ? (
                        <span style={{ color: DIM }}>none filed</span>
                      ) : (
                        fmt(v)
                      )}
                    </td>
                  ))}
                </tr>
                <tr className="border-t" style={{ borderColor: LINE }}>
                  <td className="py-3 pr-6 text-[16px]" style={{ color: INK, fontWeight: 600 }}>
                    Reported EBITDA
                  </td>
                  {bridge.reportedEbitda.map((v, i) => (
                    <td
                      key={i}
                      /* Named so the tie beneath it can be read against it: a
                         year with no filed operating profit has no EBITDA, and
                         a nil tie there is correct rather than a failure. */
                      data-bridge-reported={bridge.years[i]}
                      className="py-3 pl-6 text-right font-mono text-[15px]"
                      style={{ color: INK }}
                    >
                      {fmt(v)}
                    </td>
                  ))}
                </tr>

                {[...bridge.corrections, ...bridge.oneOffs].map((a) => (
                  <tr key={a.key} className="border-t align-top" style={{ borderColor: LINE }}>
                    <td className="py-3 pr-6">
                      <div className="text-[15px]" style={{ color: RED_TEXT }}>
                        {a.kind === 'correction' ? 'Correction' : 'One-off'} · {a.label}
                      </div>
                      <div className="text-[13px] leading-[1.5] mt-1 max-w-[52ch]" style={{ color: DIM }}>
                        {a.detail}.{' '}
                        {a.yearsMoved === 1
                          ? 'It moves EBITDA in one reported year only.'
                          : `It moves EBITDA in ${a.yearsMoved} of the ${bridge.years.length} reported years.`}
                      </div>
                      <div className="mt-2.5 flex flex-wrap items-center gap-3">
                        <label
                          className={`${LABEL} shrink-0`}
                          htmlFor={`adj-${a.key}`}
                          style={{ color: DIM }}
                        >
                          Why
                        </label>
                        <input
                          id={`adj-${a.key}`}
                          data-adjustment={a.key}
                          value={a.reason}
                          onChange={(e) => setAdjustmentReason(a.key, e.target.value)}
                          placeholder="One line, optional — it travels with the workbook"
                          maxLength={200}
                          className="mg-cell flex-1 min-w-[16rem] font-sans text-[14px] px-2.5 py-2 outline-none transition-colors"
                        />
                      </div>
                    </td>
                    {a.byYear.map((v, i) => (
                      <td key={i} className="py-3 pl-6 text-right font-mono text-[14px]" style={{ color: RED_TEXT }}>
                        {v === null ? '—' : v === 0 ? '0' : `${v > 0 ? '+' : ''}${fmt(v)}`}
                      </td>
                    ))}
                  </tr>
                ))}

                <tr className="border-t" style={{ borderColor: LINE }}>
                  <td className="py-3 pr-6 text-[16px]" style={{ color: INK, fontWeight: 600 }}>
                    Adjusted EBITDA
                    {!bridge.adjusted && (
                      <div className="text-[13px] leading-[1.5] mt-1 max-w-[46ch]" style={{ color: DIM }}>
                        You have made no adjustments, so this is the reported figure. The bridge says so
                        rather than being hidden.
                      </div>
                    )}
                  </td>
                  {bridge.adjustedEbitda.map((v, i) => (
                    <td key={i} className="py-3 pl-6 text-right font-mono text-[15px]" style={{ color: INK }}>
                      {fmt(v)}
                    </td>
                  ))}
                </tr>
                <tr className="border-t border-b" style={{ borderColor: LINE }}>
                  <td className="py-3 pr-6">
                    <div className="text-[15px]" style={{ color: INK }}>
                      Adjusted, less reported and every adjustment
                    </div>
                    <div className="text-[13px] leading-[1.5] mt-1 max-w-[46ch]" style={{ color: DIM }}>
                      Nil in every year, or the bridge does not add up.
                    </div>
                  </td>
                  {bridge.tie.map((v, i) => (
                    <td
                      key={i}
                      data-bridge-tie={bridge.years[i]}
                      className="py-3 pl-6 text-right font-mono text-[14px]"
                      style={{ color: v === null || Math.abs(v) < 0.05 ? READ : RED_TEXT }}
                    >
                      {fmt(v)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {bridge.neutral.length > 0 && (
            <div className="mt-6 max-w-[76ch]">
              <div className={EYEBROW} style={{ color: DIM }}>
                Corrections that cannot move EBITDA
              </div>
              <p className="text-[14px] leading-[1.6] mt-2" style={{ color: READ }}>
                Reported operating profit is anchored to the filed figure, with the difference against
                the named cost lines carried on the reconciling line. So these change what the costs
                are called and not what the company earned — listed here rather than left out, because a
                correction you cannot find in a bridge gives you no way to tell whether it was ignored
                or had no effect.
              </p>
              <ul className={`${UI} mt-3 space-y-1`} style={{ color: DIM }}>
                {bridge.neutral.map((n) => (
                  <li key={n.label}>
                    <span style={{ color: READ }}>{n.label}</span> — corrected in{' '}
                    {n.years.map((y) => `FY${y}`).join(', ')}, no effect on EBITDA in any year
                    {n.reason ? `. ${n.reason}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="mt-16">
          <button
            onClick={onBack}
            className={`${LABEL} transition-colors cursor-pointer`}
            style={{ color: MUTED }}
          >
            &larr;&nbsp;&nbsp;{returning ? 'Back to the model, leaving these figures alone' : 'Back to the search'}
          </button>
        </div>
      </div>

      {/* The standing bar: what has changed, and the way on. It stays on
          screen because the count is the thing the reader must not lose
          track of. */}
      <div
        ref={bar.ref}
        className="fixed bottom-0 inset-x-0 z-40 border-t backdrop-blur-md"
        style={{
          background: 'rgba(17,17,20,0.96)',
          borderColor: LINE,
          /* On a phone the browser's own chrome is drawn over the bottom of
             the viewport, and a bar at `bottom: 0` puts its buttons underneath
             it. The safe area is the part the browser promises not to cover.
             Zero everywhere else, so this costs nothing on a desktop. */
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <div className="max-w-[1380px] mx-auto px-6 sm:px-10 lg:px-16 py-4 flex items-center justify-between gap-6 flex-wrap">
          {/* BOTH JUDGEMENTS, COUNTED SEPARATELY. A figure corrected and a line
              moved to another head are different claims about the model, and one
              number covering both would hide whichever the reader did not make. */}
          <div className="font-mono text-[12px]" style={{ color: changed || moved ? RED_TEXT : MUTED }}>
            {changed === 0 && moved === 0
              ? 'Every figure as filed, every line on its default head'
              : [
                  changed ? `${changed} figure${changed === 1 ? '' : 's'} corrected` : '',
                  moved ? `${moved} line${moved === 1 ? '' : 's'} moved` : '',
                ]
                  .filter(Boolean)
                  .join(' · ') + ' — the model will be badged'}
          </div>
          <div className="flex items-center gap-3">
            {(changed > 0 || moved > 0) && (
              <button
                type="button"
                onClick={() => {
                  resetAll();
                  headsToDefaults();
                }}
                className={`${LABEL} px-4 py-3 border bg-transparent transition-colors hover:border-[#8B1E1E]`}
                style={{ borderColor: LINE, color: MUTED }}
              >
                {changed && moved
                  ? 'Reset the figures and the heads'
                  : moved
                    ? 'Back to the default heads'
                    : 'Reset to as filed'}
              </button>
            )}
            <button
              type="button"
              onClick={onContinue}
              disabled={building}
              className={`${LABEL} px-6 py-3 border flex items-center gap-2 disabled:opacity-50`}
              style={{ borderColor: RED, background: 'rgba(139,30,30,0.22)', color: INK }}
            >
              {building
                ? 'Building the model…'
                : returning
                ? changed || moved
                  ? 'Rebuild with these judgements'
                  : 'Rebuild as filed'
                : changed || moved
                ? 'Build with these judgements'
                : 'Build the model'}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FiguresEditor;
