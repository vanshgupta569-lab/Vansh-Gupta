// FILE: src/components/figuresEditor.tsx
//
// Marginalia — the reported figures, and the head each line sits under
//
// WHAT THIS SCREEN IS
//
// A table of what the source filed for this company, one line per row, grouped
// under the model head the engine forecasts it on. A figure is changed by
// clicking it. A line is moved to another head by dragging it, or through the
// row's own menu. Nothing else is on the screen.
//
// WHY IT WAS CUT BACK
//
// The previous version was correct and unreadable. Every line carried the
// sentence saying where its default head came from, every head carried a
// paragraph saying what the forecast does with it, three disclosures sat above
// the table and a notice sat between them — so a screen whose reason to exist
// is about sixty numbers was mostly grey prose, ran to four or five screens,
// and set those numbers in a monospace face at a size of their own. It broke
// the first design principle in the most ordinary way: it was busy.
//
// None of the prose is deleted. All of it moved behind a ⓘ beside the thing it
// explains (`figuresHint.tsx`), reachable by hover, by keyboard focus and by
// tap. What is left on the screen is a title, one line of instruction, the two
// statements, and the figures.
//
// THE EDITING BUG THIS FIXES
//
// Clicking a figure did nothing. The row carried `draggable` so it could be
// dragged to another head, and **a draggable ancestor takes the mouse gesture
// away from a text input inside it** — Chromium will not place a caret in an
// input whose ancestor owns the drag. Measured before the fix, in the same
// browser the dashboard check drives: clicking a cell left `document.activeElement`
// on `BODY` and typing changed nothing, with the figure switching from grouped
// to raw as the only sign anything had happened at all.
//
// So the row is not draggable any more. **Only the grip is**, and the grip is
// not an input. The row is still the drop target and still the thing that moves.
//
// THE FOUR STATES, KEPT VISIBLY APART
//
//   Reported      what the source filed. Plain.
//   Corrected     a figure the reader supplied. Marked, with the filed figure
//                 and a way back behind the marker.
//   Reclassified  a line moved to another head. Marked, naming the head it left.
//   Modelled      anything the engine computes. Not on this screen at all.

import React, { useMemo, useState } from 'react';
import { ArrowRight, GripVertical } from 'lucide-react';
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
  type Head,
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
import { Hint, RowMenu, HINT_STYLES } from './figuresHint';
import { useBottomBarInset } from './instrument';
import { Mark } from '../design/Mark';

const { accent: RED, accentText: RED_TEXT, ink: INK, read: READ, muted: MUTED, quiet: DIM, line: LINE } = DARK;

/* Money is carried in millions everywhere in the engine; share counts are whole
   counts. Both are printed the way a person writes them, and an absent figure
   prints as an em dash rather than as a zero — the filing not saying something
   and the filing saying nothing are different facts. */
