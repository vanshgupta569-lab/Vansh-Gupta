// FILE: src/components/DirectoryScreen.tsx
//
// The search screen, set in the same hand as the landing page.
//
// What was taken out and why:
//
//  · The COVERAGE: ANY LISTED COMPANY plate beside the title. It was a badge
//    saying what the sentence underneath it already said, with an icon on it
//    for decoration.
//  · SCREEN 02 — INSTITUTIONAL COVERAGE DIRECTORY. Nobody arriving here
//    thinks of themselves as being on screen 02 of anything.
//  · The red bar down the side of the opening paragraph, the crosshair
//    corners on every card, the shadows, the inner shadows, and the
//    MARGINALIA SEARCH ENGINE V4.2 line in the footer. None of them carried
//    information; together they were most of the noise.
//
// Nothing that works was touched: the debounced lookup, the suggestion list,
// the name-is-not-a-ticker guidance, the build pipeline, the hand-built model
// grid and its workbook links all behave exactly as they did.
//
// The type is the landing page's type: Inter set very tight for headings, a
// mono eyebrow with a short red rule, and the red full stop at the end of a
// heading. The point is that a reader who has just come through the front
// door should not feel they have arrived somewhere else.

import React, { useState, useEffect } from 'react';
import { CompanyData } from '../types';
import { BuildPipeline } from './motionPrimitives';
import { Search, ArrowRight, FileSpreadsheet } from 'lucide-react';

const RED = '#8B1E1E';
const RED_TEXT = '#C0453E';
const INK = '#F2F0EA';
const READ = '#C6C1B7';
const MUTED = '#A8A29A';
const LINE = '#262521';

const DISPLAY: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif",
  fontWeight: 800,
  letterSpacing: '-0.045em',
  lineHeight: 0.98,
};

