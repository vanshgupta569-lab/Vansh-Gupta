// FILE: src/components/notFound.tsx
//
// PAGE NOT FOUND, in the app (`docs/LEARN_STATES_SPEC.md` §3.6, S18; build
// step 9, job 9.5). Before this every path the app did not know rendered the
// landing page at the wrong address, so a mistyped link silently showed the
// home page. The static `404.html` that Vercel serves for an unknown address
// carries the same words (written by `scripts/buildExplainers.mts`).
//
// No illustration, no "404" in display type, no joke: the address that was
// asked for, what it means, and three ways on. A company that does not exist
// is not this page — it is the company page's own state at its real address,
// because the reader may have typed a valid ticker the source has not got.

import React from 'react';
import { DARK, SIZE, TYPE } from '../design/tokens';
import { Mark } from '../design/Mark';

interface Props {
  path: string;
  onSearch: () => void;
  onHome: () => void;
}

const LINK: React.CSSProperties = {
  color: DARK.read,
  textDecoration: 'underline',
  textDecorationColor: DARK.lineControl,
  textDecorationThickness: '1px',
  textUnderlineOffset: '2px',
};

export const NotFound: React.FC<Props> = ({ path, onSearch, onHome }) => (
  <section data-not-found className="w-full min-h-[70vh]" style={{ background: DARK.page }}>
    <div className="max-w-[640px] mx-auto px-6 sm:px-0 pt-40 pb-24">
      <h1
        className="mb-4"
        style={{
          fontFamily: TYPE.display,
          fontWeight: 600,
          fontSize: SIZE.title,
          lineHeight: 1.08,
          letterSpacing: '-0.015em',
          wordSpacing: '0.04em',
          color: DARK.ink,
        }}
      >
        This page does not exist
        <Mark />
      </h1>
      <p className="text-[15px] leading-[24px] mb-6" style={{ color: DARK.read }}>
        The address <span data-not-found-path style={{ color: DARK.ink }}>{path}</span> is not a page on
        Marginalia. It may have moved, or the link may have a typo.
      </p>
      <ul className="grid gap-3 text-[15px] leading-[24px]">
        <li>
          <button type="button" onClick={onSearch} className="min-h-[24px] cursor-pointer" style={LINK}>
            Search a company
          </button>
        </li>
        <li>
          <a href="/learn/" className="inline-flex min-h-[24px] items-center" style={LINK}>
            Learn
          </a>
        </li>
        <li>
          <a
            href="/"
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
              e.preventDefault();
              onHome();
            }}
            className="inline-flex min-h-[24px] items-center"
            style={LINK}
          >
            Home
          </a>
        </li>
      </ul>
    </div>
  </section>
);

export default NotFound;
