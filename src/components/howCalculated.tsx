// FILE: src/components/howCalculated.tsx
//
// Marginalia — how this was calculated
//
// This section has one job: take somebody who has never valued a company and
// leave them understanding where the number at the top of the page came from.
//
// It is NOT the audit trail. That lives in the four full-screen models under
// "For the nerds", where every figure can be read and moved. Trying to be both
// is what made the earlier version eight steps long and dense with figures.
//
// So the rules for everything below:
//
//   1. The idea comes first, in the plainest words available, with an everyday
//      example wherever one exists. Nobody learns discounting from a formula.
//   2. Figures appear only where they make the idea land. Roughly three per
//      approach, not forty. But NOT zero: "everything after year five is 71% of
//      this company's value" teaches, "the terminal value is usually large"
//      does not. Every figure shown is read from the same run that produced
//      the headline, so the explanation can never drift from the answer.
//   3. At rest the whole section is a paragraph, three cards and four closed
//      headings. Almost nothing is open, so it cannot feel cluttered.
//   4. One level of collapsing only. Inside a group the steps read straight
//      through like an article, because a second click to reach a paragraph is
//      a click nobody makes.

import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { DCFResult, ValuationDrivers } from '../types';
import type { MarketApproachResult } from '../data/marketApproach';
import type { AssetApproachResult } from '../data/assetApproach';
import { RECOVERY_PRESETS } from '../data/assetApproach';

interface HowCalculatedProps {
  source: any;
  dcfResult: DCFResult;
  drivers: ValuationDrivers;
  defaults: ValuationDrivers;
  currencySymbol: string;
  unitLabel: string;
  companyName: string;
  isDerived: boolean;
  sourceLabel: string;
  methods?: { label: string; value: number }[];
  blendedValue?: number | null;
  marketApproach?: MarketApproachResult | null;
  assetApproach?: AssetApproachResult | null;
  /** Which set of recovery rates the liquidation figure is using. */
  recoveryKey?: 'forcedSale' | 'orderly';
  onRecoveryKey?: (key: 'forcedSale' | 'orderly') => void;
}

const isNum = (v: any): v is number => typeof v === 'number' && isFinite(v);

// A figure with its label. Deliberately plain: this is a teaching aid, not a
// schedule.
const Figure: React.FC<{ label: string; value: string; note?: string }> = ({
  label,
  value,
  note,
}) => (
  <div className="flex items-baseline justify-between gap-4 py-2 border-b border-[#222228]/60 last:border-0">
    <span className="text-[14px] text-[#8A8A8F] leading-snug">
      {label}
      {note ? (
        <span className="block text-[12px] text-[#8A8A8F]/80 mt-0.5">{note}</span>
      ) : null}
    </span>
    <span className="font-mono text-[15px] text-[#F2F0EA] text-right tabular-nums shrink-0">
      {value}
    </span>
  </div>
);

