// FILE: src/data/paperPalette.ts
//
// THE PAPER PALETTE.
//
// The reading screens are paper: a #F2F0EA ground with #16150F ink, against the
// dark palette the figures and the dashboard use, where the subject is numbers
// rather than prose. The Margin Notes screen defined these, and the explainer
// pages need exactly the same set — but the explainers are built into static
// HTML by a script that never loads React, so the two would have been two copies
// of the same five hex codes drifting apart.
//
// They live here instead, imported by the Margin Notes screen and read by
// `scripts/buildExplainers.mts` when it writes the stylesheet the static pages
// carry. Change a colour here and both move together.

export const PAPER = '#F2F0EA';      // the ground
export const PAPER_INK = '#16150F';  // headings and the standfirst
export const PAPER_READ = '#3A382F'; // body text, a shade off black to read long
export const PAPER_DIM = '#6B6759';  // labels, captions, the index when inactive
export const PAPER_LINE = '#DAD6CC'; // rules between things

export const RED = '#8B1E1E';        // the mark
export const RED_TEXT = '#C0453E';   // the mark, where it has to be legible as text

/** The display face, used for every heading on a reading screen. */
export const DISPLAY_FAMILY = "'Playfair Display', serif";

/** The body face, and the mono used for labels. Matched to index.html. */
export const BODY_FAMILY =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
export const MONO_FAMILY =
  "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
