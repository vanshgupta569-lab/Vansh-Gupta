# VISUAL_SYSTEM — decisions (Nihar, 30 October 2026)
- Accepted as written, except:
  1. ⓘ stays (deliberate choice). Do NOT replace with dotted underlines. Enlarge its hit area to 24×24 (44×44 on touch) with a pseudo-element, and reduce visual noise by showing ⓘ only on labels that need explaining.
  2. Optional Light theme for instrument screens: Later, not now. Dark stays the only instrument theme.
  3. Landing-page 3D and particle budgets apply in build step 8 (landing page), not before.
- All other CHANGE items are approved.

VISUAL_SYSTEM
Marginalia · site-wide visual layer · v1.0 · 29 October 2026 · sits beneath DESIGN.md and does not replace it.
0. Basis and limits
• Evidence: your 9 screenshots plus DESIGN.md. The live site is a JavaScript app, so fetching it returned only metadata (title, theme-color #0B0B0D, viewport-fit=cover, og tags). Every pixel measurement below is read off screenshots (±2px) and must be confirmed with computed styles before it is treated as a bug.
• Pages I opened for research: Carbon motion and data-viz palettes, Stripe's colour-systems essay, Linear's redesign post, Vercel Geist colours, GOV.UK focus states and colour, Bloomberg's accessibility pages, Koyfin's theme notice, Stripe Apps design docs, web.dev animation guides, W3C WCAG 2.2, Awwwards' finance listing.
• Not opened: Godly, Land-book and SiteInspire (I only got third-party descriptions), so they are not used as sources. For Awwwards I could read the finance listing and the Moto Finance Site of the Day page as text only; I could not judge its visuals.
• Contrast numbers are computed (WCAG relative luminance). Your DESIGN.md figures reproduce exactly (quiet 5.03 on page, accent-text 5.08, accent 2.16).
• Markers: ADD = new token or rule. CHANGE = alters DESIGN.md and needs sign-off.
1. Visual direction
1. Marginalia looks like a private bank's printed annual report lit from within: a warm near-black ground (#0B0B0D), Newsreader for titles, Source Sans 3 for everything else, and every number large, still and alone.
2. Hierarchy comes from size, weight and a one-step tonal change rather than colour, so any screen reads correctly in greyscale and oxblood appears only on the one thing to do or the one thing that changed.
3. Surfaces are flat and square: three tonal layers, 1px warm hairlines, no shadows and no gradients on interface chrome.
4. Motion exists only to explain a state change, never lasts longer than 280ms on an interaction, and never touches a number once it is on screen.
5. Spectacle and depth are rationed to the landing hero, so product screens feel like a calm, dense instrument and never like a trading or crypto app.
Avoid: neon or glow; red/green flashing prices; live tickers; mesh or animated gradients; glassmorphism cards; rounded cards and pills; emoji; stock photos; 3D on data screens; more than one primary button per screen; uppercase tracked labels; cool greys; a third typeface; count-up on product screens; any element that exists only to look busy.
2. Surfaces and depth
Elevation is tonal: lighter means higher on dark, and on light the raised surface is the lighter one. Each step is small (about 1.09:1), so every raised surface also carries a 1px hairline.
Token
Dark (default instrument)
Light (Paper)
Use
page
#0B0B0D
#F2F0EA
Ground, sections, header at 95%
panel
#111114
#FAF9F5 (ADD)
Verdict block, tiles, chart panels
overlay ADD
#16161A
#FFFFFF
Modal, sheet, popover, menu
line (decorative)
#262521 (1.28:1)
#DAD6CC (1.27:1)
Dividers, tile borders
line-control ADD
#6E6A60 (3.65 page, 3.49 panel, 3.35 overlay)
#85816F (3.43 paper, 3.71 panel)
Boundary of inputs, segmented controls, checkboxes (WCAG 1.4.11 needs 3:1)
scrim ADD
rgba(11,11,13,0.72)
rgba(22,21,15,0.40)
Behind modal and sheet
Rules
• Shadows: none, in either mode. Gradients: none on chrome. The one data exception already in your doc stays: the price fill fading from 10% ink to 0.
• Blur: header only, backdrop-filter: blur(8px) over page at 95%. CHANGE: scrim blur is permitted on desktop only, blur(6px), because your build overlay (screenshot 4) already blurs the page behind it. It is dropped to a flat 0.72 scrim on phones. Never more than one blurred layer on screen.
• Radius: 0px everywhere; 9999px only for status dots and diagram rings.
• Light mode scope: Paper stays the reading ground (landing sections, /learn, Margin notes). ADD an optional Light theme for instrument screens built from the same Paper ramp, selectable Dark / Light / System, default Dark. Two themes only; Koyfin collapsed six themes into Light and Dark in its theme update, and a third would double your contrast checks.
• Light instrument tokens: ink #16150F (16.05), read #3A382F (10.31), quiet #6B6759 (4.97), accent-text #A23A34 (5.77), positive #2B7050 (5.21, ADD), amber #7D5F0F (5.24, ADD). Muted collapses into quiet on light.
• Container edges: content max 1440px with 24px gutters (48px at lg). Every hairline, band and sub-nav shares the content edges; none runs wider (see finding 11).
3. Colour
3.1 Accent budget
Oxblood is a signal, so it is rationed in numbers.
• Per viewport (1440×900): at most 1 oxblood-washed primary button, at most 3 oxblood fills or washes in total, and at most 5 words set in accent-text. The mark, the scroll-progress rule and a 2px active-tab underline do not count towards the three.
• One primary per screen. The global header's Search is a ghost button (hairline, muted label, a ⌘K hint). Oxblood wash is reserved for the screen's one action, such as Download Excel model or Build the model.
• Never on labels or eyebrows, nav links at rest, figures, or body text. Allowed as words: links, the changed figure after an edit, a refusal or error, and section numbers.
• Selected state, one definition (CHANGE): panel ground, 1px accent border, ink label, weight 600. Ticker chips, range chips, overlay chips, segmented controls and primary-nav current item all use it. The solid-oxblood fill on the ticker chip goes.
• Pills: the 4 tones stay. Only one washed pill per viewport; the others become text plus hairline. Colour never carries meaning alone: every pill carries a sign or a word (+2.23%, 62.8% premium). Bloomberg estimates 20,000 of its Terminal users have colour-vision deficiency and ships alternate colour schemes for them; here the positive and accent-text luminances are close (0.301 vs 0.221), so redundancy is mandatory.
3.2 Chart palette rules
Series
Colour
Stroke
Label
S1, the subject (price)
ink #F2F0EA
1.5px solid
Direct label at line end
S2, overlay (your Two-Axis Rule)
amber #C79A2E (7.58)
1.5px solid
Direct label, right axis
S3
read #C6C1B7 (10.97)
1.5px dashed 6/4
Direct label
S4
muted #A8A29A (7.77)
1.5px dotted 1.5/3.5
Direct label
S5 (max)
quiet #85816F (5.03)
1.5px dash-dot 6/3/1.5/3
Direct label
• Count: 3 series is the target, 5 is the hard cap. Peer comparisons beyond 5 become small multiples.
• Green and red appear in charts only to encode sign (gain/loss, discount/premium) and never as categories. A sign legend and a zero baseline are mandatory.
• Forecast or this-model line: the second line dashed in accent-text, as your doc already says. This is the only categorical use of oxblood.
• Sequential ramp (Carbon's rule: on dark the lightest is the largest, on light the darkest is the largest). Dark: #2B2B2C, #50504F, #7E7E7C, #B1B0AC, #F2F0EA. Light: #D3D1CB, #B0AEA8, #84827C, #54524C, #16150F. Steps 1 and 2 fall below 3:1, so such cells need a hairline outline and a printed value. Carbon also warns against using gradients in place of a stepped sequential palette.
• Diverging: only with a true midpoint, such as price against value. Negative uses the accent-text ramp, positive uses the positive ramp, midpoint #50504F, and every cell prints a signed value.
• Axes and grid: 13px labels in quiet. CHANGE: DESIGN.md says 11px for PriceChart, which breaks your own 13px floor. At most 5 horizontal gridlines, 1px line, and no vertical gridlines.
• Keep from your doc: gaps are gaps, one scale per line, readout fixed under the chart.
• No pie, donut, 3D, stacked area, gradient fills (other than the price fill), or legends that need a lookup.
• CVD test: every chart is checked under deuteranopia and protanopia simulation before release.
4. Motion tokens
The curves are Carbon's productive set, lifted from its motion tokens, so they are tested rather than invented. Carbon's checklist puts micro-interactions at 90–120ms, and its fast-02, moderate-02 and slow-02 tokens are 110, 240 and 700ms.
--m-ease-standard: cubic-bezier(0.2, 0, 0.38, 0.9);   /* state change in place */
--m-ease-enter:    cubic-bezier(0, 0, 0.38, 0.9);     /* things arriving */
--m-ease-exit:     cubic-bezier(0.2, 0, 1, 0.9);      /* things leaving */
--m-ease-expr:     cubic-bezier(0.4, 0.14, 0.3, 1);   /* landing hero only */

--m-dur-press: 70ms;   --m-dur-fast: 110ms;   --m-dur-base: 200ms;
--m-dur-mod: 240ms;    --m-dur-slow: 280ms;   --m-dur-reveal: 400ms;
--m-dur-count: 600ms;  --m-dur-chart: 640ms;  --m-dur-hero: 700ms;
Exit = 70% of enter, always on --m-ease-exit. Only transform, opacity and (for the chart reveal only) clip-path are animated. transition: all is banned.
Motion
Where
Properties
Duration · curve
Limits
Page transition
Main content region only
opacity; translateY 8px→0
Out 120ms exit · in 280ms enter
Header, tab row and bottom bar never move. Route renders immediately; skeleton only after 200ms of waiting. Tab switches inside a company are an instant swap.
Reveal on scroll
Landing and /learn only
opacity; translateY 12px→0
400ms enter
Once per element, threshold 15%, stagger 50ms, max 4 siblings (150ms total).
Number count-up
Landing coverage stats only (10,000+, 5Y, 0, 3)
text content, tabular
600ms standard
Once, when 50% visible. The final value is in the HTML. Never in product screens.
Chart draw-in
PriceChart first mount per page view
clip-path: inset(0 100% 0 0)→0 on the container
640ms enter, fill fades in over 200ms after
Never on hover, refresh or data update. Range change is a 110ms crossfade. Overlay toggle fades in over 200ms.
Hover
Buttons, chips, tiles, rows, links
color, border-color, background-color
110ms standard
No lift, scale or shadow. Tile border goes to quiet at 40% (existing).
Press
Buttons, chips
background-color
70ms standard
Wash 35%→50%. No scale.
Focus ring
All interactive
outline-color
0ms
Appears instantly, never animated.
Disclose
Every Disclose row
height, opacity; chevron 0→90°
200ms enter / 140ms exit
Existing, kept. Body is indented 24px.
Sheet open
Phone: bottom sheet. ≥1024px: right drawer 480px. Used for Margin notes, definitions, filters, saved models
translateY(100%→0) or translateX(100%→0)
280ms enter / 200ms exit
Scrim fades over 240ms. Focus is trapped, Esc closes.
Modal
Build overlay
opacity; translateY 8px→0
240ms enter
The existing no-flicker rule (nothing for the first second) and Two Beats timing (2.2s) are kept.
Header condense
Condensed bar
translateY(-60px→0)
280ms enter
Existing. Replace its easeOut with --m-ease-enter.
First-load tile entrance
Metric tiles, first mount per company per session
opacity; translateY 8px→0
200ms enter, 50ms stagger
After tile 5 there is no extra delay; total ≤ 400ms.
Scroll-progress rule
Header
transform scaleX
None (1:1 with scroll)
Passive, transform only.
Changed figure
After a user edits an assumption
color to accent-text
110ms
Instant value swap, no tween.
5. Forbidden motion
• Any number animating after first load: tweening, rolling digits, flashing on update. DESIGN.md's phrase 'including any number that tweens' is CHANGED to 'no number tweens'.
• A ticking clock. The header currently shows seconds (22:02:08 → 22:05:53). Remove the seconds and the 'live' dot; show an 'As of 16:35 UTC' stamp beside data instead.
• Parallax, scroll-jacking or scroll-linked animation on /company/* and any data screen. On the landing page, parallax is limited to 24px of translate per viewport, transform-only, off on touch and under reduced motion.
• Table rows entering, reordering or sorting with animation. Tables render complete.
• Skeleton shimmer, animated gradients, typewriter text, bounce, spring or overshoot easing, blur transitions.
• Animating width, height, top, left, margin, box-shadow or filter. The only height animation is Disclose. web.dev advises restricting animation to opacity and transform to stay on the compositor.
• Staggers longer than 5 items. Page-load sequences longer than 600ms in total. Any interaction response over 280ms.
• Auto-advancing carousels and looping animation on product screens. Autoplay longer than 5s must have a pause control (WCAG 2.2.2).
• Tooltips that follow the pointer (existing rule).
• Chart redraw or re-animation when data refreshes or the window resizes.
6. Where 3D and depth may be used
• Allowed: landing hero (particle wordmark) and at most one secondary landing scene.
• Not allowed: /company/*, /financials, /learn, Margin notes, modals, and any screen showing figures.
• One WebGL context per page. Screenshot 2 shows a second particle scene (the hexagon). It must reuse the hero's canvas and buffer, or become a static 1px-stroke SVG hexagon.
• Budget (desktop):
    ◦ Particles: ≤ 12,000 (hero), ≤ 6,000 (secondary).
    ◦ Frame cost: ≤ 4ms GPU+script per frame on a mid-tier laptop.
    ◦ 3D chunk: ≤ 180KB gzip, lazy-loaded after first paint; a minimal library or raw WebGL2 beats a full engine.
    ◦ Canvas: devicePixelRatio ≤ 1.5, internal resolution ≤ 1920×1080.
• LCP: a static poster (WebP ≤ 60KB) is the Largest Contentful Paint element. The canvas fades in over 400ms after its first frame. LCP ≤ 2.5s, CLS ≤ 0.1, INP ≤ 200ms.
• Adaptive: sample 30 frames. Above 20ms average, halve the particles. If still above 20ms after two halvings, freeze on the poster.
• Lifecycle: pause when the hero is under 10% visible or document.hidden. Animation auto-settles after 5s (WCAG 2.2.2) and moves only on pointer input afterwards. A 24×24px Pause/Play control sits at the hero's lower edge.
• Depth elsewhere is tonal only (section 2).
7. Accessibility
• Contrast (AA): text 4.5:1; large text (≥24px, or ≥18.66px bold) 3:1; interface boundaries, icons, focus rings and chart marks 3:1. npm run verify is extended to cover overlay, line-control, the Light-theme tokens and the sequential ramps. accent stays out of the text list.
• Focus (CHANGE): outline: 2px solid ink; outline-offset: 2px (paper-ink on Paper), keyboard only. 1px read-oxblood is thin and sits on controls that are already oxblood. Ink is 17.26:1 on page and 8.0:1 on accent, so it works on any surface, which is the principle behind GOV.UK's focus colour. Never remove or restyle it per component.
• Focus not obscured (WCAG 2.4.11): scroll-padding-top: 88px and scroll-padding-bottom: calc(var(--bottom-bar-inset) + 16px), so a focused element never lands under the fixed header or bar.
• Target size (WCAG 2.5.8): every pointer target ≥ 24×24 CSS px, and ≥ 44×44 under (pointer: coarse). The ⓘ glyph is about 13px today; expand the hit area with a pseudo-element.
• Reduced motion: under prefers-reduced-motion: reduce, and under the Settings override 'Reduce motion' (data-motion=reduced), all transforms and travel go to 0 and transitions become opacity-only ≤ 110ms. Count-up and chart draw-in are skipped. Both particle scenes are replaced by the poster, and Disclose snaps with the chevron rotating instantly. The sheet appears with a 110ms fade. Smooth scrolling is off. JavaScript-driven motion subscribes to the media query's change event, because CSS overrides do nothing to it.
• Text: 13px floor, 15px body. Layout reflows at 320 CSS px and at 200% text zoom. Tables scroll inside their own container with a sticky first column.
• Language and numbers: lang=en-IN, Indian grouping preserved. Negative numbers use U+2212 or parentheses, never a hyphen.
8. Phone performance
Low-end detection (any one; CHANGE, Nihar, 4 November 2026, VISUAL_BUILD_PLAN V7): navigator.hardwareConcurrency ≤ 2; deviceMemory ≤ 2 (where exposed); connection.saveData; effective type 2g or 3g; no WebGL2; or a frame average above 24ms in the first second. Also treat any viewport under 640px wide as constrained.
Drop on low-end or ≤ 640px
Replacement
WebGL particle scenes
Static poster
Scroll reveal, stagger, count-up, chart draw-in
Content visible immediately
backdrop-filter (header and scrim)
Page at 98%, scrim 0.72 flat
Parallax, hover transitions on touch
None
Page-transition travel
Opacity only, 120ms
Budgets on every phone:
• At most 2 elements animating at once and 6 composited layers.
• will-change on ≤ 8 elements, applied just before the change and removed after.
• Script per frame ≤ 8ms within the 16.7ms frame.
• Motion JS on product screens ≤ 20KB gzip; if you use Framer Motion, load it via LazyMotion with domAnimation, otherwise use CSS and the Web Animations API.
• No animation runs while scrolling a table.
9. Iconography and illustration
• Icons: one outline set. 16px inline, 20px in nav, stroke 1.5px, currentColor, square ends and mitred joins (stroke-linecap: square; stroke-linejoin: miter) to match 0px corners. Muted at rest, ink on hover. No filled, two-tone or coloured icons, and no emoji.
• ⓘ (CHANGE): replace the glyph on every label with a 1px dotted underline on the label itself, which is the tooltip trigger. Keep an explicit ⓘ only where the label cannot carry an underline. Tooltips are 13px sans, weight 400, on overlay.
• Illustration: (1) 1px hairline diagrams in ink and quiet, with one focal element in accent-text; (2) the particle field, landing hero only; (3) graphics drawn from real filed numbers. No people, mascots, stock or 3D renders, isometric scenes, mesh gradients or decorative blobs.
• Labels in diagrams: 13px; max 3 colours per diagram.
10. Ten references to study
Each was opened during research.
1. IBM Carbon, Motion. https://carbondesignsystem.com/elements/motion/overview/ . Take the productive and expressive easing curves, the duration tokens, and the rule that micro-interactions sit at 90–120ms.
2. IBM Carbon, Data-visualisation colour. https://carbondesignsystem.com/data-visualization/color-palettes/ . Take the categorical, sequential and diverging split, the dark-theme rule that the lightest value is the largest, and the warning against gradients standing in for sequential palettes.
3. Vercel Geist, Colors. https://examples.vercel.com/geist/colors . Take the role-numbered scale (1–3 component backgrounds, 4–6 borders, 7–8 solid backgrounds, 9–10 text), which is a model for naming your line and line-control tiers.
4. Stripe, Designing accessible color systems. https://stripe.com/it-ca/blog/accessible-color-systems . Take the method of fixing contrast in a perceptually uniform space (CIELAB) so tones across hues match; use it when you add any hue.
5. Linear, How we redesigned the Linear UI. https://linear.app/now/how-we-redesigned-the-linear-ui . Take theme generation from three inputs (base, accent, contrast) in LCH, and the discipline of reducing visual noise in headers, tabs and panels.
6. GOV.UK Design System, Focus states. https://design-system.service.gov.uk/get-started/focus-states . Take a focus treatment engineered to pass non-text contrast on every background in the system, and the rule that the colour is reserved for focus only.
7. Bloomberg, Accessibility. https://www.bloomberg.com/ux/accessibility/ . Take the treatment of colour-vision deficiency as a design input and the alternate colour schemes; this is why sign must never rely on red or green.
8. Koyfin, Theme update (Light and Dark only). https://www.koyfin.com/help/theme-update-light-and-dark-modes-in-koyfin/amp/ . Take the decision to cut a finance product's themes down to two.
9. Stripe Dashboard, Apps design docs. https://docs.stripe.com/stripe-apps/design . Take the consistent page-header-plus-tabs pattern, one panel at a time, which mirrors your tab row.
10. Awwwards, Finance gallery. https://www.awwwards.com/inspiration_search/finance/ . Take it as a visual-trend reference only (it lists Moto Finance, Site of the Day, 24 Sep 2026). I could read the listing text but not judge its visuals, so open it in a browser before borrowing anything.
Supporting references: web.dev How to create high-performance CSS animations (https://web.dev/animations-guide/); web.dev prefers-reduced-motion; W3C What's New in WCAG 2.2 (https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/).
11. Conflicts in your current screenshots
Severity: H breaks a stated rule or hurts data trust; M inconsistency; L polish.
#
Screenshot
Finding
Fix
Sev
1
6, Financials
Same row mixes formats: cost of sales is 9,439.0, then 11,618, 16,621. Decimals appear by magnitude, so tabular alignment breaks. The .0 rows end about 6px from the others and from the column header.
One decimal rule per row (0 dp in millions), one right edge shared with the header. Zero is 0; not reported is —; negatives use U+2212.
H
2
6
Row labels and values are both bold, so nothing leads.
Labels 400, subtotals 600, values 400. The first column aligns to the 274px edge, not 297px.
M
3
All 9
A neon yellow starburst in a rounded dark square sits at the right edge. If it is your feedback control, it adds a second hue and a radius. If it is a browser extension, ignore it. I cannot tell which.
If yours: square, quiet, palette colours, bottom-right.
H
4
1
Four nav links at rest in oxblood, plus a red-washed Search. Breaks No Red Labels and the accent budget.
Muted at rest, ink on hover, ink plus 2px underline for current. Search becomes ghost.
H
5
8
Header carries a clock, five controls, and a red Search, then a red Download below it: two primaries. Roughly 7 oxblood elements in one viewport.
Section 3.1 budget. Move Check the figures, Home and All companies into one menu.
H
6
1, 6, 8
Clock shows seconds on every screen.
Remove (section 5).
M
7
1, 2
The closing mark renders as about a 5px dot (0.13em of 36px = 4.7px), so the signature mark reads as a stray full stop.
CHANGE: mark = max(0.13em, 6px). The -0.21em margin is untouched.
M
8
1, 4, 5, 8
Sizes outside the four steps: hero paragraph about 22px, myth correction about 40px, tile figures about 24px (doc says 17px).
ADD two landing-only steps, Lead 20px/1.5 and Display clamp(40px,5vw,64px). Tile figure becomes 24px as a fifth product step, with DESIGN.md updated to match. Verify computed sizes first.
M
9
5
Selected state differs: range and overlay chips use a dark wash, the ticker chip is solid oxblood (screenshot 8).
One definition (section 3.1).
M
10
5
ⓘ on 11 of 12 tiles at about 13px, a target below 24px, and visual noise.
Dotted-underline trigger (section 9).
M
11
8
Sub-nav hairlines run x=54→1854 while the content runs 114→1794 (60px overshoot each side). 'Model a list' is a red button inside a tab row.
Align to the container. Make it a ghost button after the row.
M
12
7
Seven or more rows of three identical outlined 46px buttons, with no selected state visible.
One segmented control per row: 32px high, line-control border, selected per 3.1.
M
13
7 vs 8
The Disclose chevron is on the right in 7 and on the left in 8.
Left, as specified.
M
14
3
Stat numerals ('10,000+', '5Y') and the revenue sentence are in Newsreader, but Newsreader is titles-only and figures are tabular Source Sans. Revenue 10,52,851 is red, but a figure is always ink. Eyebrows are red on paper and muted on dark (screenshot 2).
Figures in Source Sans tabular, ink; eyebrow words muted on both grounds; the sentence in Source Sans.
M
15
3
The Revenue row is about 96px tall, with its connector line meeting it mid-row.
Row ≥ 40px; connector leaves at the row's vertical centre.
L
16
4
Page behind the overlay is blurred, and a card-less myth line sits about 60px above the divider.
Scrim token (section 2); tighten to 24px. The ⓘ is 13px (finding 10).
L
17
5, 8, 9
× in screenshot 5 but x in 8 and 9 (12.0x, 0.02x net cash).
× everywhere, in the figure formatter.
L
18
9
The label column and its value are about 800px apart, so the eye loses the row; 'out of range' is text in a numeric column.
Cap table width at 960px, or add a 1px dotted leader. Show 'out of range' in quiet with the unit.
L
19
1, 2
Titles at -0.02em look tight at word gaps ('Real financials. Live models').
CHANGE: letter-spacing: -0.015em; word-spacing: 0.04em. Judged by eye; confirm in the browser.
L
20
1, 6, 8
Header height is about 65, 89 and 105px across screens.
Fixed 64px, condensed 48px.
M
21
8
A green day-change pill sits beside red premium pills: a traffic light in the verdict row.
Washed pill budget (3.1).
L
DESIGN.md debt to clear in the same pass
• Buttons, chips, pills and nav still say 'uppercase mono', which contradicts the Uniform Label rule and the 13px floor.
• typography.hero-figure and tile-figure are referenced but not defined.
• 'A computed figure' is allowed in accent-text, while 'a figure is always ink'.
• PriceChart axis labels are 11px.
12. Verification to add to npm run verify
1. Contrast for every new token on every ground it appears on.
2. Fail on transition: all.
3. Fail on animation of any property outside transform, opacity and the chart's clip-path.
4. Fail on any duration or easing literal outside the --m-* motion tokens.
5. Fail on font sizes under 13px, including SVG text.
6. A reduced-motion pass in the screenshot suite at 360px and 1440px.
7. A Lighthouse run on the landing page with the budgets in section 6.