# Marginalia — house rules

**Read this first, every session, before touching anything.** It is short on
purpose. The long documents are listed at the foot; this is the part that is the
same in every job.

---

## The first design principle

> **At every point, on every screen, Marginalia must look modern, highly
> attractive and high-budget, yet simple, clear and professional. Never messy or
> cluttered. The first impression is the look, so no screen ships unless it
> meets this standard.**

It comes before everything in `DESIGN.md`. A screen that is correct and ugly is
not finished. If a change makes a screen busier, that is a reason to stop and
rethink the layout, not a cost to accept.

---

## How a session runs

- **One job per session.** Finish it. Do not start a second because the first
  went quickly; the next job gets its own session and its own commit.
- **Full suite before the commit:** `npm run verify`, `npm run verify:workbook`,
  `npm run verify:dashboard`, `npx tsc --noEmit`, `npm run build`. Every Checks
  row at zero. Report the numbers, not "all green".
- **One commit.** The message says what changed, what was measured, and what was
  proved to fail without the fix.
- **Push only when asked.** Never push on your own initiative. Say plainly that
  the work is committed and not pushed.
- **Documentation-only jobs** (`docs/`, `ROADMAP.md`, `CLAUDE.md`, the other
  `.md` files) do not need the suite, because no verification reads them. Say so
  rather than running it or skipping it silently.
- **End every job with a short plain-language summary**: what changed, the
  numbers that were measured, what was not done and why. No jargon the user did
  not use first.

---

## Where a thing is written down

Four files, four jobs. Putting a finding in the wrong one is how it gets lost.

| File | What belongs in it | What does not |
|---|---|---|
| `KNOWN_ISSUES.md` | **Our own mistakes only** — things this repository does incorrectly and can fix. Every entry: what is wrong, where, how it was measured, how many companies it affects, the worst example, roughly what it moves. A permanent ID, never reused. | Anything deliberate. Anything the source does not publish. |
| `METHODOLOGY.md` | **How the engine actually works** — every line's source, its forecast driver, what happens when a figure is missing, and the convention each choice follows or departs from. | Defects. What the source will not give. |
| `DATA_CONSTRAINTS.md` | **What the filing or the data source does not publish**, with the bound on what each gap could do to a value, the warn-or-refuse threshold, and which source it comes from. | Anything we got wrong ourselves. |
| `ROADMAP.md` | **The plan**: what is built, next, waiting and decided against. Statuses from `docs/VISION.md`. | Defects. A defect found while building a roadmap item goes to `KNOWN_ISSUES.md`. |

**The rules that keep them honest**

- Fixing something in `KNOWN_ISSUES.md`? **Delete its entry in the same commit
  as the fix.** Do not mark it resolved; remove it, and add it to the retired
  list in the ID ledger.
- Found something wrong and not fixing it now? **Add an entry**, with a measured
  number. "Probably wrong" is not an entry.
- Changed how the engine works? **Update `METHODOLOGY.md` in the same commit.**
- Shipped a roadmap item? **Status to Built and a line in the Shipped log with
  the hash**, in the same commit. A commit cannot know its own hash, so the
  convention is a one-line follow-up commit ("Point the shipped log at `abc1234`").
- **Never delete a roadmap item silently.** Something not being built goes to
  "Decided against" with the reason. Something reversed keeps its old entry and
  says what reversed it.

---

## Standing decisions

Changing one of these is a decision for Nihar, not a code change.

1. **The engine builds every model.** No hand-built company models on the site.
   The hand-built Apple file is a test fixture and a verification reference.
2. **Judgements belong to the user; arithmetic belongs to the engine.** Every
   modelling choice states its default, says where the default came from, and
   can be changed. Never hide a judgement inside a calculation.
3. **Refuse rather than approximate.** A company that cannot be modelled
   honestly gets a plain-English refusal naming what is missing. **Missing data
   is never treated as zero** — zero is a claim the company reported zero.
4. **Never blend valuation methods.** Income, market and asset approaches sit
   side by side. The perpetuity and exit-multiple terminal values are shown
   separately, never averaged.
5. **Four visible states.** Reported, corrected, reclassified and modelled are
   always distinguishable. A corrected figure is never shown as filed.
6. **Explain mechanics, not merit.** A fact plus a definition is education;
   calling a number a warning sign is an opinion on a security.
7. **No false or unverifiable claims.** Anything not built is labelled as being
   built.
8. **AI only where its output can be checked against a source.** Extraction with
   the sentence quoted and its page number is fine. An AI-generated judgement is
   not.
9. **Every module verified before it ships** — against the identities any
   correct model must satisfy, then against published worked examples as a
   cross-check. Where ours and a published example disagree, investigate.
10. **Primary sources only.** Filings and official registers, each item linked to
    its own document. Never copied from another database.
