// FILE: src/data/featureRegister.ts
//
// THE FEATURE REGISTER (`docs/LANDING_SPEC.md` §2.4, decision 5; build step 8,
// job 8.6). One list of what the site does, what it will do, and how far each
// thing has got. The landing page's "Four ways in", its roadmap rows, its
// counts and its hero buttons are read from here, and a page may claim in the
// present tense only what this list says has shipped.
//
// WHY IT EXISTS. On 4 November 2026 the landing page said, in the present
// tense, that a reader could value a private company, make a one-pager and
// reformat a workbook — none of which is built — while the roadmap further
// down called the same three "In build" or "Planned". It also printed quarter
// dates (Q1 2027, Q2 2027 …) that were not recorded anywhere: they were
// computed as "the next five quarters from today", so they moved forward on
// their own every three months. Both were false statements about the site.
//
// THE STATUSES, mapped from `docs/VISION.md` (the plan; another session owns
// it), with the repository's own state where that is more precise:
//   shipped   VISION "Built": live and verified. Present tense, with a link.
//   in_build  VISION "In flight", or a "Now" item with code already merged.
//   planned   VISION "Now", "Next" or "Later" with no code yet. Future tense,
//             no link, no button, no "Type in" instruction.
//
// QUARTERS. None is printed until one is recorded here as a decision; an
// invented quarter is a promise (PROPOSED — needs Nihar, CLOUD_RUN_LOG 8.6).
//
// ORDER. The Idea Book's "Where we are and the build order" section is not in
// the repository's copy, so the order is the build steps the plans record:
// step 5 (valuation completion), step 6 (the tearsheet), then the Next items
// in the order VISION §5 lists them (PROPOSED — needs Nihar).

export type FeatureStatus = 'shipped' | 'in_build' | 'planned';

export interface Feature {
  id: string;
  title: string;
  status: FeatureStatus;
  /** The VISION.md row and status it was read from, for the reviewer. */
  basis: string;
  /** A recorded quarter, or null. Never computed. */
  quarter: string | null;
  /** What it does, in the present tense: printed only when shipped. */
  does: string;
  /** What it will do, in the future tense: printed until it ships. */
  willDo: string;
}

export const FEATURES: readonly Feature[] = Object.freeze([
  {
    id: 'listed-company',
    title: 'Value a listed company',
    status: 'shipped',
    basis: 'VISION §5a "DCF, residual income, reverse DCF": Built',
    quarter: null,
    does: 'Type a ticker. Its filings become a three-statement model and a DCF you can argue with.',
    willDo: '',
  },
  {
    id: 'three-approaches',
    title: 'Three valuation approaches, side by side',
    status: 'in_build',
    basis: 'VISION §5a "Three approaches side by side": Now; build step 5 part B in flight (LANDING decision 4 holds the claim until it ships)',
    quarter: null,
    does: 'Income, market and asset approaches shown side by side, not averaged.',
    willDo: 'The income, market and asset approaches will sit side by side on one chart, not averaged into one number.',
  },
  {
    id: 'one-pager',
    title: 'A one or two-pager',
    status: 'planned',
    basis: 'VISION §5c "One-pager (tearsheet)": Now; build step 6, planned in docs/TEARSHEET_SPEC.md, no code yet',
    quarter: null,
    does: 'A whole company on one page — the summary you would be asked for before a meeting.',
    willDo: 'The whole company will fit on a single page: what it does, what it earns, what it is worth, and the figures you would be asked about first.',
  },
  {
    id: 'private-company',
    title: 'A private company',
    status: 'planned',
    basis: 'VISION §5a "Private company model": Next',
    quarter: null,
    does: 'A private company files nothing public. Type in the accounts you already have and get the same model a listed company gets.',
    willDo: 'A private company files nothing public, so you will supply the accounts: the income statement and balance sheet you already have, and the same engine will run on them.',
  },
  {
    id: 'filing-checks',
    title: 'Things to check in a filing',
    status: 'planned',
    basis: 'VISION §5a "Rule-based flags": Next',
    quarter: null,
    does: 'Factual checks over the filed figures, each stated without a verdict.',
    willDo: 'Factual checks will run over the filed figures, each one stated as what the numbers do and not as a verdict.',
  },
  {
    id: 'lbo',
    title: 'A leveraged buyout model',
    status: 'planned',
    basis: 'VISION §5a "LBO module with refusals": Next',
    quarter: null,
    does: 'The same forecast run for a buyer using debt.',
    willDo: 'The same forecast will be run for a buyer using debt — the structure it is bought with, the years of repayment, the sale at the end, and the return that falls out of it.',
  },
  {
    id: 'reformat-workbook',
    title: 'Reformat your Excel model',
    status: 'planned',
    basis: 'VISION §5c "Reformat a user\'s model to convention": Next',
    quarter: null,
    does: 'Your own workbook set to house convention: blue for inputs, black for formulas. Not one number changes.',
    willDo: 'Your own workbook will be set to house convention — blue for inputs, black for formulas — with every number left as it was.',
  },
]);