const show = (v: any, count?: boolean, locale = 'en-US'): string => {
  if (typeof v !== 'number' || !isFinite(v)) return '—';
  if (count) return Math.round(v).toLocaleString(locale);
  if (Math.abs(v) < 0.05) return '0';
  const abs = Math.abs(v);
  const dp = abs >= 10000 ? 0 : abs >= 100 ? 1 : 2;
  return v.toLocaleString(locale, { minimumFractionDigits: dp, maximumFractionDigits: dp });
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
  /** The payload itself, so the model can be rebuilt here rather than described. */
  payload?: any;
  onContinue: () => void;
  onBack: () => void;
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
  const [statement, setStatement] = useState<Statement>('income');
  /* Which cell the cursor is in. A figure is grouped while it is being read and
     shown raw the moment it is being edited: 988107.1270000001 is the truth,
     and it is not a number anybody can read down a column. */
  const [editing, setEditing] = useState<string>('');
  /** The line being dragged, and the head the cursor is over. */
  const [dragging, setDragging] = useState<string>('');
  const [over, setOver] = useState<string>('');
  /** The sections that are not the table. Closed, because the table is the screen. */
  const [openSection, setOpenSection] = useState<string>('');

  /* Digit grouping belongs to the company, not to the reader. An Indian filing
     reads in lakh and crore; a dollar filing does not. */
  const locale = currency === 'INR' || currencySymbol === '₹' ? 'en-IN' : 'en-US';
  const fmt = (v: any, count?: boolean) => show(v, count, locale);

  const years = useMemo(() => statements.map((s) => String(s.fiscalYear)), [statements]);
  const changed = correctionCount(corrections);
  const moved = moveCount(heads);

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
      if (typeof original === 'number' && Math.abs(original - n) < 1e-9) delete next[year][key];
      else next[year][key] = n;
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
  const toDefault = (field: string) => {
    const next: HeadAssignment = { ...heads };
    delete next[field];
    onHeads(next);
  };
  /** One link, both judgements. The count beside it says what it will undo. */
  const resetAll = () => {
    onChange({});
    onHeads({});
    onReason({});
  };

  // THE MODEL IS REBUILT HERE, NOT DESCRIBED. A change rebuilds it at once with
  // the previous value still beside it, which is the judgement layer's rule.
  const valueNow = useMemo(
    () => (payload && moved ? valueUnder(payload, corrections, heads) : null),
    [payload, corrections, heads, moved]
  );
  const valueOnDefaults = useMemo(
    () => (payload && moved ? valueUnder(payload, corrections, {}) : null),
    [payload, corrections, moved]
  );

  const bridge = useMemo(
    () => buildEbitdaBridge(statements, corrections, heads, correctionReasons),
    [statements, corrections, heads, correctionReasons]
  );
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
  /** The reason box for a corrected field, shown inline under its row. */
  const setFieldReason = (field: string, text: string) => {
    const next: CorrectionReasons = { ...correctionReasons };
    if (text.trim()) next[field] = text;
    else delete next[field];
    onReason(next);
  };

  const bar = useBottomBarInset();
  const sheet = statement === 'income' ? grouped.income : grouped.balance;

  /** Drop a dragged line on a head. The only path a drag takes. */
  const drop = (head: HeadKey, carried: string) => {
    const field = carried || dragging;
    setDragging('');
    setOver('');
    if (!field) return;
    const spec = sheet.flatMap((h) => h.lines).find((l) => l.field === field);
    if (!spec || !spec.movable) return;
    if (!spec.movableTo.includes(head) && head !== spec.defaultHead) return;
    if (head === spec.defaultHead) toDefault(field);
    else setHead(field, head);
  };

  // ------------------------------------------------------------------------
  // ONE ROW
  //
  // A PLAIN FUNCTION, NOT A COMPONENT, AND THAT IS THE EDITING BUG.
  //
  // This was `const Row: React.FC<...> = ({ line }) => ...`, declared inside
  // the screen's own body. A component declared inside a render is a NEW
  // COMPONENT TYPE on every render, and React does not update a subtree whose
  // type changed — it unmounts the old one and mounts a new one. So the moment
  // clicking a figure set any state, every input in the table was torn down and
  // rebuilt, and the caret went with it.
  //
  // Measured in the browser the dashboard check drives, before the fix:
  // `document.elementFromPoint` at the centre of a cell returned that cell's
  // own INPUT, so nothing was covering it — and yet after clicking it, and
  // after calling `.focus()` on it directly, `document.activeElement` was BODY
  // and typing changed nothing. An element that will not take focus even when
  // focus is handed to it is not being blocked; it is being replaced.
  //
  // Returning the rows from a function call instead means React sees the <tr>
  // elements themselves, reconciles them in place, and the input the reader is
  // typing into survives the keystroke that re-renders the screen.
  const renderRow = (line: FiledLine, merged?: Head) => {
    const movedHere = isMoved(line.field, heads);
    const changedHere = years.some((y) => isChanged(y, line.field));
    const reasonShown = movedHere || changedHere;
    // A HEAD WITH ONE LINE IS ONE ROW, not two.
    //
    // Most heads carry exactly one filed line, and most of those share its
    // name: the first build of this table printed "Revenue" as a group row and
    // "Revenue" again on the row beneath it, then did the same for cost of
    // sales, finance cost, tax, depreciation and other operating costs. Half
    // the rows in the profit and loss were a name repeated under itself, and
    // the two that did not repeat were truncated to make room. Merged, the
    // statement goes from twenty-two rows to thirteen and reads the way a
    // printed one does.
    const label = merged ? merged.label : line.label;
    const alias = merged && line.label !== merged.label ? line.label : null;
    return (
      <React.Fragment key={line.field}>
        <tr
          data-line={line.field}
          data-head={headOf(line.field, heads)}
          className={merged ? 'mg-row mg-grouprow' : 'mg-row'}
          style={{ background: dragging === line.field ? 'rgba(139,30,30,0.10)' : undefined }}
        >
          <td className="mg-name">
            <span className="flex items-center gap-1.5 min-w-0">
              {/* ONLY THE GRIP IS DRAGGABLE. The row used to be, and a
                  draggable ancestor takes the click away from the inputs in
                  it — which is the whole of the editing bug this fixes. A
                  line that cannot move simply has no grip; its ⓘ says why. */}
              {line.movable ? (
                <span
                  className="mg-grip"
                  draggable
                  aria-hidden="true"
                  onDragStart={(e) => {
                    setDragging(line.field);
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', line.field);
                  }}
                  onDragEnd={() => {
                    setDragging('');
                    setOver('');
                  }}
                >
                  <GripVertical className="w-3 h-3" />
                </span>
              ) : (
                <span className="mg-grip-gap" aria-hidden="true" />
              )}
              <span className="truncate" style={{ color: INK }}>
                {label}
                {alias && (
                  <span style={{ color: DIM, fontWeight: 400 }}> · {alias}</span>
                )}
              </span>
              <Hint label={`Why ${label} sits here`}>
                {merged && <p style={{ marginBottom: 6 }}>{merged.forecast}</p>}
                {merged && !merged.dropTarget && (
                  <p style={{ marginBottom: 6, color: MUTED }}>
                    <strong style={{ color: INK, fontWeight: 600 }}>Not a drop target.</strong>{' '}
                    {merged.notYetBecause}
                  </p>
                )}
                {movedHere && (
                  <p style={{ color: RED_TEXT, marginBottom: 6 }}>
                    Yours. The default is {HEAD_BY_KEY[line.defaultHead].label.toLowerCase()}.
                  </p>
                )}
                {line.derived && (
                  <p style={{ color: MUTED, marginBottom: 6 }}>Computed, not filed.</p>
                )}
                {line.componentOf && (
                  <p style={{ color: MUTED, marginBottom: 6 }}>Already inside {line.componentOf}.</p>
                )}
                <p>{line.basis}</p>
                {!line.movable && line.fixedBecause && (
                  <p style={{ marginTop: 6, color: MUTED }}>
                    <strong style={{ color: INK, fontWeight: 600 }}>Fixed.</strong> {line.fixedBecause}
                  </p>
                )}
              </Hint>
              {movedHere && (
                <span className="mg-moved" title={`Moved from ${HEAD_BY_KEY[line.defaultHead].label}`} />
              )}
              <span className="ml-auto pl-2">
                {line.movable && (
                  <RowMenu
                    label={`Move ${line.label} to another head`}
                    heading="Move to…"
                    items={[
                      ...line.movableTo.map((k) => ({
                        key: k,
                        label: HEAD_BY_KEY[k].label,
                        onPick: () => setHead(line.field, k),
                      })),
                      ...(movedHere
                        ? [
                            {
                              key: 'default',
                              label: `Back to ${HEAD_BY_KEY[line.defaultHead].label}`,
                              note: 'the engine’s default',
                              onPick: () => toDefault(line.field),
                            },
                          ]
                        : []),
                    ]}
                  />
                )}
              </span>
            </span>
          </td>
          {years.map((y) => {
            // THE RECONCILING LINE HAS NO CELL TO TYPE IN. It is a residual, so
            // an input would invite a figure the next keystroke recomputes.
            if (line.derived) {
              const i = years.indexOf(y);
              return (
                <td key={y} className="mg-fig" style={{ color: MUTED }}>
                  {fmt(line.amounts[i])}
                </td>
              );
            }
            const dirty = isChanged(y, line.field);
            const value = current(y, line.field);
            return (
              <td key={y} className="mg-fig">
                <span className="mg-cellwrap">
                  <input
                    inputMode="decimal"
                    aria-label={`${line.label}, FY${y}`}
                    title={`${line.label}, FY${y}`}
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
                    className={`mg-cell ${dirty ? 'mg-dirty' : ''}`}
                  />
                  {dirty && (
                    <Hint label={`What ${line.label} was filed at in FY${y}`} tone="quiet">
                      <p>
                        Filed <strong style={{ color: INK, fontWeight: 600 }}>{fmt(filed(y, line.field))}</strong>, yours{' '}
                        <strong style={{ color: INK, fontWeight: 600 }}>{fmt(value)}</strong>.
                      </p>
                      <button type="button" onClick={() => revert(y, line.field)} className="mg-revert">
                        Put the filed figure back
                      </button>
                    </Hint>
                  )}
                </span>
              </td>
            );
          })}
        </tr>
        {/* THE REASON IS OPTIONAL AND NEVER BLOCKS. It appears once something
            has been changed, takes one line, and is the same store the bridge
            and the workbook read. */}
        {reasonShown && (
          <tr className="mg-reasonrow">
            <td colSpan={1 + years.length}>
              <input
                id={movedHere ? `why-${line.field}` : `whyfig-${line.field}`}
                data-reason={line.field}
                value={movedHere ? reasonOf(line.field, heads) : correctionReasons[line.field] || ''}
                onChange={(e) =>
                  movedHere ? setHeadReason(line.field, e.target.value) : setFieldReason(line.field, e.target.value)
                }
                placeholder="Add a reason (optional)"
                maxLength={200}
                className="mg-reason"
              />
            </td>
          </tr>
        )}
      </React.Fragment>
    );
  };

  const anchors = grouped.anchors.filter((a) => a.statement === statement);

  return (
    <div className="min-h-screen" style={{ background: DARK.page }}>
      <style>{`
        ${HINT_STYLES}
        /* ONE FAMILY, TWO SIZES, TABULAR FIGURES.
           Everything in the table is the body face: a column of numbers lines
           up because the figures are tabular, not because the face is a
           typewriter. A group row is the same size as a line and bold, which
           is the whole of the hierarchy inside the table. */
        .mg-table { width: 100%; border-collapse: collapse; font-size: 14px; }
        .mg-th-line { text-align: left; min-width: 340px; }
        .mg-th-year { min-width: 104px; }
        /* ON A PHONE THE NAMES GIVE WAY TO THE FIGURES.
           A financial table is wider than a phone and scrolls sideways, which
           is normal — but at the desktop column widths the name column alone
           filled the screen, so a reader saw a list of line names and not one
           number until they thought to swipe. Narrowing the name column puts
           the most recent year on screen beside the name it belongs to, and
           the older years are a swipe away rather than all of them. */
        @media (max-width: 640px) {
          .mg-table { font-size: 13px; }
          .mg-th-line { min-width: 164px; }
          .mg-th-year { min-width: 92px; }
          .mg-fig { padding-left: 10px; }
        }
        .mg-table th, .mg-table td { font-size: 14px; line-height: 1.45; }
        .mg-head th {
          font-weight: 400;
          color: ${DIM};
          padding: 0 0 6px;
          border-bottom: 1px solid ${LINE};
          white-space: nowrap;
        }
        .mg-head th.mg-fig { text-align: right; padding-left: 18px; }
        .mg-name { padding: 4px 0; max-width: 1px; }
        .mg-fig {
          text-align: right;
          padding: 4px 0 4px 18px;
          font-variant-numeric: tabular-nums;
          font-feature-settings: 'tnum' 1;
          white-space: nowrap;
          color: ${READ};
        }
        .mg-row:hover { background: rgba(242,240,234,0.025); }
        .mg-grip-gap { display: inline-flex; width: 12px; flex: none; }
        .mg-grouprow td {
          padding: 14px 0 4px;
          font-weight: 600;
          color: ${INK};
          border-top: 1px solid ${LINE};
        }
        .mg-grouprow td.mg-fig { font-weight: 600; color: ${INK}; }
        .mg-grouprow:first-child td { border-top: 0; }
        .mg-droptarget td { background: rgba(139,30,30,0.07); }
        .mg-drophot td { background: rgba(139,30,30,0.22); }
        /* A FIELD HAS TO LOOK LIKE A FIELD, and this one has to look like a
           figure until it is touched. It sits on the baseline with no border
           until the cursor is over it, which is what tells a reader the column
           can be typed into without drawing sixty boxes. */
        .mg-cell {
          background: transparent;
          border: 1px solid transparent;
          color: ${READ};
          text-align: right;
          width: 100%;
          padding: 1px 4px;
          outline: none;
          font: inherit;
          font-variant-numeric: tabular-nums;
          font-feature-settings: 'tnum' 1;
          cursor: text;
          transition: background-color 120ms ease, border-color 120ms ease, color 120ms ease;
        }
        .mg-cell::placeholder { color: ${DIM}; }
        .mg-cell:hover { background: #17171B; border-color: ${LINE}; color: ${INK}; }
        .mg-cell:focus { background: #131316; border-color: ${RED}; color: ${INK}; }
        .mg-cell.mg-dirty { color: ${INK}; border-bottom-color: ${RED}; }
        .mg-cellwrap { display: inline-flex; align-items: center; width: 100%; justify-content: flex-end; }
        /* The marker on a changed figure, and on a moved line. One small
           square, the one red the system allows, and the ⓘ beside it carries
           the filed value and the way back. */
        .mg-moved {
          display: inline-block;
          width: 5px; height: 5px;
          background: ${RED_TEXT};
          flex: none;
        }
        .mg-revert {
          margin-top: 8px;
          background: none;
          border: 1px solid ${LINE};
          color: ${READ};
          padding: 4px 8px;
          cursor: pointer;
          font: inherit;
          font-size: 12px;
        }
        .mg-revert:hover { border-color: ${RED}; color: ${INK}; }
        .mg-reasonrow td { padding: 0 0 6px 0; }
        .mg-reason {
          width: min(420px, 100%);
          background: transparent;
          border: 0;
          border-bottom: 1px dashed ${LINE};
          color: ${READ};
          font: inherit;
          font-size: 13px;
          padding: 2px 0;
          outline: none;
        }
        .mg-reason::placeholder { color: ${DIM}; }
        .mg-reason:hover, .mg-reason:focus { border-bottom-color: ${MUTED}; color: ${INK}; }
        .mg-tab {
          font: inherit;
          font-size: 14px;
          padding: 6px 14px;
          border: 1px solid ${LINE};
          background: transparent;
          color: ${MUTED};
          cursor: pointer;
        }
        .mg-tab[aria-selected="true"] { border-color: ${RED}; background: rgba(139,30,30,0.20); color: ${INK}; }
        .mg-link {
          background: none; border: 0; padding: 0; cursor: pointer;
          font: inherit; font-size: 13px; color: ${RED_TEXT};
          text-decoration: underline; text-underline-offset: 3px;
        }
        .mg-foot summary { cursor: pointer; list-style: none; }
        .mg-foot summary::-webkit-details-marker { display: none; }
      `}</style>

      <div className="max-w-[1180px] mx-auto px-6 sm:px-10 lg:px-14 pt-28 sm:pt-24 lg:pt-28 pb-14">
        {/* ============ the whole header: a title and one line ============ */}
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <h1 className="text-[28px] leading-[1.1]" style={{ color: INK, fontWeight: 600, letterSpacing: '-0.02em' }}>
            Reported figures
            <Mark />
          </h1>
          <div className="flex items-center gap-3 pt-1.5" style={{ fontSize: 13, color: changed || moved ? RED_TEXT : DIM }}>
            <span data-change-count>
              {changed === 0 && moved === 0
                ? 'No changes'
                : [
                    changed ? `${changed} figure${changed === 1 ? '' : 's'} changed` : '',
                    moved ? `${moved} line${moved === 1 ? '' : 's'} moved` : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
            </span>
            {(changed > 0 || moved > 0) && (
              <button type="button" onClick={resetAll} className="mg-link">
                Reset all
              </button>
            )}
          </div>
        </div>

        <p className="mt-2.5 flex items-start" style={{ fontSize: 14, color: MUTED, lineHeight: 1.5 }}>
          <span>
            As filed by {name}, source {source}. Click a number to change it; drag a line to move it.
          </span>
          {/* EVERYTHING THAT USED TO BE A PARAGRAPH IS IN HERE. The three
              disclosures and the notice about the captions, in the one place a
              reader asks "what am I looking at". */}
          <Hint label="What this screen is, and what the figures are">
            <p style={{ color: INK, marginBottom: 6 }}>These are the fields our source provides, not yet {ticker}’s own line captions.</p>
            <p style={{ marginBottom: 8 }}>
              Which lines appear is real and differs company by company — this is what the source returned for{' '}
              {ticker} — but the wording of each is ours. The company’s own captions arrive with the
              primary-filings data layer.
            </p>
            <p style={{ color: INK, marginBottom: 4 }}>The four states</p>
            <p style={{ marginBottom: 8 }}>
              Reported is what the source filed. Corrected is a figure you supplied, marked, with the filed
              one behind the marker. Reclassified is a line you moved, marked, naming the head it left.
              Modelled is anything the engine works out, and none of it is here.
            </p>
            <p style={{ color: INK, marginBottom: 4 }}>What a move changes</p>
            <p style={{ marginBottom: 8 }}>
              Reported operating profit is tied to the filed figure, so moving a line between research,
              selling and other operating costs changes what each line is called and not what the company
              earns. One-offs, depreciation, cost of sales and anything crossing into or out of cash or
              fixed assets do change the value.
            </p>
            <p>
              Nothing is uploaded or stored; a change lives in this browser tab.
              {sourceUrl ? (
                <>
                  {' '}
                  <a href={sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: RED_TEXT }}>
                    Open the filings
                  </a>
                  .
                </>
              ) : null}
            </p>
          </Hint>
        </p>

        {/* ============================ the tabs ========================== */}
        <div className="flex items-center gap-px mt-6 mb-1" role="tablist" aria-label="Statement">
          {(
            [
              ['income', 'Profit and loss'],
              ['balance', 'Balance sheet'],
            ] as [Statement, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={statement === key}
              onClick={() => setStatement(key)}
              className="mg-tab"
            >
              {label}
            </button>
          ))}
        </div>

        {/* =========================== the table ========================= */}
        <div className="overflow-x-auto">
          <table className="mg-table" style={{ minWidth: 560 }}>
            <thead className="mg-head">
              <tr>
                <th className="mg-th-line">
                  Line
                  {/* THE UNIT, WHICH A TABLE OF FIGURES CANNOT DO WITHOUT.
                      It used to be a sentence beside the heading and was cut
                      with the rest of the prose; a column of numbers whose
                      unit is nowhere on the screen is worse than a long
                      screen. It belongs in the stub of the table, which is
                      where a printed statement puts it. */}
                  <span style={{ color: DIM, fontWeight: 400 }}> · {currencySymbol} millions</span>
                </th>
                {years.map((y) => (
                  <th key={y} className="mg-fig mg-th-year">
                    FY{y}
                  </th>
                ))}
              </tr>
            </thead>

            {sheet.map((group) => {
              const head = group.head;
              if (!group.lines.length && !head.dropTarget) return null;
              const active = dragging && head.dropTarget;
              const hot = active && over === head.key;
              const contributing = group.lines.filter((l) => !l.componentOf);
              const sums = contributing.length > 1;
              const single = group.lines.length === 1 ? group.lines[0] : null;
              return (
                <tbody
                  key={head.key}
                  data-head-band={head.key}
                  className={hot ? 'mg-drophot' : active ? 'mg-droptarget' : ''}
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
                  {single ? (
                    renderRow(single, head)
                  ) : (
                    <>
                      <tr className="mg-grouprow">
                        <td>
                          <span className="flex items-center gap-1.5">
                            <span className="mg-grip-gap" aria-hidden="true" />
                            {head.label}
                            <Hint label={`What the model does with ${head.label}`}>
                              <p>{head.forecast}</p>
                              {!head.dropTarget && (
                                <p style={{ marginTop: 6, color: MUTED }}>
                                  <strong style={{ color: INK, fontWeight: 600 }}>Not a drop target.</strong>{' '}
                                  {head.notYetBecause}
                                </p>
                              )}
                            </Hint>
                          </span>
                        </td>
                        {years.map((y, i) => (
                          <td key={y} className="mg-fig" data-head-total={`${head.key}:${y}`}>
                            {/* An empty head is a dash, and still takes a drop. */}
                            {!group.lines.length
                              ? '—'
                              : sums
                              ? group.totals[i] === null
                                ? '—'
                                : fmt(group.totals[i])
                              : ''}
                          </td>
                        ))}
                      </tr>
                      {group.lines.map((l) => renderRow(l))}
                    </>
                  )}
                </tbody>
              );
            })}

            {/* The filed anchors: shown, never under a head, still editable. */}
            {anchors.length > 0 && (
              <tbody>
                <tr className="mg-grouprow">
                  <td>
                    <span className="flex items-center gap-1.5">
                      <span className="mg-grip-gap" aria-hidden="true" />
                      As filed
                      <Hint label="What the filed anchors are">
                        <p>
                          The figures the model ties itself to. They sit under no head and the reported column is
                          these figures whatever you move. The engine plugs other current assets from total
                          current assets and other liabilities from total liabilities, so correcting one changes
                          where every unnamed balance lands.
                        </p>
                      </Hint>
                    </span>
                  </td>
                  {years.map((y) => (
                    <td key={y} className="mg-fig" />
                  ))}
                </tr>
                {anchors.map((a) => renderRow(a))}
              </tbody>
            )}

            {/* The tie: one row, no prose. */}
            {statement === 'income' && (
              <tbody>
                <tr className="mg-grouprow">
                  <td>
                    <span className="flex items-center gap-1.5">
                      <span className="mg-grip-gap" aria-hidden="true" />
                      Unallocated
                      <Hint label="What the unallocated row checks">
                        <p>
                          Filed operating profit, less revenue and every head above. Nil wherever you put a line;
                          anything else would mean one had been counted twice or dropped.
                        </p>
                      </Hint>
                    </span>
                  </td>
                  {grouped.tie.map((v, i) => (
                    <td
                      key={i}
                      className="mg-fig"
                      data-head-tie={years[i]}
                      style={{ color: v === null || Math.abs(v) < 0.05 ? MUTED : RED_TEXT, fontWeight: 400 }}
                    >
                      {fmt(v)}
                    </td>
                  ))}
                </tr>
              </tbody>
            )}
          </table>
        </div>

        {/* The rebuilt value: two figures and a line, only once something moved. */}
        {moved > 0 && valueNow && (
          <div className="mt-6 pt-4 border-t" style={{ borderColor: LINE }}>
            {valueNow.refusal ? (
              <p style={{ fontSize: 14, color: READ }}>
                On these judgements the engine refuses a value: {valueNow.refusal}
              </p>
            ) : (
              <div className="flex flex-wrap items-baseline gap-x-10 gap-y-2" style={{ fontSize: 14 }}>
                <span style={{ color: DIM }}>Rebuilt on your judgements</span>
                {(
                  [
                    ['Perpetuity', valueNow.perpetuity, valueOnDefaults?.perpetuity],
                    ['Exit multiple', valueNow.exitMultiple, valueOnDefaults?.exitMultiple],
                  ] as [string, number | null, number | null | undefined][]
                ).map(([label, now, before]) => (
                  <span key={label} style={{ color: READ, fontVariantNumeric: 'tabular-nums' }}>
                    {label}{' '}
                    <strong style={{ color: INK, fontWeight: 600 }}>
                      {currencySymbol}
                      {fmt(now)}
                    </strong>
                    <span style={{ color: DIM }}>
                      {typeof before === 'number' ? ` · was ${currencySymbol}${fmt(before)}` : ' · the engine refuses a value on its own defaults'}
                    </span>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ==================================================================
            WHAT IS NOT THE TABLE, FOLDED AWAY.

            The cash flow and share-count lines, the two arithmetic checks on
            the source, and the adjusted EBITDA bridge. None of it is deleted —
            the bridge is the page a valuer, a lender or a buyer receives — but
            none of it is what a reader came to this screen for, and all of it
            together is what made the page four screens long. Closed by default,
            named so a reader knows what is in each.
            ================================================================== */}
        <div className="mt-10 mg-foot">
          {[
            { key: 'rest', title: 'Cash flow and the share count', note: `${FIELDS.filter((f) => f.group === 'cash' || f.group === 'shares').length} more lines you can change` },
            { key: 'checks', title: 'What the figures say about themselves', note: 'two subtractions on the filing' },
            { key: 'bridge', title: 'The adjusted EBITDA bridge', note: bridge.adjusted ? `${bridge.corrections.length + bridge.oneOffs.length} adjustments` : 'nothing adjusted yet' },
          ].map((s) => {
            const open = openSection === s.key;
            return (
              <div key={s.key} className="border-t" style={{ borderColor: LINE }}>
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenSection(open ? '' : s.key)}
                  className="w-full text-left py-3 flex items-baseline justify-between gap-6"
                  style={{ fontSize: 14, color: open ? INK : READ }}
                >
                  <span>{s.title}</span>
                  <span style={{ color: DIM, fontSize: 13 }}>{open ? 'Hide' : s.note}</span>
                </button>
                {open && s.key === 'rest' && (
                  <div className="overflow-x-auto pb-6">
                    <table className="mg-table" style={{ minWidth: 560 }}>
                      <thead className="mg-head">
                        <tr>
                          <th className="mg-th-line">Line</th>
                          {years.map((y) => (
                            <th key={y} className="mg-fig mg-th-year">
                              FY{y}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {GROUPS.filter((g) => g.key === 'cash' || g.key === 'shares').map((group) => (
                          <React.Fragment key={group.key}>
                            <tr className="mg-grouprow">
                              <td>
                                <span className="flex items-center gap-1.5">
                                  <span className="mg-grip-gap" aria-hidden="true" />
                                  {group.title}
                                  <Hint label={`What ${group.title} covers`}>
                                    <p>{group.standfirst}</p>
                                  </Hint>
                                </span>
                              </td>
                              {years.map((y) => (
                                <td key={y} className="mg-fig" />
                              ))}
                            </tr>
                            {FIELDS.filter((f) => f.group === group.key).map((f) => (
                              <tr key={f.key} className="mg-row" data-line={f.key}>
                                <td className="mg-name">
                                  <span className="flex items-center gap-1.5">
                                    <span className="mg-grip-gap" aria-hidden="true" />
                                    <span style={{ color: INK }}>{f.label}</span>
                                    {f.note && (
                                      <Hint label={`About ${f.label}`}>
                                        <p>{f.note}</p>
                                      </Hint>
                                    )}
                                  </span>
                                </td>
                                {years.map((y) => {
                                  const dirty = isChanged(y, f.key);
                                  const value = current(y, f.key);
                                  return (
                                    <td key={y} className="mg-fig">
                                      <span className="mg-cellwrap">
                                        <input
                                          inputMode="decimal"
                                          aria-label={`${f.label}, FY${y}`}
                                          title={`${f.label}, FY${y}`}
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
                                          className={`mg-cell ${dirty ? 'mg-dirty' : ''}`}
                                        />
                                        {dirty && (
                                          <Hint label={`What ${f.label} was filed at in FY${y}`}>
                                            <p>
                                              Filed{' '}
                                              <strong style={{ color: INK, fontWeight: 600 }}>
                                                {fmt(filed(y, f.key), f.count)}
                                              </strong>
                                              , yours{' '}
                                              <strong style={{ color: INK, fontWeight: 600 }}>
                                                {fmt(value, f.count)}
                                              </strong>
                                              .
                                            </p>
                                            <button type="button" onClick={() => revert(y, f.key)} className="mg-revert">
                                              Put the filed figure back
                                            </button>
                                          </Hint>
                                        )}
                                      </span>
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {open && s.key === 'checks' && (
                  <div className="overflow-x-auto pb-6">
                    <table className="mg-table" style={{ minWidth: 560 }}>
                      <thead className="mg-head">
                        <tr>
                          <th className="mg-th-line">Check</th>
                          {checks.map((c) => (
                            <th key={c.year} className="mg-fig mg-th-year">
                              FY{c.year}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="mg-row">
                          <td className="mg-name">
                            <span className="flex items-center" style={{ color: INK }}>
                              Revenue less the cost lines, against operating profit
                              <Hint label="What this subtraction catches">
                                <p>
                                  A large gap means the source has not returned every operating cost. The model
                                  carries the difference on its own reconciling line rather than letting it inflate
                                  operating profit. Neither this nor the row below is a judgement: both are
                                  subtractions you could do on the filing yourself.
                                </p>
                              </Hint>
                            </span>
                          </td>
                          {checks.map((c) => {
                            const big =
                              c.operatingGap !== null &&
                              c.operatingIncome !== null &&
                              Math.abs(c.operatingIncome) > 0 &&
                              Math.abs(c.operatingGap) / Math.abs(c.operatingIncome) > 0.05;
                            return (
                              <td key={c.year} className="mg-fig" style={{ color: big ? RED_TEXT : READ }}>
                                {fmt(c.operatingGap)}
                              </td>
                            );
                          })}
                        </tr>
                        <tr className="mg-row">
                          <td className="mg-name">
                            <span className="flex items-center" style={{ color: INK }}>
                              Total assets, against liabilities plus equity
                              <Hint label="What this subtraction catches">
                                <p>
                                  Zero on a complete balance sheet. Anything else means one of the three totals did
                                  not come back.
                                </p>
                              </Hint>
                            </span>
                          </td>
                          {checks.map((c) => {
                            const big =
                              c.balanceGap !== null &&
                              c.totalAssets !== null &&
                              Math.abs(c.totalAssets) > 0 &&
                              Math.abs(c.balanceGap) / Math.abs(c.totalAssets) > 0.01;
                            return (
                              <td key={c.year} className="mg-fig" style={{ color: big ? RED_TEXT : READ }}>
                                {fmt(c.balanceGap)}
                              </td>
                            );
                          })}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
                {open && s.key === 'bridge' && (
                  <div className="overflow-x-auto pb-6">
                    <table className="mg-table" style={{ minWidth: 560 }}>
                      <thead className="mg-head">
                        <tr>
                          <th className="mg-th-line">
                            <span className="flex items-center">
                              Line
                              <Hint label="What is in this bridge and what is not">
                                <p style={{ marginBottom: 6 }}>
                                  <strong style={{ color: INK, fontWeight: 600 }}>In:</strong> filed operating
                                  profit, filed depreciation added back, every figure you replaced, and every line
                                  you put under the one-offs head.
                                </p>
                                <p style={{ marginBottom: 6 }}>
                                  <strong style={{ color: INK, fontWeight: 600 }}>Not in:</strong> stock-based
                                  compensation, which stays a cost — this is EBITDA, not EBITDA before
                                  share-based pay, because the peer multiples on this site are computed that way
                                  and pay settled in shares is still pay. Nor any normalisation nobody has filed
                                  a figure for.
                                </p>
                                <p>
                                  The D&amp;A add-back is not an adjustment: it is what makes this EBITDA rather
                                  than operating profit. Depreciation cannot be moved to another head, because the
                                  money already sits inside the filed cost lines and moving it would classify the
                                  same money twice.
                                </p>
                              </Hint>
                            </span>
                          </th>
                          {bridge.years.map((y) => (
                            <th key={y} className="mg-fig mg-th-year">
                              FY{y}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="mg-row">
                          <td className="mg-name" style={{ color: INK }}>Operating profit, as filed</td>
                          {bridge.operatingProfitFiled.map((v, i) => (
                            <td key={i} className="mg-fig">{fmt(v)}</td>
                          ))}
                        </tr>
                        <tr className="mg-row">
                          <td className="mg-name" style={{ color: INK }}>Plus: depreciation and amortisation</td>
                          {bridge.depreciationAddedBack.map((v, i) => (
                            <td key={i} className="mg-fig">
                              {v === null ? <span style={{ color: DIM }}>none filed</span> : fmt(v)}
                            </td>
                          ))}
                        </tr>
                        <tr className="mg-grouprow">
                          <td>Reported EBITDA</td>
                          {bridge.reportedEbitda.map((v, i) => (
                            <td key={i} className="mg-fig" data-bridge-reported={bridge.years[i]}>
                              {fmt(v)}
                            </td>
                          ))}
                        </tr>
                        {[...bridge.corrections, ...bridge.oneOffs].map((a) => (
                          <React.Fragment key={a.key}>
                            <tr className="mg-row">
                              <td className="mg-name">
                                <span className="flex items-center" style={{ color: RED_TEXT }}>
                                  {a.kind === 'correction' ? 'Correction' : 'One-off'} · {a.label}
                                  <Hint label={`What ${a.label} did`}>
                                    <p>
                                      {a.detail}.{' '}
                                      {a.yearsMoved === 1
                                        ? 'It moves EBITDA in one reported year only.'
                                        : `It moves EBITDA in ${a.yearsMoved} of the ${bridge.years.length} reported years.`}
                                    </p>
                                  </Hint>
                                </span>
                              </td>
                              {a.byYear.map((v, i) => (
                                <td key={i} className="mg-fig" style={{ color: RED_TEXT }}>
                                  {v === null ? '—' : v === 0 ? '0' : `${v > 0 ? '+' : ''}${fmt(v)}`}
                                </td>
                              ))}
                            </tr>
                            <tr className="mg-reasonrow">
                              <td colSpan={1 + bridge.years.length}>
                                <input
                                  id={`adj-${a.key}`}
                                  data-adjustment={a.key}
                                  value={a.reason}
                                  onChange={(e) => setAdjustmentReason(a.key, e.target.value)}
                                  placeholder="Add a reason (optional)"
                                  maxLength={200}
                                  className="mg-reason"
                                />
                              </td>
                            </tr>
                          </React.Fragment>
                        ))}
                        <tr className="mg-grouprow">
                          <td>
                            Adjusted EBITDA
                            {/* A BRIDGE WITH NOTHING ON IT SAYS SO rather than
                                printing the reported figure twice and leaving a
                                reader to wonder whether their change was
                                ignored or had no effect. */}
                            {!bridge.adjusted && (
                              <span style={{ color: DIM, fontWeight: 400 }}>
                                {' '}— you have made no adjustments, so this is the reported figure
                              </span>
                            )}
                          </td>
                          {bridge.adjustedEbitda.map((v, i) => (
                            <td key={i} className="mg-fig">{fmt(v)}</td>
                          ))}
                        </tr>
                        <tr className="mg-row">
                          <td className="mg-name">
                            <span className="flex items-center" style={{ color: MUTED }}>
                              Adjusted, less reported and every adjustment
                              <Hint label="What this tie proves">
                                <p>Nil in every year, or the bridge does not add up.</p>
                              </Hint>
                            </span>
                          </td>
                          {bridge.tie.map((v, i) => (
                            <td
                              key={i}
                              className="mg-fig"
                              data-bridge-tie={bridge.years[i]}
                              style={{ color: v === null || Math.abs(v) < 0.05 ? MUTED : RED_TEXT }}
                            >
                              {fmt(v)}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                    {bridge.neutral.length > 0 && (
                      <p className="mt-3" style={{ fontSize: 13, color: DIM, maxWidth: 640 }}>
                        Corrections that cannot move EBITDA, listed rather than left out:{' '}
                        {bridge.neutral.map((n) => n.label).join(', ')}. Reported operating profit is anchored to
                        the filed figure, so these change what the costs are called and not what the company
                        earned.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          <div className="border-t" style={{ borderColor: LINE }} />
        </div>

        <div className="mt-10">
          <button onClick={onBack} className="mg-link" style={{ color: MUTED, textDecoration: 'none' }}>
            ←&nbsp;&nbsp;{returning ? 'Back to the model, leaving these figures alone' : 'Back to the search'}
          </button>
        </div>
      </div>

      {/* The standing bar: the way on. The count lives at the top now, beside
          the reset, where a reader looks for it. */}
      <div
        ref={bar.ref}
        className="fixed bottom-0 inset-x-0 z-40 border-t backdrop-blur-md"
        style={{
          background: 'rgba(17,17,20,0.96)',
          borderColor: LINE,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <div className="max-w-[1180px] mx-auto px-6 sm:px-10 lg:px-14 py-3 flex items-center justify-between gap-6 flex-wrap">
          <span style={{ fontSize: 13, color: changed || moved ? RED_TEXT : MUTED }}>
            {changed === 0 && moved === 0
              ? 'Every figure as filed, every line on its default head'
              : 'The model will be badged with what you changed'}
          </span>
          <button
            type="button"
            onClick={onContinue}
            disabled={building}
            className="flex items-center gap-2 disabled:opacity-50"
            style={{
              fontSize: 14,
              padding: '8px 18px',
              border: `1px solid ${RED}`,
              background: 'rgba(139,30,30,0.22)',
              color: INK,
              cursor: 'pointer',
            }}
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
  );
};

export default FiguresEditor;
