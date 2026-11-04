// FILE: src/data/menu.ts
//
// THE MAIN MENU (`docs/NAV_SEARCH_SPEC.md` §3; build step 9, job 9.1).
//
// Seven sections, always in this order: Companies, Research, Markets, Invest,
// Tools, Learn, Deals (Idea Book platform structure, NAV_SEARCH decision 4).
// A section is shown only when it has at least one shipped destination; what
// is in build or planned appears only in a final "Coming" group, as text with
// its status and no link, read from the feature register (LANDING §2.4), and
// that group ends with a link to the roadmap.
//
// WHAT IS SHOWN, AND WHY (APPROVED, Nihar, 4 November 2026, for Companies and
// Learn; the spec marks every section's contents [CONFIRM]):
//   Companies  Search a company, the screener. Coming: a private company.
//   Learn      the Learn hub, the margin notes, how it works, coverage, what
//              is being built next.
//   Research, Tools, Deals  hidden. Their shipped destinations are company
//              tabs or company downloads, which need a company in context;
//              the spec's "Choose a company for …" search belongs to the
//              palette (job 9.2), not built yet. Until then a section whose
//              every link would open a plain search is not a section.
//   Markets    hidden: no browse-by-exchange screen exists.
//   Invest     hidden: not defined (the owner defines it).

import { FEATURES, statusLabel } from './featureRegister';
import { MARGIN_NOTES } from './marginNotes';

export type Destination =
  | { kind: 'screen'; label: string; screen: 'DIRECTORY'; hint?: string }
  | { kind: 'href'; label: string; href: string }
  | { kind: 'section'; label: string; section: string };

export interface ComingItem {
  id: string;
  label: string;
  status: string;
}

export interface MenuSection {
  name: 'Companies' | 'Research' | 'Markets' | 'Invest' | 'Tools' | 'Learn' | 'Deals';
  /** Shipped destinations only. */
  links: Destination[];
  /** Register ids of what is coming in this section. */
  coming: string[];
}

/** The fixed order; nothing reorders it. */
export const SECTION_ORDER: MenuSection['name'][] = ['Companies', 'Research', 'Markets', 'Invest', 'Tools', 'Learn', 'Deals'];

const ALL: MenuSection[] = [
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
  { name: 'Tools', links: [], coming: ['one-pager', 'reformat-workbook', 'lbo'] },
  {
    name: 'Learn',
    links: [
      { kind: 'href', label: 'Learn hub', href: '/learn/' },
      { kind: 'href', label: `Margin notes (all ${MARGIN_NOTES.length})`, href: '/learn/notes/' },
      { kind: 'section', label: 'How it works', section: 'filings' },
      { kind: 'section', label: 'Coverage and sources', section: 'numbers' },
      { kind: 'section', label: 'What is being built next', section: 'beyond' },
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