const Eyebrow: React.FC<{ children: React.ReactNode; centred?: boolean }> = ({ children, centred }) => (
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

const Square: React.FC = () => (
  <>
    {'⁠'}
    {/* Zero advance width, on purpose. Given real width, a heading that
        exactly fills its measure pushes the full stop onto a line of its
        own — which looks like a bug and loses the mark. With the negative
        margin it hangs into the gutter instead, which is what optical
        margin alignment does anyway. */}
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

interface DirectoryScreenProps {
  companies: Record<string, CompanyData>;
  selectedTicker: string;
  onSelectCompany: (ticker: string) => void;
  onBackToHome: () => void;
  onLookupTicker: (ticker: string) => void;
  lookupState: { loading: boolean; error: string | null };
}

export const DirectoryScreen: React.FC<DirectoryScreenProps> = ({
  companies,
  selectedTicker: _selectedTicker,
  onSelectCompany,
  onBackToHome,
  onLookupTicker,
  lookupState,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<
    { ticker: string; name: string; exchange: string }[]
  >([]);
  // A note to the user that is not an error: the site is working, they have
  // simply not told it which listing they meant yet.
  const [hint, setHint] = useState<string | null>(null);

  // Look up matching companies as the user types. Debounced so a fast typist
  // doesn't fire a request per keystroke.
  useEffect(() => {
    setHint(null);
    const query = searchQuery.trim();
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then((res) => res.json())
        .then((data) => {
          if (!cancelled) setSuggestions(data.results || []);
        })
        .catch(() => {
          if (!cancelled) setSuggestions([]);
        });
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  // A ticker is short, carries no spaces, and may end in an exchange suffix
  // after a dot: RELIANCE.NS, BRK-B, BP.L. A company name is not that shape.
  const looksLikeTicker = (text: string) =>
    !text.includes(' ') && /^[A-Za-z0-9][A-Za-z0-9.\-]{0,19}$/.test(text);

  // What happens on Enter, or on the Build model button.
  //
  // The trap this closes: typing "Reliance" and pressing the button used to
  // send RELIANCE straight to the modelling route as though it were a ticker.
  // It is not — the Indian listing is RELIANCE.NS — so the site answered "no
  // statements found", which reads as the site being broken rather than as a
  // step the user missed.
  //
  // There was also a race. Suggestions are fetched 220ms after typing stops,
  // so anyone who typed and clicked quickly hit an empty list and fell into
  // that same wrong branch. So if nothing is on screen yet, this asks the
  // search route directly rather than guessing.
  const submitSearch = async () => {
    const typed = searchQuery.trim();
    if (!typed || lookupState.loading) return;

    let match = suggestions[0];

    if (!match) {
      setHint('Looking that up…');
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(typed)}`);
        const data = await response.json();
        match = (data.results || [])[0];
      } catch {
        // Fall through to the guidance below.
      }
    }

    if (match) {
      setHint(null);
      onLookupTicker(match.ticker);
      return;
    }

    // Nothing matched, and what was typed is a name rather than a ticker.
    if (!looksLikeTicker(typed)) {
      setHint(
        `"${typed}" is a company name, not a ticker. Type two or more letters and pick the company from the list that appears below the box. The same name is often listed on several exchanges, so the site will not guess which one you meant.`
      );
      return;
    }

    // Shaped like a ticker, just not in the suggestion list. Let it through:
    // someone who knows the exact symbol should not be stopped.
    setHint(null);
    onLookupTicker(typed.toUpperCase());
  };

  const companyList = Object.values(companies) as CompanyData[];

  // The grid below is the analyst-model shelf: only companies with a real,
  // hand-built data file. Everything else is reached through the search box.
  const filteredCompanies = companyList.filter((c) => c.engineBacked);

  return (
    <div className="min-h-screen" style={{ background: '#0B0B0D' }}>
      <div className="max-w-[1380px] mx-auto px-6 sm:px-10 lg:px-16 pt-28 lg:pt-32 pb-20">
        {/* ---------------------------------------------------------- */}
        {/* 01 — the search                                             */}
        {/* ---------------------------------------------------------- */}
        {/* Centred. This screen has one job and one control on it, and a
            single column of words pinned to the left edge left the other
            half of the screen doing nothing. Centred, the box is where the
            eye already is. */}
        <div className="text-center">
          <Eyebrow centred>01 &middot; Search</Eyebrow>
          <h1
            className="text-[36px] sm:text-[48px] lg:text-[62px] mx-auto max-w-[26ch]"
            style={{ ...DISPLAY, color: INK }}
          >
            Value any listed company
            <Square />
          </h1>
          <p
            className="text-[17px] lg:text-[19px] leading-[1.6] mt-7 mx-auto max-w-[56ch]"
            style={{ color: READ }}
          >
            Type a name or a ticker and pick the listing you meant. Its own
            filings become a three-statement model and a discounted cash flow,
            and every assumption in it is yours to move.
          </p>
        </div>

        {/* The box. One field, one button, and the list of matches under it. */}
        <div className="mt-11 lg:mt-14 mx-auto max-w-[60rem]">
          {/* On a phone the button drops below the field. Held inside it, it
              covered the half of the placeholder that tells you what to type. */}
          <div className="relative flex items-center w-full">
            <Search className="w-5 h-5 absolute left-5" style={{ color: MUTED }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitSearch();
                if (e.key === 'Escape') setSearchQuery('');
              }}
              placeholder="Apple, Reliance, Nvidia, Tata Motors…"
              className="w-full font-mono text-[15px] pl-14 pr-4 sm:pr-40 py-5 outline-none border transition-colors focus:border-[#8B1E1E] placeholder:text-[#52525B]"
              style={{ background: '#111114', borderColor: LINE, color: INK }}
              autoFocus
            />
            <button
              onClick={submitSearch}
              disabled={lookupState.loading || !searchQuery.trim()}
              className="hidden sm:block absolute right-2 font-mono text-[11px] px-5 py-3 uppercase tracking-[0.16em] transition-colors cursor-pointer disabled:opacity-40 whitespace-nowrap border"
              style={{ borderColor: RED, background: 'rgba(139,30,30,0.22)', color: INK }}
            >
              {lookupState.loading ? 'Building…' : 'Build model'}
            </button>
          </div>
          <button
            onClick={submitSearch}
            disabled={lookupState.loading || !searchQuery.trim()}
            className="sm:hidden w-full mt-3 font-mono text-[12px] px-5 py-3.5 uppercase tracking-[0.16em] transition-colors cursor-pointer disabled:opacity-40 border"
            style={{ borderColor: RED, background: 'rgba(139,30,30,0.22)', color: INK }}
          >
            {lookupState.loading ? 'Building…' : 'Build model'}
          </button>

          {/* Live suggestions as the user types */}
          {suggestions.length > 0 && (
            <div className="mt-2 border" style={{ borderColor: LINE, background: '#111114' }}>
              {suggestions.map((sug, i) => (
                <button
                  key={sug.ticker}
                  onClick={() => {
                    setHint(null);
                    onLookupTicker(sug.ticker);
                  }}
                  className="w-full text-left px-5 py-3.5 transition-colors cursor-pointer flex items-center justify-between gap-4 group hover:bg-[#18181c]"
                  style={{ borderTop: i === 0 ? 'none' : `1px solid ${LINE}` }}
                >
                  <span className="flex items-center gap-4 min-w-0">
                    <span className="font-mono text-[14px] shrink-0" style={{ color: INK, fontWeight: 600 }}>
                      {sug.ticker}
                    </span>
                    <span className="text-[15px] truncate" style={{ color: MUTED }}>
                      {sug.name}
                    </span>
                  </span>
                  <span
                    className="font-mono text-[11px] uppercase tracking-[0.16em] shrink-0 flex items-center gap-3"
                    style={{ color: MUTED }}
                  >
                    {sug.exchange}
                    <ArrowRight
                      className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: RED_TEXT }}
                    />
                  </span>
                </button>
              ))}
            </div>
          )}

          <p className="font-mono text-[12px] mt-5 leading-[1.6] text-center mx-auto max-w-[84ch]" style={{ color: MUTED }}>
            US filings come from SEC EDGAR, everywhere else from exchange
            disclosures. Banks, insurers and lenders are shown without a
            discounted cash flow, because it does not apply to them.
          </p>

          {/* While a model is being built, name the stages instead of spinning */}
          <BuildPipeline active={lookupState.loading} />

          {/* Grey, not oxblood. This is a missed step, not a failure, and a
              red box would tell the user the site is broken when it is not. */}
          {hint && (
            <div
              className="mt-5 border px-5 py-4 text-[15px] leading-[1.6] flex items-start gap-3"
              style={{ borderColor: LINE, background: '#111114', color: INK }}
            >
              <span className="w-2 h-2 mt-2 shrink-0" style={{ background: RED }} />
              <span>{hint}</span>
            </div>
          )}

          {!hint && lookupState.error && (
            <div
              className="mt-5 border px-5 py-4 font-mono text-[13px] leading-[1.6]"
              style={{ borderColor: 'rgba(139,30,30,0.5)', background: 'rgba(139,30,30,0.10)', color: INK }}
            >
              {lookupState.error}
            </div>
          )}
        </div>

        {/* ---------------------------------------------------------- */}
        {/* 02 — the hand-built shelf                                   */}
        {/*                                                             */}
        {/* Everything above is the engine; everything below is work    */}
        {/* somebody sat down and did. The rule and the change of scale */}
        {/* are what make that switch legible without saying it twice.  */}
        {/* ---------------------------------------------------------- */}
        <div className="mt-24 lg:mt-28 pt-14 border-t" style={{ borderColor: LINE }}>
          <div className="text-center">
            <Eyebrow centred>02 &middot; Built by hand</Eyebrow>
            <h2
              className="text-[30px] sm:text-[40px] lg:text-[52px] mx-auto max-w-[28ch]"
              style={{ ...DISPLAY, color: INK }}
            >
              The analyst&rsquo;s own models
              <Square />
            </h2>
            <p className="text-[17px] leading-[1.6] mt-7 mx-auto max-w-[62ch]" style={{ color: READ }}>
              The workbooks below were prepared by the analyst himself, after a
              detailed study of each company and its filings, with every
              assumption chosen and defended individually. They are not the
              output of the automated engine.
            </p>
          </div>

          {/* The shelf itself */}
          {/* Three across only once there are three things to put across.
              With two tiles a three-wide grid leaves a third of the row
              empty; two tiles in a centred pair sit under a centred page. */}
          <div
            className={`grid grid-cols-1 md:grid-cols-2 gap-6 mt-12 ${
              filteredCompanies.length + 1 >= 3 ? 'lg:grid-cols-3' : 'max-w-[62rem] mx-auto'
            }`}
          >
            {filteredCompanies.map((comp) => (
                <div
                  key={comp.ticker}
                  onClick={() => onSelectCompany(comp.ticker)}
                  className="group cursor-pointer transition-colors p-7 lg:p-8 flex flex-col justify-between border hover:border-[#4A4740]"
                  style={{ background: '#111114', borderColor: LINE }}
                >
                  <div>
                    <div className="flex justify-between items-start gap-4 mb-5">
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-3">
                          <span className="font-mono text-[26px] tracking-tight" style={{ color: INK, fontWeight: 700 }}>
                            {comp.ticker}
                          </span>
                          <span
                            className="font-mono text-[10px] tracking-[0.16em] uppercase"
                            style={{ color: MUTED }}
                          >
                            {comp.exchange}
                          </span>
                        </div>
                        <div className="text-[15px] mt-1 truncate" style={{ color: MUTED }}>
                          {comp.name}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-mono text-[18px] tabular-nums" style={{ color: INK, fontWeight: 600 }}>
                          {comp.currencySymbol}
                          {comp.price.toFixed(2)}
                        </div>
                        <div
                          className="font-mono text-[12px] tracking-[0.06em] mt-1"
                          style={{ color: comp.priceChangePct >= 0 ? '#4E9E7A' : RED_TEXT }}
                        >
                          {comp.priceChangePct >= 0 ? '+' : ''}
                          {comp.priceChangePct}%
                        </div>
                      </div>
                    </div>

                    <p className="text-[14px] leading-[1.6] line-clamp-2 mb-6" style={{ color: MUTED }}>
                      {comp.description}
                    </p>

                    <div
                      className="font-mono text-[12px] grid grid-cols-2 gap-y-2 gap-x-4 pt-4 border-t"
                      style={{ borderColor: LINE, color: MUTED }}
                    >
                      <div>
                        Cap&nbsp;&nbsp;<span style={{ color: INK }}>{comp.marketCapStr}</span>
                      </div>
                      <div>
                        ROE&nbsp;&nbsp;<span style={{ color: INK }}>{comp.roePct}%</span>
                      </div>
                      <div>
                        Sector&nbsp;&nbsp;<span style={{ color: INK }}>{comp.sector}</span>
                      </div>
                      <div>
                        Op margin&nbsp;&nbsp;<span style={{ color: INK }}>{comp.opMarginPct}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Excel workbooks behind this model, where they exist. The
                      click is stopped so the card underneath doesn't also open. */}
                  {comp.excelModels && comp.excelModels.length > 0 && (
                    <div className="pt-5 mt-5 border-t" style={{ borderColor: LINE }}>
                      <div
                        className="font-mono text-[11px] uppercase tracking-[0.18em] mb-3"
                        style={{ color: MUTED }}
                      >
                        Download the workbooks
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {comp.excelModels.map((model) => (
                          <a
                            key={model.label}
                            href={model.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-2 font-mono text-[11px] border px-3 py-2 transition-colors hover:border-[#8B1E1E]"
                            style={{ color: READ, borderColor: LINE, background: '#0B0B0D' }}
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5" style={{ color: RED_TEXT }} />
                            {model.label}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-5 mt-6 border-t" style={{ borderColor: LINE }}>
                    <div className="font-mono text-[10px] tracking-[0.1em] mb-3" style={{ color: '#6B6759' }}>
                      ISIN {comp.isin}
                    </div>
                    <span
                      className="font-mono text-[11px] tracking-[0.16em] uppercase flex items-center gap-2 whitespace-nowrap"
                      style={{ color: RED_TEXT }}
                    >
                      <span className="group-hover:text-[#F2F0EA] transition-colors">Open the model</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </div>
                </div>
            ))}

            {/* The invitation sits IN the shelf rather than above it. With one
                hand-built model on a three-wide grid, two thirds of the row
                was empty; this is real content and it fills one of them. The
                address is text, not a mailto button — a mailto opens whatever
                desktop client the machine happens to have, which is useless to
                anyone on webmail. */}
            <div
              className="p-7 lg:p-8 border flex flex-col justify-center"
              style={{ borderColor: LINE, background: '#0E0E11' }}
            >
              <div className="font-mono text-[11px] uppercase tracking-[0.18em] mb-4" style={{ color: RED_TEXT }}>
                Not on the shelf
              </div>
              <p className="text-[16px] leading-[1.6]" style={{ color: READ }}>
                For a model of this depth on a company that is not here, rather
                than the engine-generated version, write to:
              </p>
              <span
                className="font-mono text-[15px] select-all border-b pb-0.5 mt-6 self-start"
                style={{ color: INK, borderColor: RED }}
              >
                vanshgupta569@gmail.com
              </span>
            </div>
          </div>

          {filteredCompanies.length === 0 && (
            <div className="mt-12 border px-8 py-16 text-center" style={{ borderColor: LINE, background: '#111114' }}>
              <div className="text-[17px]" style={{ color: READ }}>
                No hand-built models on the shelf yet.
              </div>
              <div className="text-[15px] mt-2" style={{ color: MUTED }}>
                Use the box above to model any listed company automatically.
              </div>
            </div>
          )}
        </div>

        <div className="mt-20 pt-8 border-t text-center" style={{ borderColor: LINE }}>
          <button
            onClick={onBackToHome}
            className="font-mono text-[11px] uppercase tracking-[0.18em] transition-colors cursor-pointer"
            style={{ color: MUTED }}
          >
            &larr;&nbsp;&nbsp;Back to the home page
          </button>
        </div>
      </div>
    </div>
  );
};
