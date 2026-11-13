// FILE: src/data/menu.ts
//
// THE MAIN MENU (`docs/NAV_SEARCH_SPEC.md` §3; build step 9, job 9.1).
//
// Seven sections, always in this order: Companies, Research, Markets, Invest,
// Valuation, Learn, Deals (Idea Book platform structure, NAV_SEARCH decision 4;
// "Tools" renamed by Nihar on 11 November 2026).
// A section is shown only when it has at least one shipped destination; what
// is in build or planned appears only in a final "Coming" group, as text with
// its status and no link, read from the feature register (LANDING §2.4), and
// that group ends with a link to the roadmap.
//
// WHAT IS SHOWN, AND WHY (APPROVED, Nihar, 11 November 2026; the rows below
// are his, named one by one):
//   Companies  Search a company, the screener. Coming: a private company.
//   Valuation  Value a listed company, saved models, the Excel model and house
//              template, the peer workbook. Coming: the one-pager, reformat
//              Excel, the LBO model.
//   Learn      the margin notes, the explainers, how Marginalia works,
//              coverage and sources, what is being built.
//
// TWO CHANGES THAT REVERSE EARLIER DECISIONS, kept visible rather than tidied
// away:
//
//   OVERVIEW AND FINANCIALS LEAVE THE MENU. On 4 November they were rows here,
//   opening the palette as "Choose a company for …" when no company was open.
//   They are TABS of a company, they sit on the company page's own tab row,
//   and a menu row that can only ask which company is meant is asking a
//   question the reader answered by opening the menu.
//
//   "TOOLS" BECOMES "VALUATION", AND ITS FOUR THINGS ARE NAMED SEPARATELY. On
//   8 November this was one row for the Model tab covering all four, on the
//   rule that each destination appears only once. A reader looking for saved
//   models should find the words "saved models", so the later decision wins.
//   WHAT IS NOT YET TRUE OF IT: three of the four are PANELS inside the Model
//   tab, opened from buttons on the valuation screen, with no address of their
//   own — so each row lands on the Model tab rather than on its own panel.
//   Giving those panels addresses is its own job (`docs/NAV_SEARCH_SPEC.md`).
//   Research, Deals  still hidden: their destinations are the company's
//              Research, Your notes and Deals tabs, none of which is built
//              (`src/data/companyRoute.ts`), so neither has a shipped
//              destination yet.
//   Markets    hidden: no browse-by-exchange screen exists.
//   Invest     hidden: not defined (the owner defines it).

import { FEATURES, statusLabel } from './featureRegister';
import { MARGIN_NOTES } from './marginNotes';

export type Destination =
  | { kind: 'screen'; label: string; screen: 'DIRECTORY'; hint?: string }
  /** A tab of the company in context, or "Choose a company for …" without one. */
  | { kind: 'company'; label: string; tab: string; purpose: string }
  | { kind: 'href'; label: string; href: string }
  | { kind: 'section'; label: string; section: string };

export interface ComingItem {
  id: string;
  label: string;
  status: string;
}

export interface MenuSection {
  name: 'Companies' | 'Research' | 'Markets' | 'Invest' | 'Valuation' | 'Learn' | 'Deals';
  /** Shipped destinations only. */
  links: Destination[];
  /** Register ids of what is coming in this section. */
  coming: string[];
}

/** The fixed order; nothing reorders it. */
export const SECTION_ORDER: MenuSection['name'][] = ['Companies', 'Research', 'Markets', 'Invest', 'Valuation', 'Learn', 'Deals'];

const ALL: MenuSection[] = [
  /* NIHAR'S DECISION, 11 NOVEMBER 2026. The sections and their rows are
     below exactly as he settled them.

     OVERVIEW AND FINANCIALS LEAVE THE MENU. They are TABS of a company, and a
     tab needs a company: picked from the menu without one they could only ask
     which company was meant, which is the palette asking a question the
     reader has already answered by opening the menu. They remain where they
     belong, on the company page's own tab row. */
  {
    name: 'Companies',
    links: [
      { kind: 'screen', label: 'Search a company', screen: 'DIRECTORY', hint: '⌘K' },
      { kind: 'href', label: 'Screener', href: '/screener' },
    ],
    coming: ['private-company'],
  },
  { name: 'Research', links: [], coming: ['filing-checks'] },
  { name: 'Markets', links: [], coming: [] },
  { name: 'Invest', links: [], coming: [] },
  /* "TOOLS" BECOMES "VALUATION". A tool is a thing you pick up; this section
     is what the site is for, and naming it after the work rather than after
     the implements says so.

     THIS REVERSES THE DECISION OF 8 NOVEMBER, which was one row for the Model
     tab "covering the model, the Excel download, saved models and the
     template", on the rule that each destination may appear only once. The
     later decision names the four separately, and a reader looking for saved
     models should find the words "saved models".

     WHAT IS NOT YET TRUE OF IT: three of these four are PANELS inside the
     Model tab — they open from buttons on the valuation screen and have no
     address of their own — so each lands on the Model tab of the company the
     reader picks rather than on its own panel. The labels say where they lead;
     the rows cannot yet lead further. Giving those panels addresses is its own
     job, recorded in `docs/NAV_SEARCH_SPEC.md`. */
  {
    name: 'Valuation',
    links: [
      { kind: 'screen', label: 'Value a listed company', screen: 'DIRECTORY', hint: '⌘K' },
      { kind: 'company', label: 'Saved models', tab: 'model', purpose: 'saved models' },
      { kind: 'company', label: 'Excel model and house template', tab: 'model', purpose: 'the Excel model and house template' },
      { kind: 'company', label: 'Peer workbook', tab: 'model', purpose: 'the peer workbook' },
    ],
    coming: ['one-pager', 'reformat-workbook', 'lbo'],
  },
  {
    name: 'Learn',
    links: [
      { kind: 'href', label: `Margin notes (all ${MARGIN_NOTES.length})`, href: '/learn/notes/' },
      /* "Explainers" rather than "Learn hub": the hub is where the explainers
         are, and a reader looking for an explanation does not know it is
         called a hub. */
      { kind: 'href', label: 'Explainers', href: '/learn/' },
      { kind: 'section', label: 'How Marginalia works', section: 'filings' },
      { kind: 'section', label: 'Coverage and sources', section: 'numbers' },
      { kind: 'section', label: "What's being built", section: 'beyond' },
    ],
    coming: [],
  },
  { name: 'Deals', links: [], coming: [] },
];

/** A panel holds at most this many links (NAV_SEARCH §3). */
export const PANEL_LINK_LIMIT = 8;

export function comingFor(section: MenuSection): ComingItem[] {
  return section.coming
    .map((id) => FEATURES.find((f) => f.id === id))
    .filter((f): f is (typeof FEATURES)[number] => !!f && f.status !== 'shipped')
    .map((f) => ({ id: f.id, label: f.title, status: statusLabel(f) }));
}

/** The sections the header shows: in the fixed order, each with something shipped. */
export const MENU: MenuSection[] = SECTION_ORDER.map((n) => ALL.find((s) => s.name === n)!).filter((s) => s.links.length > 0);

export default { MENU, SECTION_ORDER, comingFor, PANEL_LINK_LIMIT };