11. **Consent for personal data.** No scraped contact databases; buyers and
    sellers opt in.

---

## Launch principles

1. **Nothing waits on SEBI.** Every feature is built now on the private site —
   including ratings, recommendations and research that carries an opinion —
   with the regulations designed in.
2. **The site goes public only after the licences are received.** A regulated
   feature is built and left switched off; the switch is the licence.
3. **Paid items are built last**, just before launch: licensed prices, live
   options data, analyst estimates, WhatsApp delivery, document storage,
   full-scale AI reading, MCA fees at scale. Each tested on a free or small
   sample first.
4. **Not wanted at all:** scraped contact databases, and placing trades.
5. **Outreach starts once the product is fully developed.**

---

## Ask before you do these

- **Never simplify the Excel workbook's structure without asking first.** Not the
  138-row chart of accounts, not the sheet set, not the circularity switch, not
  the live formulas, not the row positions a firm's macro depends on. It looks
  like redundancy and it is the contract. If a change seems to need it, stop and
  ask.
- Never remove a verification check to make a run pass.
- Never change a published default, threshold or refusal rule as a side effect of
  another job.
- Never push, and never commit to `main` without being asked for the commit.

---

## Traps this repository has already fallen into

Each of these cost a debugging session. They are listed so the next one is
cheaper.

**Seeding a sheet from the engine's answer** (`KI-4`, and five more on 28
September 2026). A workbook cell pasted with the engine's result is right at rest
and wrong on the first edit. Every value the workbook writes about the model must
be a **formula or a live link**, never a copy. The same rule applies to prose: a
sheet that writes its own account of a rule can describe a rule the engine does
not use.

**Two copies of a positional layout.** The model sheet's row numbers live in one
map (`MODEL_SHEET_ROWS`) and the DCF sheet's in another; a second copy goes
stale. Read them from the one definition.

**A check that cannot fail.** Prove every new check fails without its fix, by
breaking the fix on purpose and watching the check report it. Checks that have
passed while the thing they guard was broken: the bottom-bar clearance (twice),
the saved-model comparison (both sides came from the same function), the
unmapped-figures check, and the EBITDA bridge's own tie.

**Comparing a figure against itself.** If the expected value and the actual value
come from the same code path, the comparison proves nothing. Compute the expected
value the way the screen computes it.

**The sliders can mask a missing judgement.** On some companies a driver pins the
margin a classification would have changed, so the value agrees while the record
is wrong. Assert the state, not only the number.

**Line endings.** `core.autocrlf` is on. Reading a file as text and writing it
back converts the whole file, which turns a six-line change into a four-thousand
line diff. Read and write with explicit line endings, and check `git diff --stat`
before committing.

**Playwright and `page.evaluate`.** A named arrow function inside `evaluate` is
wrapped by esbuild in a `__name()` call that does not exist in the page. Pass a
string, or keep the body inline.

**Strict-mode locators.** A sentence that exists on the company page and in the
batch overlay matches twice. Scope the assertion; a body-wide text search would
also pass with the thing under test blank.

**HyperFormula cannot recalculate the model sheet naively.** It is deliberately
circular — interest on average balances, with the circuit breaker at `$E$9` — so
a plain pass returns `#CYCLE!` on hundreds of cells. `verify/scenarios.mts` owns
the iterative machinery that resolves it.

**The share price is a valuation input.** The cost of capital weights equity at
market capitalisation, so where the WACC is left at its default the price moves
the value. Anything that reproduces a valuation has to carry the price it was
struck against.

**A blank cell reads as a reported nil.** In a filled template, a workbook or a
bridge, write "not reported" instead.

---

## The documents

| File | What it is |
|---|---|
| `docs/VISION.md` | **The product plan.** What Marginalia is, who it serves, the rules, the platform structure, and every planned item with its status. Converted from `docs/plan/`. |
| `docs/FEATURES.md` | **The feature bible.** Every feature of the 27 studied tools plus FRED and Yahoo Finance, how Marginalia provides each, and 30 combined features no single tool offers. |
| `ROADMAP.md` | The plan as this repository tracks it, with the Shipped log. |
| `METHODOLOGY.md` | How the engine works. |
| `KNOWN_ISSUES.md` | What this repository does incorrectly. |
| `DATA_CONSTRAINTS.md` | What the sources do not publish. |
| `CONVENTIONS.md`, `CONVENTIONS_AUDIT.md` | Modelling standards, and how the code measures against them. |
| `DESIGN.md` | The design system. The first design principle above comes before all of it. |
| `verify/README.md` | What each check in the harness does. |

**Where `ROADMAP.md` and the two `docs/` files disagree, the `docs/` files are
the plan and the roadmap is behind.** Say so rather than reconciling them
quietly.
