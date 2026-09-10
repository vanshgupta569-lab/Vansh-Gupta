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
import { ArrowRight, RotateCcw } from 'lucide-react';
import {
  Corrections,
  FIELDS,
  GROUPS,
  correctionCount,
  yearChecks,
} from '../data/corrections';

const RED = '#8B1E1E';
const RED_TEXT = '#C0453E';
const INK = '#F2F0EA';
const READ = '#C6C1B7';
const MUTED = '#A8A29A';
const DIM = '#6B6759';
const LINE = '#262521';
const PANEL = '#111114';

const DISPLAY: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 800,
  letterSpacing: '-0.045em',
  lineHeight: 0.98,
};

const Square: React.FC = () => (
  <>
    {'⁠'}
    <span
      className="inline-block align-baseline"
      style={{
        width: '0.13em',
        height: '0.13em',
        background: RED,
        marginLeft: '0.08em',
        marginRight: '-0.21em',
      }}
    />
  </>
);

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
const show = (v: any, count?: boolean): string => {
  if (typeof v !== 'number' || !isFinite(v)) return '—';
  if (count) return Math.round(v).toLocaleString('en-IN');
  // A balance check that comes out at floating-point noise is zero. Printing
  // it as "-0.0" makes arithmetic that worked look like arithmetic that did
  // not.
  if (Math.abs(v) < 0.05) return '0';
  const abs = Math.abs(v);
  return v.toLocaleString('en-IN', {
    minimumFractionDigits: abs < 100 ? 1 : 0,
    maximumFractionDigits: abs < 100 ? 1 : 0,
  });
};

interface Props {
  ticker: string;
  name: string;
  source: string;
  sourceUrl?: string | null;
  currencySymbol: string;
  /** The payload exactly as the fetcher returned it. Never mutated. */
  statements: any[];
  corrections: Corrections;
  onChange: (next: Corrections) => void;
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
  statements,
  corrections,
  onChange,
  onContinue,
  onBack,
  returning,
  building,
}) => {
  const [openGroup, setOpenGroup] = useState<string>('income');

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

  return (
    <div className="min-h-screen" style={{ background: '#0B0B0D' }}>
      <div className="max-w-[1380px] mx-auto px-6 sm:px-10 lg:px-16 pt-28 lg:pt-32 pb-40">
        <div className="text-center">
          <Eyebrow centred>Before the model is built</Eyebrow>
          <h1
            className="text-[32px] sm:text-[44px] lg:text-[56px] mx-auto max-w-[24ch]"
            style={{ ...DISPLAY, color: INK }}
          >
            Read the figures before the model does
            <Square />
          </h1>
          <p
            className="text-[17px] lg:text-[19px] leading-[1.6] mt-7 mx-auto max-w-[62ch]"
            style={{ color: READ }}
          >
            These are the figures {name} was returned with, from {source}. They are
            what the whole model is built on, so anything wrong here is wrong
            everywhere. Change any of them to what the annual report says, or
            leave every one alone and carry on.
            {returning && (
              <>
                {' '}
                Anything you changed before is still marked, with the filed figure
                beside it — put one back, change it again, or reset the lot.
              </>
            )}
          </p>
          <p
            className="font-mono text-[12px] leading-[1.6] mt-5 mx-auto max-w-[74ch]"
            style={{ color: MUTED }}
          >
            Nothing is uploaded, nothing is stored and nothing leaves this browser
            tab. A correction is remembered for as long as the tab is open, and the
            filed figure is kept beside it the whole time.
            {sourceUrl ? (
              <>
                {'  '}
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4"
                  style={{ color: RED_TEXT }}
                >
                  Open the filings
                </a>
              </>
            ) : null}
          </p>
        </div>

        {/* The three states, said once, plainly, before anything is editable. */}
        <div
          className="grid grid-cols-1 md:grid-cols-3 gap-px mt-12 lg:mt-16"
          style={{ background: LINE }}
        >
          {[
            ['Reported', 'What the source filed. Left alone unless you change it.'],
            ['Corrected', 'A figure you supplied. Marked, with the filed one still shown beside it.'],
            ['Modelled', 'Anything the engine works out. None of it is on this screen.'],
          ].map(([title, line]) => (
            <div key={title} className="p-6" style={{ background: PANEL }}>
              <div className="font-mono text-[11px] uppercase tracking-[0.2em] mb-3" style={{ color: RED_TEXT }}>
                {title}
              </div>
              <div className="text-[15px] leading-[1.55]" style={{ color: MUTED }}>
                {line}
              </div>
            </div>
          ))}
        </div>

        {/* ---------------------------------------------------------- */}
        {/* The statements                                              */}
        {/* ---------------------------------------------------------- */}
        <div className="mt-14 lg:mt-20">
          <div className="flex items-baseline justify-between gap-6 flex-wrap mb-6">
            <h2 className="text-[24px] lg:text-[30px]" style={{ ...DISPLAY, color: INK }}>
              {ticker} as filed
              <Square />
            </h2>
            <div className="font-mono text-[12px]" style={{ color: MUTED }}>
              Figures in millions of {currencySymbol} unless the row says otherwise
            </div>
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
                            Line
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
                                    value={
                                      typeof value === 'number' && isFinite(value)
                                        ? String(value)
                                        : ''
                                    }
                                    placeholder="—"
                                    onChange={(e) => setCell(y, f.key, e.target.value)}
                                    className="w-full font-mono text-[14px] text-right px-2 py-1.5 outline-none border transition-colors focus:border-[#8B1E1E]"
                                    style={{
                                      background: dirty ? 'rgba(139,30,30,0.10)' : 'transparent',
                                      borderColor: dirty ? RED : 'transparent',
                                      color: dirty ? INK : READ,
                                    }}
                                  />
                                  {dirty && (
                                    <div className="flex items-center justify-end gap-2 mt-1.5">
                                      <span className="font-mono text-[11px]" style={{ color: DIM }}>
                                        filed {show(original, f.count)}
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
                          {show(c.operatingGap)}
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
                          {show(c.balanceGap)}
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
        className="fixed bottom-0 inset-x-0 z-40 border-t backdrop-blur-md"
        style={{ background: 'rgba(17,17,20,0.96)', borderColor: LINE }}
      >
        <div className="max-w-[1380px] mx-auto px-6 sm:px-10 lg:px-16 py-4 flex items-center justify-between gap-6 flex-wrap">
          <div className="font-mono text-[12px]" style={{ color: changed ? RED_TEXT : MUTED }}>
            {changed === 0
              ? 'Every figure as filed'
              : `${changed} figure${changed === 1 ? '' : 's'} corrected — the model will be badged`}
          </div>
          <div className="flex items-center gap-3">
            {changed > 0 && (
              <button
                type="button"
                onClick={resetAll}
                className="font-mono text-[11px] uppercase tracking-[0.16em] px-4 py-3 border bg-transparent transition-colors hover:border-[#8B1E1E]"
                style={{ borderColor: LINE, color: MUTED }}
              >
                Reset to as filed
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
                ? changed
                  ? 'Rebuild with these figures'
                  : 'Rebuild as filed'
                : changed
                ? 'Build with these figures'
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