/**
 * LANDING §2.3: banned in all landing copy, case-insensitive, as whole words.
 * "never" is exempt only in the page title, "A Ledger That Never Lies"
 * (decision 6); the register is not the title, so it is held to the list.
 */
export const LANDING_BANNED = Object.freeze([
  'buy', 'sell', 'hold', 'undervalued', 'overvalued', 'upside', 'downside', 'outperform',
  'beat the market', 'guarantee', 'best', 'most accurate', 'never', 'always', 'real-time',
  'AI-powered', 'trusted by',
]);

export function landingBannedIn(text: string): string[] {
  const lower = String(text ?? '').toLowerCase();
  return LANDING_BANNED.filter((w) =>
    new RegExp(`(^|[^a-z])${w.toLowerCase().replace(/[-\s]/g, '[-\\s]')}($|[^a-z])`).test(lower)
  );
}

export const featureById = (id: string): Feature | undefined => FEATURES.find((f) => f.id === id);
export const isShipped = (id: string): boolean => featureById(id)?.status === 'shipped';

/** The label a not-yet-shipped item carries; a shipped one carries none. */
export const statusLabel = (f: Feature): string =>
  f.status === 'shipped' ? '' : `${f.status === 'in_build' ? 'In build' : 'Planned'}${f.quarter ? ` · ${f.quarter}` : ''}`;

/** What the page may say about a feature, in the tense its status allows. */
export const claimFor = (f: Feature): string => (f.status === 'shipped' ? f.does : f.willDo);

// ---------------------------------------------------------------------------
// THE CLAIMS (LANDING §2.3, decisions 2, 3 and 4)
//
// Every count and claim the landing page prints, with what it rests on. A
// claim whose evidence cannot be produced in the browser carries the check
// that must be run against the company payloads (`checkedLocally`), so the
// build log can say which are proved where.
export const CLAIMS = Object.freeze({
  /**
   * "Up to N fiscal years". The landing page has said five since it was
   * written; the Financials tab now shows up to ten for SEC filers and four or
   * five for the vendor feed. Kept at five until the payload set is measured:
   * LOCAL check — the largest number of reported fiscal years any company in
   * the payload set holds, and the smallest the page could honestly print.
   */
  historyYears: 5,
  historyYearsCheckedLocally: 'the most fiscal years any company in verify/payloads holds, against CLAIMS.historyYears',
  /** Decision 2: "Free to use" is not shown until pricing is decided. */
  showFreeToUse: false,
  /**
   * Decision 3: the company count is read from the data, never written here.
   * "10,000+" only at 10,000 or more; below that, rounded down to the hundred.
   */
  companyCountCheckedLocally: 'the landing count against the rows of the built screener table (npm run screener:table on the payload set)',
});

/** LANDING §2.3: the count as printed, from the count itself. */
export function companyCountLabel(count: number | null): string | null {
  if (count === null || !isFinite(count) || count <= 0) return null;
  if (count >= 10000) return '10,000+';
  if (count < 100) return String(count);
  return `${(Math.floor(count / 100) * 100).toLocaleString('en-GB')}+`;
}

export default { FEATURES, featureById, isShipped, statusLabel, claimFor, CLAIMS, companyCountLabel };
