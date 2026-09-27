// FILE: src/design/Mark.tsx
//
// THE RED SQUARE THAT ENDS A HEADING.
//
// One component. There were five copies of it — DirectoryModal, DirectoryScreen,
// figuresEditor, landingPage and marginNotes — plus two more that had already
// gone wrong on their own:
//
//   Header.tsx          no negative margin at all, and a 0.09em left margin, so
//                       the mark took real width and pushed the wordmark along.
//   MethodologyGrid.tsx 0.16em square with a 0.12em left margin and, again, no
//                       negative right margin.
//
// Both are on this now. Nobody was going to spot either without opening seven
// files side by side, which is the argument for the whole tokens layer.
//
// THE GEOMETRY IS THE POINT. `marginRight: -0.21em` gives the mark zero advance
// width. Given real width, a heading that exactly fills its measure pushes the
// mark onto a line of its own, which looks like a bug and loses it; with the
// negative margin it hangs into the gutter, which is what optical margin
// alignment does anyway. The word joiner before it stops a line breaking between
// the last letter and the mark.
//
// Never write a literal full stop before one.

import React from 'react';
import { DARK, PAPER, MARK } from './tokens';

interface Props {
  /** Which ground the heading sits on. Both are the same oxblood today; the
      distinction is here so that a change to one cannot silently move the
      other. */
  on?: 'dark' | 'paper';
  /** Additional classes, for the header's hover scale. */
  className?: string;
}

export const Mark: React.FC<Props> = ({ on = 'dark', className = '' }) => (
  <>
    {'⁠'}
    <span
      className={`inline-block align-baseline ${className}`.trim()}
      style={{
        width: MARK.size,
        height: MARK.size,
        background: on === 'paper' ? PAPER.accent : DARK.accent,
        marginLeft: MARK.marginLeft,
        marginRight: MARK.marginRight,
      }}
    />
  </>
);

export default Mark;
