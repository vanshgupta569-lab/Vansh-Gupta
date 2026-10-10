// FILE: src/components/figuresEditor.tsx
//
// Marginalia — check the figures before the model is built
//
// This screen sits between the search and the questions, and it exists because
// the data is the weakest part of the site. It shows every figure the source
// returned, in the order a person reads a set of accounts, and lets any of them
// be replaced with what the annual report actually says.
//
// THE THREE STATES, KEPT VISIBLY APART
//
//   Reported   what the source filed. Plain type.
//   Corrected  what the reader supplied. Marked, with the filed figure still
//              printed beside it in grey, and one click to put it back.
//   Modelled   anything the engine computes. Not on this screen at all.
//
// The site's whole promise rests on the first two never being confused, so a
// corrected figure is never shown on its own: the original travels with it.
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
import { ArrowRight, RotateCcw, Pencil } from 'lucide-react';
import {
  Corrections,
  FIELDS,
  GROUPS,
  correctionCount,
  yearChecks,
} from '../data/corrections';
import {
  CATEGORIES,
  CATEGORY_BY_KEY,
  type Category,
  type Classification,
  categoryOf,
  classifiableFor,
  isOverridden,
  lineAmounts,
  overrideCount,
  reasonOf,
  subtotals,
} from '../data/classification';
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
  /** The reader's treatment of each reported expense line. */
  classification: Classification;
  onClassify: (next: Classification) => void;
  /**
   * The payload itself, so a classification can be REBUILT here rather than
   * described: the judgement layer's rule is that a change rebuilds the model
   * immediately with the previous value still beside it, and on this screen
   * there is no model yet to rebuild unless this screen builds one.
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
  classification,
  onClassify,
  payload,
  onContinue,
  onBack,
  returning,
  building,
}) => {
  const [openGroup, setOpenGroup] = useState<string>('income');
  /* Which cell the cursor is in. A figure is grouped and rounded while it is
     being read and shown raw the moment it is being edited: 988107.1270000001
     is the truth, but it is not a number anybody can read down a column, and
     rounding what somebody is halfway through typing is worse. */
  const [editing, setEditing] = useState<string>('');

  /* Digit grouping belongs to the company, not to the reader. An Indian filing
     reads in lakh and crore; a dollar filing does not, and printing 3,91,035
     for a US figure is simply wrong. */
  const locale =
    currency === 'INR' || currencySymbol === '\u20b9' ? 'en-IN' : 'en-US';
  const fmt = (v: any, count?: boolean) => show(v, count, locale);

  const years = useMemo(() => statements.map((s) => String(s.fiscalYear)), [statements]);
  const changed = correctionCount(corrections);

  /* The checks run on what the model will actually be built from, so they
     respond as the reader types. */
  const patched = useMemo(
    () =>
      statements.map((row) => {
        const patch = corrections[String(row.fiscalYear)];
        return patch ? { ...row, ...patch } : row;
      }),
    [statements, corrections]
  );
  const checks = useMemo(() => yearChecks(patched), [patched]);

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
  // THE JUDGEMENT LAYER: HOW EACH COST IS TREATED
  // ------------------------------------------------------------------------
  // Lines the filing reports nothing on are not offered: five buttons against
  // an absence is invented work, not a judgement.
  const lines = useMemo(() => classifiableFor(patched), [patched]);
  const amountsByYear = useMemo(() => lineAmounts(patched), [patched]);
  const classified = useMemo(() => subtotals(patched, classification), [patched, classification]);
  const reclassified = overrideCount(classification);

  const setCategory = (key: string, category: Category) => {
    const next: Classification = { ...classification };
    const existing = next[key];
    next[key] = { category, ...(existing?.reason ? { reason: existing.reason } : {}) };
    onClassify(next);
  };
  const setReason = (key: string, reason: string) => {
    const next: Classification = { ...classification };
    const category = categoryOf(key, classification);
    if (!reason.trim() && !isOverridden(key, classification)) delete next[key];
    else next[key] = { category, ...(reason.trim() ? { reason } : {}) };
    onClassify(next);
  };
  /** The visible return to default, which is rule three. */
  const toDefault = (key: string) => {
    const next: Classification = { ...classification };
    delete next[key];
    onClassify(next);
  };
  const classificationToDefaults = () => onClassify({});

  // THE MODEL IS REBUILT HERE, NOT DESCRIBED.
  //
  // Rule four of the judgement layer: a change rebuilds the model immediately
  // with the previous value still visible beside it. `now` is the value on the
  // reader's judgements; `onDefaults` is the engine's own, kept on screen
  // beside it for as long as anything is overridden. Both run the whole chain,
  // because scaling one answer into the other would be our judgement sitting
  // on top of theirs.
  const valueNow = useMemo(
    () => (payload && reclassified ? valueUnder(payload, corrections, classification) : null),
    [payload, corrections, classification, reclassified]
  );
  const valueOnDefaults = useMemo(
    () => (payload && reclassified ? valueUnder(payload, corrections, {}) : null),
    [payload, corrections, reclassified]
  );

  // The standing bar is painted over this page, so the page is told how tall
  // it actually is rather than guessing. See useBottomBarInset.
  const bar = useBottomBarInset();

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
      `}</style>
      <div className="max-w-[1380px] mx-auto px-6 sm:px-10 lg:px-16 pt-20 lg:pt-24 pb-16">
        {/* ==================================================================
            WHAT THIS SCREEN IS, IN THE SPACE IT DESERVES.

            It opened with a 56px centred headline, two paragraphs running to
            62 and 74 characters, and three definition cards in a full-width
            grid — roughly a screen and a half before the first figure. The
            figures are the screen. A reader who came here to check what the
            source returned had to scroll past an essay to reach them, every
            time, including the second and third visit.

            The headline stays, smaller and left-aligned; one line says what to
            do; and the two explanations that were paragraphs are disclosures
            above the table rather than a wall in front of it.
            ================================================================== */}
        <Eyebrow>Before the model is built</Eyebrow>
        <h1
          /* The Screen Title step (DESIGN.md): one clamp, not three
             breakpoint literals, for the same reason the hero figure is one. */
          className="text-[clamp(27px,3.2vw,40px)] max-w-[22ch]"
          style={{ ...DISPLAY, color: INK }}
        >
          Read the figures before the model does
          <Mark />
        </h1>
        <p className="text-[16px] leading-[1.6] mt-4 max-w-[70ch]" style={{ color: READ }}>
          These are the figures {name} was returned with, from {source}, and the whole model is
          built on them. Change anything the annual report contradicts, or leave every one alone
          and carry on.
          {returning && (
            <>
              {' '}
              Anything you changed before is still marked, with the filed figure beside it.
            </>
          )}
        </p>

        {/* A closing rule under the last one: Disclose draws its own rule
            ABOVE each row, so a stack of them ends on open air and reads as
            though a third row failed to render. */}
        <div className="mt-6 max-w-[70ch] border-b" style={{ borderColor: LINE }}>
          <Disclose
            summary="What the three states mean"
            trailing="reported · corrected · modelled"
          >
            <dl className="space-y-3">
              {[
                ['Reported', 'What the source filed. Left alone unless you change it.'],
                ['Corrected', 'A figure you supplied. Marked, with the filed one still shown beside it.'],
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

          <Disclose summary="What happens to a correction">
            <p className="max-w-prose">
              Nothing is uploaded, nothing is stored and nothing leaves this browser tab. A
              correction is remembered for as long as the tab is open, and the filed figure is kept
              beside it the whole time.
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
        {/* The statements                                              */}
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

          {/* THE ONE THING THAT IS NOT EXPLANATION. A reader who has to guess
              whether a table is editable assumes it is not, so this stays
              visible — but as a single line against a hairline rather than the
              three-line filled callout it was. */}
          <div
            className="flex items-center gap-2.5 border-t border-b py-2.5 mb-6"
            style={{ borderColor: LINE }}
          >
            <Pencil className="w-3.5 h-3.5 shrink-0" style={{ color: RED_TEXT }} />
            <p className={UI} style={{ color: READ }}>
              <span style={{ color: INK, fontWeight: 600 }}>Every figure below can be changed.</span>{' '}
              Click one and type over it; an empty box puts the original back.
            </p>
          </div>

          {GROUPS.map((group) => {
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
                  <span className="font-mono text-[11px] uppercase tracking-[0.18em] shrink-0" style={{ color: groupChanged ? RED_TEXT : DIM }}>
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

        {/* ==================================================================
            BETWEEN REPORTED AND MODELLED: HOW EACH COST IS TREATED.

            The first piece of the judgement layer (ROADMAP.md section 2). It
            sits here, between the filed figures above and the model that has
            not been built yet, because that is what it is: a reading of the
            filing, not a setting on a finished model. Putting it in a panel on
            the analysis screen would make it something a reader finds after
            the value has already anchored them.
            ================================================================== */}
        {lines.length > 0 && (
          <div className="mt-16 lg:mt-20">
            <Eyebrow>Between reported and modelled</Eyebrow>
            <h2 className="text-[clamp(22px,2.4vw,30px)] max-w-[26ch]" style={{ ...DISPLAY, color: INK }}>
              Say how each cost is treated
              <Mark />
            </h2>
            <p className="text-[16px] leading-[1.6] mt-4 max-w-[70ch]" style={{ color: READ }}>
              A filing gives a carpentry expense. Whether it is a direct cost or an overhead is a
              judgement, and until you make it the model makes it for you — by whichever tag the
              source happened to file the figure under. Every line below carries the engine’s
              treatment as its default, and the default says where it came from.
            </p>

            <div className="mt-6 max-w-[70ch] border-b" style={{ borderColor: LINE }}>
              <Disclose summary="What moving a line does, and does not do" trailing="measured">
                <p className="max-w-prose">
                  Operating profit is the sum of these lines, and addition does not care what the
                  terms are called. So moving a line between direct, indirect, selling and
                  administrative changes gross profit and the subtotals below it and cannot change
                  operating profit — not in a reported year and not in a forecast year. On
                  Reliance, two such moves leave value per share at the same 706.52.
                </p>
                <p className="max-w-prose mt-2">
                  Excluding a line as non-recurring is the one choice here that moves money: it is
                  nil in every forecast year, so the forecast margin rises. Excluding Reliance’s
                  other operating costs takes it from 706.52 to 1,683.09. Reported years never move:
                  reported operating profit ties to the filing whatever you choose, and the tie is
                  the last row of the table below.
                </p>
              </Disclose>
              <Disclose summary="What the five categories mean">
                <dl className="space-y-3">
                  {CATEGORIES.map((c) => (
                    <div key={c.key} className="flex flex-wrap gap-x-3">
                      <dt className={`${EYEBROW} shrink-0 pt-0.5`} style={{ color: RED_TEXT, minWidth: '9.5rem' }}>
                        {c.short}
                      </dt>
                      <dd className="flex-1 min-w-[16rem]" style={{ color: READ }}>
                        {c.definition}
                      </dd>
                    </div>
                  ))}
                </dl>
              </Disclose>
            </div>

            {/* ---- one line, one judgement ---- */}
            <div className="mt-8">
              {lines.map((line) => {
                const chosen = categoryOf(line.key, classification);
                const moved = isOverridden(line.key, classification);
                const options = CATEGORIES.filter((c) => c.key !== 'excluded' || line.excludable);
                const lastYear = classified[classified.length - 1];
                const amount = amountsByYear[amountsByYear.length - 1]?.amounts[line.key] ?? null;
                const share = amount !== null && lastYear?.revenue ? amount / (lastYear.revenue as number) : null;
                return (
                  <div
                    key={line.key}
                    /* Named so the browser check can find one line's controls
                       without matching the correction table's row of the same
                       name two sections above it. */
                    data-line={line.key}
                    className="border-t py-6"
                    style={{ borderColor: LINE }}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
                      <div className="min-w-0">
                        <span className="text-[17px]" style={{ color: INK }}>
                          {line.label}
                        </span>
                        <span className="font-mono text-[13px] ml-3" style={{ color: MUTED }}>
                          FY{years[years.length - 1]} {fmt(amount)}
                          {share !== null ? ` · ${(share * 100).toFixed(1)}% of revenue` : ''}
                        </span>
                      </div>
                      {/* THE DEFAULT TREATMENT STAYS BESIDE THE READER'S, the same
                          way a corrected figure keeps the filed one. */}
                      <span
                        className="font-mono text-[11px] uppercase tracking-[0.16em] shrink-0"
                        style={{ color: moved ? RED_TEXT : DIM }}
                      >
                        {moved
                          ? `yours · default was ${CATEGORY_BY_KEY[line.defaultCategory].short}`
                          : 'on the default'}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-3.5">
                      {options.map((c) => {
                        const on = c.key === chosen;
                        return (
                          <button
                            key={c.key}
                            type="button"
                            onClick={() => setCategory(line.key, c.key)}
                            title={c.definition}
                            aria-pressed={on}
                            className="font-mono text-[11px] uppercase tracking-[0.14em] px-3 py-2 border transition-colors cursor-pointer"
                            style={
                              on
                                ? { borderColor: RED, background: 'rgba(139,30,30,0.22)', color: INK }
                                : { borderColor: LINE, background: 'transparent', color: MUTED }
                            }
                          >
                            {c.short}
                            {c.key === line.defaultCategory && (
                              <span className="ml-2" style={{ color: on ? RED_TEXT : DIM }}>
                                default
                              </span>
                            )}
                          </button>
                        );
                      })}
                      {moved && (
                        <button
                          type="button"
                          onClick={() => toDefault(line.key)}
                          title={`Put ${line.label} back on the engine's default`}
                          className="font-mono text-[11px] uppercase tracking-[0.14em] px-3 py-2 flex items-center gap-2 cursor-pointer"
                          style={{ color: RED_TEXT }}
                        >
                          <RotateCcw className="w-3 h-3" />
                          Back to the default
                        </button>
                      )}
                    </div>

                    <div className="mt-3 text-[13px] leading-[1.55] max-w-[76ch]" style={{ color: DIM }}>
                      <span style={{ color: MUTED }}>
                        The default is {CATEGORY_BY_KEY[line.defaultCategory].label.toLowerCase()}.
                      </span>{' '}
                      {line.defaultBasis}
                      {!line.excludable && line.notExcludableBecause ? ` ${line.notExcludableBecause}` : ''}
                    </div>

                    {/* EVERY OVERRIDE TAKES AN OPTIONAL ONE-LINE REASON, which is
                        rule two. Optional on purpose: a reason nobody can skip is
                        a reason nobody reads. */}
                    {moved && (
                      <div className="mt-3.5 flex flex-wrap items-center gap-3">
                        <label
                          className="font-mono text-[11px] uppercase tracking-[0.16em] shrink-0"
                          htmlFor={`why-${line.key}`}
                          style={{ color: DIM }}
                        >
                          Why
                        </label>
                        <input
                          id={`why-${line.key}`}
                          value={reasonOf(line.key, classification)}
                          onChange={(e) => setReason(line.key, e.target.value)}
                          placeholder="One line, optional — it travels with the workbook"
                          maxLength={200}
                          className="mg-cell flex-1 min-w-[18rem] font-sans text-[14px] px-2.5 py-2 outline-none transition-colors"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="border-t" style={{ borderColor: LINE }} />
            </div>

            {/* ---- what the classification makes of each reported year ---- */}
            <div className="mt-10 overflow-x-auto">
              <table className="w-full border-collapse" style={{ minWidth: 640 }}>
                <thead>
                  <tr>
                    <th
                      className="text-left font-mono text-[11px] uppercase tracking-[0.18em] pb-3 pr-6"
                      style={{ color: DIM, minWidth: 280 }}
                    >
                      As you have classified them
                    </th>
                    {classified.map((c) => (
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
                  <tr className="border-t" style={{ borderColor: LINE }}>
                    <td className="py-2.5 pr-6 text-[15px]" style={{ color: INK }}>
                      Revenue
                    </td>
                    {classified.map((c) => (
                      <td key={c.year} className="py-2.5 pl-6 text-right font-mono text-[14px]" style={{ color: READ }}>
                        {fmt(c.revenue)}
                      </td>
                    ))}
                  </tr>
                  {CATEGORIES.map((cat) => (
                    <tr key={cat.key}>
                      <td
                        className="py-2.5 pr-6 text-[15px]"
                        style={{ color: cat.key === 'excluded' ? MUTED : INK, paddingLeft: 18 }}
                      >
                        {cat.label}
                      </td>
                      {classified.map((c) => (
                        <td
                          key={c.year}
                          className="py-2.5 pl-6 text-right font-mono text-[14px]"
                          style={{ color: cat.key === 'excluded' ? MUTED : READ }}
                        >
                          {fmt(c.byCategory[cat.key] === 0 ? 0 : -c.byCategory[cat.key])}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr className="border-t" style={{ borderColor: LINE }}>
                    <td className="py-3 pr-6 text-[15px]" style={{ color: INK }}>
                      Gross profit, on your classification
                    </td>
                    {classified.map((c) => (
                      <td key={c.year} className="py-3 pl-6 text-right font-mono text-[14px]" style={{ color: INK }}>
                        {fmt(c.grossProfit)}
                        <div className="font-mono text-[11px] mt-0.5" style={{ color: DIM }}>
                          {c.grossMargin === null ? '' : `${(c.grossMargin * 100).toFixed(1)}%`}
                        </div>
                      </td>
                    ))}
                  </tr>
                  <tr className="border-t" style={{ borderColor: LINE }}>
                    <td className="py-3 pr-6">
                      <div className="text-[15px]" style={{ color: INK }}>
                        Operating profit, as filed
                      </div>
                      <div className="text-[13px] leading-[1.5] mt-1 max-w-[46ch]" style={{ color: DIM }}>
                        The filed figure. It does not move, whatever you classify.
                      </div>
                    </td>
                    {classified.map((c) => (
                      <td key={c.year} className="py-3 pl-6 text-right font-mono text-[14px]" style={{ color: INK }}>
                        {fmt(c.operatingProfitReported)}
                      </td>
                    ))}
                  </tr>
                  {classified.some((c) => c.byCategory.excluded !== 0) && (
                    <tr className="border-t" style={{ borderColor: LINE }}>
                      <td className="py-3 pr-6">
                        <div className="text-[15px]" style={{ color: RED_TEXT }}>
                          Operating profit, with what you excluded set aside
                        </div>
                        <div className="text-[13px] leading-[1.5] mt-1 max-w-[46ch]" style={{ color: DIM }}>
                          Shown beside the filed figure, never instead of it. This is the one the
                          forecast is built from.
                        </div>
                      </td>
                      {classified.map((c) => (
                        <td key={c.year} className="py-3 pl-6 text-right font-mono text-[14px]" style={{ color: RED_TEXT }}>
                          {fmt(c.operatingProfitUnderlying)}
                        </td>
                      ))}
                    </tr>
                  )}
                  <tr className="border-t border-b" style={{ borderColor: LINE }}>
                    <td className="py-3 pr-6">
                      <div className="text-[15px]" style={{ color: INK }}>
                        Filed operating profit, less revenue and every classified cost
                      </div>
                      <div className="text-[13px] leading-[1.5] mt-1 max-w-[46ch]" style={{ color: DIM }}>
                        Nil for every classification. Anything else would mean a line had been
                        counted twice or dropped.
                      </div>
                    </td>
                    {classified.map((c) => (
                      <td key={c.year} className="py-3 pl-6 text-right font-mono text-[14px]" style={{ color: READ }}>
                        {fmt(c.tie)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ---- the model, rebuilt on these judgements ---- */}
            {reclassified > 0 && valueNow && (
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
                        <div className="font-mono text-[11px] uppercase tracking-[0.16em]" style={{ color: DIM }}>
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
                  Built by running the whole chain again — derivation, model, discounted cash
                  flow — on the judgements above, not by scaling the old answer.
                </p>
              </div>
            )}
          </div>
        )}

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
                      cost. The model carries the difference in SG&amp;A rather than
                      letting it inflate operating profit.
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

        <div className="mt-16">
          <button
            onClick={onBack}
            className="font-mono text-[11px] uppercase tracking-[0.18em] transition-colors cursor-pointer"
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
          {/* BOTH JUDGEMENTS, COUNTED SEPARATELY. A figure corrected and a cost
              line classified are different claims about the model, and one
              number covering both would hide whichever the reader did not make. */}
          <div className="font-mono text-[12px]" style={{ color: changed || reclassified ? RED_TEXT : MUTED }}>
            {changed === 0 && reclassified === 0
              ? 'Every figure as filed, every cost on the default treatment'
              : [
                  changed ? `${changed} figure${changed === 1 ? '' : 's'} corrected` : '',
                  reclassified ? `${reclassified} cost line${reclassified === 1 ? '' : 's'} classified` : '',
                ]
                  .filter(Boolean)
                  .join(' · ') + ' — the model will be badged'}
          </div>
          <div className="flex items-center gap-3">
            {(changed > 0 || reclassified > 0) && (
              <button
                type="button"
                onClick={() => {
                  resetAll();
                  classificationToDefaults();
                }}
                className="font-mono text-[11px] uppercase tracking-[0.16em] px-4 py-3 border bg-transparent transition-colors hover:border-[#8B1E1E]"
                style={{ borderColor: LINE, color: MUTED }}
              >
                {changed && reclassified
                  ? 'Reset the figures and the treatments'
                  : reclassified
                    ? 'Back to the default treatments'
                    : 'Reset to as filed'}
              </button>
            )}
            <button
              type="button"
              onClick={onContinue}
              disabled={building}
              className="font-mono text-[11px] uppercase tracking-[0.16em] px-6 py-3 border flex items-center gap-2 disabled:opacity-50"
              style={{ borderColor: RED, background: 'rgba(139,30,30,0.22)', color: INK }}
            >
              {building
                ? 'Building the model…'
                : returning
                ? changed || reclassified
                  ? 'Rebuild with these judgements'
                  : 'Rebuild as filed'
                : changed || reclassified
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
