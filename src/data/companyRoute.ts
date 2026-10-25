// FILE: src/data/companyRoute.ts
//
// THE COMPANY PAGE'S ADDRESSES, WRITTEN ONCE.
//
// One web address per company and per tab — /company/RELIANCE.NS/overview —
// because a reader who finds something has to be able to send it to somebody,
// and because a tab that cannot be linked to is a tab nobody cites. The list
// below is the whole grammar: the tabs, their order, what each is for, and
// which of them are built. The page reads it, the router reads it, and the
// verification suite walks it rather than keeping its own copy of the list,
// which is how a tenth tab gets checked without anybody remembering to add it.
//
// THE TABS ARE `docs/VISION.md`'s, IN ITS ORDER, and the wording of "what it
// will be" is taken from there rather than invented here, so an unbuilt tab
// promises exactly what the plan promises and not a word more
// (`CLAUDE.md` standing decision 7: anything not built is labelled as being
// built).

export interface CompanyTab {
  /** The last part of the address. Lower case, no spaces. */
  slug: string;
  /** What the tab is called on screen. */
  label: string;
  /**
   * Built tabs render. Unbuilt tabs render one line and nothing else — no
   * mock figures, no empty table that looks like a company with no data.
   */
  built: boolean;
  /** For an unbuilt tab: what it will carry, from `docs/VISION.md`. */
  coming?: string;
}

export const COMPANY_TABS: CompanyTab[] = [
  {
    slug: 'overview',
    label: 'Overview',
    built: true,
  },
  {
    // STAGE A (docs/FINANCIALS_SPEC.md): the three statements as filed, every
    // number opening the evidence behind it. What is not built yet is said on
    // the screen itself rather than here: there are no quarterly periods in the
    // data layer, so the Quarterly and Half-year controls say so when chosen.
    slug: 'financials',
    label: 'Financials',
    built: true,
  },
  {
    slug: 'filings',
    label: 'Filings',
    built: false,
    coming:
      'Every filing, searchable, with a year-on-year redline, tables to Excel, and concall ' +
      'transcripts answered with the sentence quoted and its page.',
  },
  {
    // NOT A PLACEHOLDER. The model is the oldest thing on this site, and this
    // tab opens it rather than describing it.
    slug: 'model',
    label: 'Model',
    built: true,
  },
  {
    slug: 'research',
    label: 'Research',
    built: false,
    coming:
      'A one-pager, a two-pager and a full research pack for this company, generated from ' +
      'the model on the Model tab, with results notes as they are filed.',
  },
  {
    slug: 'ownership',
    label: 'Ownership',
    built: false,
    coming:
      'Shareholding over time, promoters and their pledges, insider trades, bulk and block ' +
      'deals and named large holders, as one "who bought or sold" timeline.',
  },
  {
    slug: 'deals',
    label: 'Deals',
    built: false,
    coming:
      "This company's funding rounds, acquisitions, open offers and schemes, each linked to " +
      'the document it was announced in.',
  },
  {
    slug: 'credit',
    label: 'Credit',
    built: false,
    coming:
      'Credit ratings with the agency’s own rationale, the debt schedule by maturity, and ' +
      'covenant headroom measured against the filed figures.',
  },
  {
    slug: 'notes',
    label: 'Your notes',
    built: false,
    coming:
      'Your thesis for this company, your alerts, and every model you have saved for it with ' +
      'the version history between them.',
  },
];

// THE HOST HAS TO KNOW THESE ARE ADDRESSES TOO.
//
// `/company/RELIANCE.NS/overview` is not a file, so a cold load of a shared link
// is a 404 unless the host is told to serve the app shell for it. `vercel.json`
// carries that rewrite, scoped to `/company/*` rather than everything: the
// explainer articles under `dist/learn/` really are files on disk and a
// catch-all would swallow them. Vite’s dev server does the same thing by
// default, which is why this works locally without any configuration.

/** The tab a bare /company/TICKER address means. */
export const DEFAULT_TAB = 'overview';

export const TAB_SLUGS = COMPANY_TABS.map((t) => t.slug);

export function tabBySlug(slug: string): CompanyTab | null {
  return COMPANY_TABS.find((t) => t.slug === slug) ?? null;
}

/**
 * The address for a company and tab.
 *
 * The ticker is encoded because real ones carry dots and hyphens that are fine
 * in a path, and one day a market will hand us something that is not
 * (`BRK-B`, `0005.HK`, `BP.L` are the shapes in the set today).
 */
export function companyPath(ticker: string, tab: string = DEFAULT_TAB): string {
  return `/company/${encodeURIComponent(String(ticker).toUpperCase())}/${tab}`;
}

export interface CompanyRoute {
  ticker: string;
  tab: string;
}

/**
 * Read an address, or null if it is not a company address.
 *
 * AN UNKNOWN TAB IS NOT A COMPANY PAGE WITH A BLANK BODY — it comes back as
 * the overview, because a mistyped or renamed tab should land the reader on
 * the company rather than on nothing. `/company/AAPL` does the same.
 */
export function parseCompanyPath(pathname: string): CompanyRoute | null {
  const parts = String(pathname || '')
    .split('/')
    .filter(Boolean);
  if (parts.length < 2 || parts[0] !== 'company') return null;
  let ticker = '';
  try {
    ticker = decodeURIComponent(parts[1]).toUpperCase();
  } catch {
    ticker = parts[1].toUpperCase();
  }
  if (!ticker) return null;
  const asked = (parts[2] || '').toLowerCase();
  return { ticker, tab: TAB_SLUGS.includes(asked) ? asked : DEFAULT_TAB };
}

export default { COMPANY_TABS, TAB_SLUGS, DEFAULT_TAB, tabBySlug, companyPath, parseCompanyPath };