export const HowCalculated: React.FC<HowCalculatedProps> = ({
  source,
  dcfResult,
  currencySymbol,
  companyName,
  sourceLabel,
  methods,
  blendedValue,
  marketApproach,
  assetApproach,
  recoveryKey = 'forcedSale',
  onRecoveryKey,
}) => {
  // Every group starts closed. At rest the reader sees a contents page.
  const [openGroups, setOpenGroups] = useState<string[]>([]);
  const toggle = (key: string) =>
    setOpenGroups((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );

  const meta = source?.meta || {};
  const historicalYears: number[] = meta.historicalYears || [];
  const forecastYears: number[] = meta.forecastYears || [];
  const rows = dcfResult?.forecastRows || [];

  const money = (v: any, dp = 0) =>
    isNum(v)
      ? `${currencySymbol}${v.toLocaleString(undefined, {
          minimumFractionDigits: dp,
          maximumFractionDigits: dp,
        })}`
      : '—';
  const perShare = (v: any) => (isNum(v) ? money(v, 2) : '—');
  const pct = (v: any, dp = 0) => (isNum(v) ? `${v.toFixed(dp)}%` : '—');

  const incomeValue = isNum(blendedValue)
    ? blendedValue
    : isNum(dcfResult?.targetPrice)
    ? dcfResult.targetPrice
    : null;
  const marketValue = marketApproach?.available ? marketApproach.mid : null;
  const assetValue = assetApproach?.available ? assetApproach.mid : null;

  // How much of the answer sits beyond the explicit forecast. This is the one
  // number that changes how a reader thinks about a DCF, so it is worth
  // computing carefully rather than describing loosely.
  const pvExplicit = dcfResult?.pvExplicitFCF;
  const pvTerminal = dcfResult?.pvTerminalValue;
  const terminalShare =
    isNum(pvExplicit) && isNum(pvTerminal) && pvExplicit + pvTerminal > 0
      ? (pvTerminal / (pvExplicit + pvTerminal)) * 100
      : null;

  const cards = [
    {
      key: 'income',
      name: 'Income approach',
      question: 'what its future cash is worth today',
      value: incomeValue,
      absent: 'no cash flow model could be built for this company',
    },
    {
      key: 'market',
      name: 'Market approach',
      question: 'what buyers pay for companies like it',
      value: marketValue,
      absent:
        marketApproach?.message ||
        'no comparable companies could be identified',
    },
    {
      key: 'asset',
      name: 'Asset approach',
      question: 'what it owns, less what it owes',
      value: assetValue,
      absent:
        assetApproach?.message ||
        'the balance sheet gives no positive figure for this company',
    },
  ];

  const shown = cards.filter((c) => isNum(c.value));
  const spread =
    shown.length > 1
      ? {
          low: Math.min(...shown.map((c) => c.value as number)),
          high: Math.max(...shown.map((c) => c.value as number)),
        }
      : null;

  // -------------------------------------------------------------------------
  // THE GROUPS
  // -------------------------------------------------------------------------

  type Step = { title: string; body: React.ReactNode; figures?: React.ReactNode };
  type Group = { key: string; title: string; standfirst: string; steps: Step[] };

  const groups: Group[] = [];

  groups.push({
    key: 'source',
    title: 'Where these numbers come from',
    standfirst: 'Before any of the three approaches, the raw material.',
    steps: [
      {
        title: 'Everything starts in the company’s own filings',
        body: (
          <>
            <p>
              No estimate, no broker note, no opinion. Every figure this page
              rests on was published by {companyName} itself and filed with the
              authority that regulates it. For this company the source is{' '}
              {sourceLabel}.
            </p>
            <p>
              That is the reason the site can show you its working. A number you
              can trace back to a filing is a number you can argue with.
            </p>
          </>
        ),
        figures: (
          <>
            <Figure
              label="Years of reported accounts used"
              value={
                historicalYears.length
                  ? `${historicalYears.length} (FY${historicalYears[0]} to FY${
                      historicalYears[historicalYears.length - 1]
                    })`
                  : '—'
              }
            />
            <Figure label="Source" value={sourceLabel} />
          </>
        ),
      },
      {
        title: 'Reported is fact. Forecast is not.',
        body: (
          <>
            <p>
              The past years on this page happened. The future years did not.
              They are produced by rules stated openly: revenue grows at the
              rate it has grown at, margins hold at the last reported year,
              tax stays at the rate actually paid.
            </p>
            <p>
              This is why the site keeps the two visibly apart everywhere, and
              why you can move every one of those rules yourself. A forecast is
              an argument, not a measurement, and you are allowed to disagree
              with it.
            </p>
          </>
        ),
        figures: (
          <Figure
            label="Years forecast"
            value={
              forecastYears.length
                ? `${forecastYears.length} (FY${forecastYears[0]} to FY${
                    forecastYears[forecastYears.length - 1]
                  })`
                : '—'
            }
          />
        ),
      },
    ],
  });

  if (dcfResult?.applicable !== false) {
    const lastRow = rows[rows.length - 1];
    groups.push({
      key: 'income',
      title: 'The income approach, in four steps',
      standfirst: 'What the cash this business will produce is worth today.',
      steps: [
        {
          title: 'The idea',
          body: (
            <>
              <p>
                A hundred rupees in your hand today is worth more than a hundred
                rupees in five years, because today’s hundred can be earning
                something in the meantime. Everyone understands this without
                being taught it.
              </p>
              <p>
                Valuing a company on its income means estimating the cash it
                will produce in each future year, then asking what all of that is
                worth today. Converting future money into today’s money is
                called discounting, and the rate used is the return an investor
                could get elsewhere for taking the same risk.
              </p>
            </>
          ),
        },
        {
          title: 'Working out the cash',
          body: (
            <>
              <p>
                Not profit. Cash. A shop can report a profit and still have
                nothing in the till, because the money went into stock it has not
                sold and a delivery van it had to buy.
              </p>
              <p>
                So the model starts from what the company earns from trading,
                takes off the tax it actually pays, adds back the accounting
                charges that never left the bank, and then takes off what must be
                spent to keep the business standing. What is left is the cash
                genuinely available to whoever owns and lends to the company.
              </p>
            </>
          ),
          figures: lastRow ? (
            <>
              <Figure
                label={`Cash available in FY${lastRow.year}`}
                value={money(lastRow.ufcf)}
                note="the last forecast year, in millions"
              />
              <Figure
                label="Worth today, after discounting"
                value={money(lastRow.pvUfcf)}
                note="the same figure, translated into today's money"
              />
            </>
          ) : undefined,
        },
        {
          title: 'The part most people do not expect',
          body: (
            <>
              <p>
                The model forecasts five years in detail. But the company does
                not close in year five. So one further figure stands in for
                everything that happens afterwards, for ever.
              </p>
              <p>
                For most companies that single figure is the larger half of the
                answer
                {isNum(terminalShare)
                  ? `, and for ${companyName} it is ${terminalShare.toFixed(
                      0
                    )}% of it`
                  : ''}
                . It is worth sitting with that. It means an assumption about
                the distant future carries more weight than everything you can
                actually forecast, which is the honest weakness of this method
                and the reason the site lets you move that assumption and watch
                the answer move.
              </p>
            </>
          ),
          figures: (
            <>
              <Figure
                label="From the five forecast years"
                value={money((pvExplicit ?? 0) * 1000)}
              />
              <Figure
                label="From everything after them"
                value={money((pvTerminal ?? 0) * 1000)}
                note={
                  isNum(terminalShare)
                    ? `${terminalShare.toFixed(0)}% of the total`
                    : undefined
                }
              />
            </>
          ),
        },
        {
          title: 'Turning it into one share',
          body: (
            <>
              <p>
                Adding those together gives what the whole business is worth.
                But some of that belongs to the banks and bondholders, so their
                debt comes off, and the cash in the company goes back on. What
                remains belongs to shareholders. Divide by the number of shares
                and you have a value per share.
              </p>
              <p>
                There are two accepted ways to work out that “everything
                afterwards” figure, and they rarely agree. Rather than pick a
                winner, this page shows both and weights them equally.
              </p>
            </>
          ),
          figures: (
            <>
              <Figure
                label="The whole business is worth"
                value={money((dcfResult.enterpriseValueBillion ?? 0) * 1000)}
              />
              <Figure
                label="Left for shareholders after debts"
                value={money((dcfResult.impliedEquityValueBillion ?? 0) * 1000)}
              />
              {methods && methods.length > 1 ? (
                methods.map((m) => (
                  <Figure
                    key={m.label}
                    label={`One share, ${m.label}`}
                    value={perShare(m.value)}
                  />
                ))
              ) : (
                <Figure label="One share" value={perShare(dcfResult.targetPrice)} />
              )}
              {isNum(blendedValue) && (
                <Figure label="The two, weighted equally" value={perShare(blendedValue)} />
              )}
            </>
          ),
        },
      ],
    });
  }

  groups.push({
    key: 'market',
    title: 'The market approach, in three steps',
    standfirst: 'What buyers are paying today for businesses like this one.',
    steps: [
      {
        title: 'The idea',
        body: (
          <>
            <p>
              You price a flat by looking at what similar flats in the same
              building recently sold for, per square foot. Nobody builds a cash
              flow forecast for a flat. They look at the neighbours.
            </p>
            <p>
              This does the same thing with companies. Find businesses that are
              genuinely alike, see what buyers are paying for each rupee of their
              profit, and apply that to this company’s own profit.
            </p>
          </>
        ),
      },
      {
        title: 'Choosing which companies to compare with',
        body: (
          <>
            <p>
              This is the part that decides whether the answer means anything. A
              peer has to be in the same business, not merely the same
              stock market. Companies in the same industry are used first, the
              same sector only if there are not enough, and a lender is never
              compared with a manufacturer.
            </p>
            <p>
              When nothing suitable is found, the site shows nothing rather than
              a set that would mislead you. That is a deliberate refusal, not a
              failure.
            </p>
          </>
        ),
        figures: marketApproach?.available ? (
          <>
            <Figure
              label="Comparable companies used"
              value={String(marketApproach.peerCount)}
              note={marketApproach.basis ? `matched on ${marketApproach.basis}` : undefined}
            />
          </>
        ) : (
          <Figure label="Comparable companies used" value="none" />
        ),
      },
      {
        title: 'Applying what they trade at',
        body: (
          <>
            <p>
              Take the middle of what those companies trade at, and apply it to
              this company’s own reported figure. The middle rather than the
              average, because one peer on an extreme number would drag an
              average somewhere no company in the set actually sits.
            </p>
            <p>
              One rule matters here. Those multiples are based on profit the
              peers have already reported, so they are applied to profit this
              company has already reported, never to the forecast. Doing
              otherwise counts the same growth twice.
            </p>
          </>
        ),
        figures: marketApproach?.available ? (
          <>
            {marketApproach.usable.slice(0, 2).map((m) => (
              <Figure
                key={m.key}
                label={`${m.label} suggests`}
                value={perShare(m.perShare)}
                note={`peer median ${
                  isNum(m.median) ? m.median.toFixed(1) + 'x' : '—'
                }`}
              />
            ))}
            <Figure
              label="Middle of the market approach"
              value={perShare(marketApproach.mid)}
            />
          </>
        ) : undefined,
      },
    ],
  });

  groups.push({
    key: 'asset',
    title: 'The asset approach, in three steps',
    standfirst: 'What the company owns, once everything it owes is paid.',
    steps: [
      {
        title: 'The idea',
        body: (
          <>
            <p>
              Forget what the business earns. Ask a blunter question: if it
              stopped trading tomorrow, sold everything it owns and paid everyone
              it owes, what would be left for the owners?
            </p>
            <p>
              This is the oldest of the three approaches and the least
              flattering. It is why it is useful. It gives a floor, and a floor
              matters most exactly when the other two methods are struggling,
              which is to say when a company is losing money.
            </p>
          </>
        ),
      },
      {
        title: 'Four ways to read the same balance sheet',
        body: (
          <>
            <p>
              <strong className="text-[#F2F0EA]">Book value</strong> is what the
              accounts say the owners’ share is worth. Everything owned, less
              everything owed.
            </p>
            <p>
              <strong className="text-[#F2F0EA]">Tangible book value</strong> is
              the same with goodwill removed. Goodwill is the premium somebody
              once paid over the value of what they actually bought. In a
              break-up it fetches nothing.
            </p>
            <p>
              <strong className="text-[#F2F0EA]">Net current asset value</strong>{' '}
              is harsher still: only the cash, the debts owed to the company and
              the stock on the shelves count, and every liability comes off. The
              factories are treated as worth zero.
            </p>
            <p>
              <strong className="text-[#F2F0EA]">Liquidation value</strong> puts
              a recovery rate on each kind of asset. Cash fetches all of itself.
              Stock in a hurry fetches perhaps half. You can set those rates
              yourself, and the answer changes enormously depending on whether
              the company is being closed in a panic or wound down in an orderly
              way.
            </p>
          </>
        ),
        figures: assetApproach ? (
          <>
            {assetApproach.measures.map((m) => (
              <Figure
                key={m.key}
                label={m.label}
                value={isNum(m.perShare) ? perShare(m.perShare) : 'not shown'}
                note={m.absentBecause}
              />
            ))}

            {/* The single most useful thing a reader can do in this section:
                flip between the two and watch the last figure change, or
                disappear. It teaches that the answer depends on the question
                far better than a paragraph does. */}
            {onRecoveryKey && (
              <div className="mt-4 pt-3 border-t border-[#222228]">
                <div className="font-mono text-[11px] tracking-[0.18em] text-[#8A8A8F] uppercase mb-2">
                  Liquidation assumes
                </div>
                <div className="flex flex-wrap gap-2">
                  {RECOVERY_PRESETS.map((preset) => (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => onRecoveryKey(preset.key)}
                      className={`font-mono text-[11px] uppercase tracking-wider px-3 py-2 border transition-colors ${
                        recoveryKey === preset.key
                          ? 'border-[#8B1E1E] bg-[#8B1E1E]/15 text-[#F2F0EA]'
                          : 'border-[#222228] text-[#8A8A8F] hover:text-[#F2F0EA] hover:border-[#8A8A8F]'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <div className="text-[12px] leading-snug text-[#8A8A8F] mt-2">
                  {RECOVERY_PRESETS.find((p) => p.key === recoveryKey)?.description}
                </div>
              </div>
            )}
          </>
        ) : undefined,
      },
      {
        title: 'When this tells you something, and when it does not',
        body: (
          <>
            <p>
              {assetApproach?.suitability ||
                'The balance sheet holds part of what makes some companies valuable and almost none of what makes others valuable, so this approach is worth more for some companies than for others.'}
            </p>
            <p>
              A software company’s value is in its people and its code, and
              neither appears on a balance sheet. A steel plant’s value is
              largely the plant. The same four measures are honest for both, and
              informative for only one of them.
            </p>
          </>
        ),
      },
    ],
  });

  if (!dcfResult) return null;

  return (
    <section className="border border-[#222228] bg-[#111114] p-5 sm:p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
        <h2 className="font-serif text-xl sm:text-2xl text-[#F2F0EA]">
          How this was calculated
        </h2>
        <span className="font-mono text-[12px] tracking-[0.2em] text-[#8A8A8F] uppercase">
          04 — the working
        </span>
      </div>

      <p className="text-[15px] leading-relaxed text-[#8A8A8F] max-w-2xl mb-7">
        Valuing a company means estimating what it is worth, which is a
        different question from what it costs on the exchange today. There are
        three accepted ways to answer it, and an analyst uses all three rather
        than choosing one. Here is each of them, in plain words, using{' '}
        {companyName}’s own figures. You do not need to know anything about
        finance to follow it.
      </p>

      {/* The three answers, before a word of theory. Seeing them disagree is
          the single most useful thing a first-time reader can learn. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-[#222228] border border-[#222228] mb-4">
        {cards.map((card) => (
          <div key={card.key} className="bg-[#0B0B0D] p-4 sm:p-5">
            <div className="font-mono text-[11px] tracking-[0.18em] text-[#8A8A8F] uppercase">
              {card.name}
            </div>
            <div className="text-[13px] leading-snug text-[#8A8A8F] mt-1.5 mb-3 min-h-[2.4em]">
              {card.question}
            </div>
            {isNum(card.value) ? (
              <div className="font-mono text-[24px] text-[#F2F0EA] tabular-nums leading-none">
                {perShare(card.value)}
              </div>
            ) : (
              <div className="text-[13px] leading-snug text-[#8A8A8F]">
                not shown, because {card.absent}
              </div>
            )}
          </div>
        ))}
      </div>

      <p className="text-[14px] leading-relaxed text-[#8A8A8F] max-w-2xl mb-7">
        {spread ? (
          <>
            They do not agree, and they are not supposed to. Each answers a
            different question, so the gap between {perShare(spread.low)} and{' '}
            {perShare(spread.high)} is not an error to be averaged away. It is
            the honest range, and it tells you how much of this company’s value
            rests on belief about the future rather than on what is already
            there.
          </>
        ) : (
          <>
            Where an approach cannot be applied to a company it is left out
            rather than filled in. A figure that means nothing is worse than no
            figure.
          </>
        )}
      </p>

      <div className="border-t border-[#222228]">
        {groups.map((group) => {
          const open = openGroups.includes(group.key);
          return (
            <div key={group.key} className="border-b border-[#222228]">
              <button
                type="button"
                onClick={() => toggle(group.key)}
                className="w-full flex items-baseline gap-4 py-4 text-left group"
              >
                <span className="flex-1">
                  <span className="block text-[16px] text-[#F2F0EA] group-hover:text-[#8B1E1E] transition-colors">
                    {group.title}
                  </span>
                  <span className="block text-[13px] text-[#8A8A8F] mt-0.5">
                    {group.standfirst}
                  </span>
                </span>
                <span className="text-[#8A8A8F] shrink-0 pt-1">
                  {open ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </span>
              </button>

              {open && (
                <div className="pb-7 space-y-7">
                  {group.steps.map((step) => (
                    <div
                      key={step.title}
                      className={
                        step.figures
                          ? 'grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-10'
                          : // Nothing to put beside it, so it uses the whole
                            // width rather than leaving half the row empty.
                            'block'
                      }
                    >
                      <div>
                        <h4 className="text-[15px] text-[#F2F0EA] mb-2">
                          {step.title}
                        </h4>
                        <div className="text-[15px] leading-relaxed text-[#A1A1AA] max-w-prose space-y-3">
                          {step.body}
                        </div>
                      </div>
                      {step.figures ? (
                        <div className="border border-[#222228] bg-[#0B0B0D] p-4 self-start">
                          <div className="font-mono text-[11px] tracking-[0.18em] text-[#8A8A8F] uppercase mb-2">
                            {companyName}
                          </div>
                          {step.figures}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[13px] leading-relaxed text-[#8A8A8F] max-w-2xl mt-6">
        Every figure behind all three approaches, and the ability to change any
        assumption and watch the answer move, is in the four models under “For
        the nerds” at the foot of this page.
      </p>
    </section>
  );
};

export default HowCalculated;
