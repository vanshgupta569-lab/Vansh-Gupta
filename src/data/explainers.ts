// FILE: src/data/explainers.ts
//
// THE EXPLAINERS, AND WHY THEY ARE NOT PART OF THIS APPLICATION.
//
// Eight articles for a reader who arrives from a search engine having typed
// "what is terminal value" — someone who has not heard of this site and has no
// intention of valuing anything yet. The site itself is a single-page React
// application served from one URL: every screen is a piece of state, there is no
// router, and nothing about the address bar changes as a reader moves through
// it. A crawler asking for any address gets the same empty `<div id="root">`.
//
// That is fine for an instrument. It is wrong for eight documents whose entire
// purpose is to be found.
//
// SO THE ARTICLES ARE NOT SCREENS. They are eight real HTML files, written at
// build time by `scripts/buildExplainers.mts` from the markdown in
// `content/explainers/`, served at `/learn/<slug>/`, carrying their whole text
// in the response. Reasons, in the order they weighed:
//
//  1. Crawlable by construction. A prerendered SPA route depends on the crawler
//     executing JavaScript, which Google does — eventually, from a second queue
//     — and which Bing, the social-preview fetchers and most of the crawlers
//     now reading the web for language models do not, or do badly. A file
//     containing the text needs none of them to be clever.
//  2. The site has no router to add a route to. Giving eight documents a URL
//     would mean giving every screen a URL contract the application does not
//     have and would then have to keep. That is a large change to an instrument
//     in order to publish some prose.
//  3. These are cold entry points. A static page is about fifteen kilobytes and
//     needs no JavaScript at all; the application bundle is 2.4 megabytes, and
//     making someone download it to read nine hundred words about WACC is a
//     poor trade for them and a poor one for the ranking.
//  4. No server rewrite. `/learn/terminal-value/` is a real directory with a
//     real `index.html`, so a deep link works on any static host without a
//     catch-all rule pointing back at the application.
//
// THE COST, STATED. The pages do not share React components with the Margin
// Notes screen, so the two treatments could drift. Two things hold them
// together: both read their colours from `design/tokens.ts`, and the build
// asserts that every title below matches the `# ` heading of its markdown file
// and fails rather than publishing a page whose name in the index is not the
// name on the page.
//
// This list is what the Margin Notes index links to, so an article added to
// `content/explainers/` without an entry here is built but never linked, and an
// entry here without a file fails the build.

export interface Explainer {
  /** The URL: /learn/<slug>/. Also the markdown file's name. */
  slug: string;
  /** Must equal the `# ` heading at the top of the markdown file. */
  title: string;
  /** One line, for the index, the meta description and the link preview. */
  standfirst: string;
}

// Ordered as they are meant to be read rather than alphabetically: what a
// valuation is, then the three things it is built out of, then the two
// measures it is checked against, then why two people doing all of it
// carefully still disagree.
export const EXPLAINERS: Explainer[] = [
  {
    slug: 'what-is-dcf-valuation',
    title: 'What is a discounted cash flow valuation',
    standfirst:
      'Projecting the cash a business will produce and converting each future year into money today, worked through end to end with figures.',
  },
  {
    slug: 'free-cash-flow-vs-profit',
    title: 'What is free cash flow, and why does it differ from profit',
    standfirst:
      'Profit is an accounting measure of a period; free cash flow is what actually reached the bank after paying to keep the business running.',
  },
  {
    slug: 'wacc-discount-rate',
    title: 'What is WACC, and what does a discount rate actually mean',
    standfirst:
      'The blended return lenders and shareholders require, and what it is doing when it shrinks a future cash flow back to the present.',
  },
  {
    slug: 'terminal-value',
    title: 'What is terminal value, and why is it most of a valuation',
    standfirst:
      'Everything after the last forecast year, which is usually the majority of the answer — and why that is arithmetic rather than a flaw.',
  },
  {
    slug: 'three-statement-model',
    title: 'What is a three-statement model',
    standfirst:
      'The income statement, balance sheet and cash flow statement built as one thing, so a change in any of them flows through the other two.',
  },
  {
    slug: 'ev-ebitda-multiple',
    title: 'What is EV/EBITDA, and when is it the wrong multiple',
    standfirst:
      'What the multiple compares, why it is preferred to the price-earnings ratio, and the kinds of company it quietly misprices.',
  },
  {
    slug: 'book-value',
    title: 'What is book value, and when does it matter',
    standfirst:
      'What the balance sheet says the shareholders own, where that number is informative, and where accounting rules make it nearly meaningless.',
  },
  {
    slug: 'why-analysts-value-differently',
    title: 'Why two analysts value the same company differently',
    standfirst:
      'A valuation is a chain of judgements. Small, defensible differences in each one compound into very different answers.',
  },
];

/** Where an explainer is served. Trailing slash: it is a directory with an index. */
export const explainerPath = (slug: string) => `/learn/${slug}/`;

/** Where the index of all eight is served. */
export const EXPLAINERS_PATH = '/learn/';

export default EXPLAINERS;
