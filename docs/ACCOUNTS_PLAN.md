# Accounts and a server database — the plan (build step 7)

**Status: a plan, written 3 November 2026; decisions 1–5 approved by Nihar on
4 November 2026 (§9). Nothing here is built, provisioned or paid for. No account with any provider
has been created, and no code in this repository talks to a server store.

**How the sources were read.** This session's network policy refused direct
fetches of `supabase.com`, `neon.com` and `firebase.google.com`. So every price
below comes from search results that quote the providers' pages, and the
provider's own page is linked beside each one. **Every price is marked "not
confirmed" until someone opens that page in a browser.** That check is the first
item in job A0 (§8). The legal points cite the statute or regulation itself;
where a source disagreed with another, both are given.

---

## The case, in one paragraph

Today a reader's work lives only in the browser they made it in. Clearing site
data deletes it, a second device cannot see it, and nobody can be told when
something they watch has changed. Three specs already promise more and wait on
this step: saved screens (`docs/SCREENER_SPEC.md` rule 22), versions for the
valuation bridge (`docs/VALUATION_SIDE_BY_SIDE_SPEC.md` rule 25), and overview
edits saved to the model "on this device" (`docs/COMPANY_OVERVIEW_SPEC.md` D6).
The engine needs no change for any of this. KI-27 already made a saved model
carry every judgement, and `src/data/savedModels.ts` already stores records
behind an interface written so that "a server store is a second implementation
and the shape does not change" (`METHODOLOGY.md` §22f). **Step 7 is that second
implementation, plus the account around it.**

---

## 0. What is stored today, and where

Read from the code on 3 November 2026.

| What | Where it lives | Key / name | Shape | Notes |
|---|---|---|---|---|
| **Saved models** | `localStorage` | `marginalia.savedModels.v1` | `SavedModel[]`, `SAVED_MODEL_VERSION = 3` | `src/data/savedModels.ts`. Carries the sliders, view mode, corrections and their reasons, head assignment and its reasons, qualitative answers (ticked and applied), peer set, recovery rates, the share price it was struck against, and `produced` (the figures at save time). Older records are migrated on read and name what they lack (`missing`, `carriedOver`). Behind `SavedModelStore` with `localStore` as the one implementation. Export and import to a file already use `serialise` / `parse`. |
| **Edits on the figures screen** | React state only, **not persisted** | — | `Corrections`, `CorrectionReasons`, `HeadAssignment` | `figuresEditor.tsx:715` says "Nothing is uploaded or stored; a change lives in this browser tab." They survive only by being saved inside a saved model. |
| **Saved screener screens** | `localStorage` | `marginalia.screens.v1` | `{ name, search }[]`, last 12 kept | `src/components/screenerScreen.tsx:68`, `:145`, `:215`. `search` is the query string, so a screen is its web address. |
| **House templates** (firm Excel layouts) | IndexedDB | DB `marginalia.houseTemplates`, store `templates` | `{ id, name, bytes: ArrayBuffer, fileName, mapping, savedAt }` | `src/data/templateStore.ts`. `STORAGE_STATEMENT` writes the on-screen claim into code ("sentAnywhere: false"). |
| Watchlists, notes, alert settings, thesis journal | **do not exist yet** | — | — | The "Your notes" tab has an address and says it is being built (`ROADMAP.md` §13a). |
| The change log behind the valuation bridge | **does not exist yet** | — | — | The bridge spec reads versions from saved models. |

**One thing the server store cannot inherit as written.** `SavedModelStore` is
synchronous: `all(): SavedModel[]`, `put(): boolean`. A network store cannot
answer synchronously. Job A4 changes the interface to return promises, with
`localStore` wrapped to match, before any server code exists. That is the one
change the "shape does not change" promise did not foresee. The record's shape
still does not change.

---

## 1. What must be stored per user

### 1.1 The tables

Postgres, one schema, every table carrying `user_id` and row-level security
(§6). Every row stores the reader's own inputs. **None stores an answer the
engine can recompute**: that is the trap in `CLAUDE.md` ("Seeding a sheet from
the engine's answer"), applied to a database.

| Table | One row is | Columns that matter | Why this shape |
|---|---|---|---|
| `profiles` | a person | `user_id` (= auth user), `created_at`, `notice_version_accepted`, `age_confirmed_at`, `deleted_at` | The account itself. Holds no name unless the person types one. |
| `saved_models` | a named model | `id`, `user_id`, `ticker`, `name`, `created_at`, `head_version_id` | The thing in the saved list. Its judgements are in its versions. |
| `model_versions` | one save of a model, **immutable** | `id`, `model_id`, `user_id`, `parent_id`, `record jsonb` (the `SavedModel` as `serialise` writes it, untouched), `record_version int`, `data_basis jsonb`, `note`, `saved_at` | **Superseded, never edited**: the same rule as the figures store (`docs/DATA_LAYER_PLAN.md` §6.3) and the archive (`docs/ARCHIVE_PLAN.md` §1). A new save is a new row whose `parent_id` points at the last one. Every judgement and its reason is inside `record`, exactly as KI-27 restores it today. |
| `screens` | a saved screener screen | `id`, `user_id`, `name`, `search text`, `created_at` | The query string *is* the screen, as it is today. |
| `watchlists`, `watchlist_items` | a named list; a ticker on it | `id`, `user_id`, `name`; `watchlist_id`, `ticker`, `added_at` | Plain. |
| `notes` | a reader's note on a company | `id`, `user_id`, `ticker`, `body`, `model_version_id` (optional), `created_at`, `updated_at` | The store behind the "Your notes" tab. Linking a note to a version lets "why I chose 9%" sit beside the model that chose it. |
| `alert_settings` | one thing a reader wants to hear about | `id`, `user_id`, `kind` (filing, result, ratio, thesis break), `ticker` or `theme`, `condition jsonb`, `channel` (`email`; `whatsapp` later), `enabled` | **Settings only.** Sending needs the scheduler that the data layer also needs (`docs/DATA_LAYER_PLAN.md` §6.2). Until that exists, the screen says the alerts are "saved, not sent yet" (standing decision 7 in `CLAUDE.md`). |
| `consent_events` | one consent given or withdrawn | `user_id`, `notice_version`, `purpose`, `given_at`, `withdrawn_at` | DPDP needs proof of consent and its withdrawal (§5). An append-only log. |

**Later, and not built in step 7:**

| Table | Why it waits |
|---|---|
| `thesis_entries` (why I bought, "I will sell if…", tied to a `model_version_id`) | The investor area is Next (`ROADMAP.md` §15). The table is cheap, but the screen comes with that area. |
| `organisations`, `memberships`, `firm_templates` | Firm templates need shared ownership (a firm, its members, roles), and they need the template **file** stored on a server. Document storage is **Paid · last** (`docs/VISION.md`, launch principles). House templates stay in IndexedDB until then, and the claim in `STORAGE_STATEMENT` stays true. |
| A corrections database (learning from readers' fixes, `ROADMAP.md` §2) | **A different purpose from storing a reader's own work.** Under DPDP and GDPR alike it needs its own notice and its own opt-in. Accounts must not switch it on by the back door (§5.4). |

### 1.2 Versions and the change log behind the valuation bridge

- **The log is the version chain.** Every save of a model makes a
  `model_versions` row pointing at its parent. Nothing is overwritten, so any
  two versions can be bridged.
- **The bridge is never stored.** Shapley attribution is recomputed from the
  two records each time (`VALUATION_SIDE_BY_SIDE_SPEC` rules 13–20). A stored
  bridge would be the engine's answer pasted into a row: right at rest and wrong
  the day the engine changes.
- **The list of what changed is never stored either.** It is the difference
  between the two records' inputs, computed when shown. The reasons are already
  inside each record (`correctionReasons`, the head reasons), and the
  `note` column holds the reader's own words about the version.
- **"New data" needs a stored fact, and the record may not hold it yet.**
  Bridge rule 18 makes a change of filings its own labelled driver, so each
  version must record which data it was struck on: the filing identities or a
  payload fingerprint. That is `data_basis`. `METHODOLOGY.md` §22f says the saved
  list already detects "the filings behind it have been fetched again since", so
  some fingerprint exists. **Not confirmed** whether it identifies the filings
  or only the fetch; job A5 checks it before relying on it.
- **`produced` stays in the record and is used as it is today.** The list
  prints it beside the reopened figure, never instead of it (§22f).

### 1.3 How big this is

**Not measured.** No company payload is in this checkout, so no saved model
could be built and weighed. As a working guess, a version-3 record is tens of
kilobytes: the corrections and heads are per-line maps. If a heavy user keeps
200 versions at 50 KB, that is 10 MB. At 10,000 users with a typical 100 KB
each, that is about 1 GB. Job A1 measures the real record size on the payload
set, and the costs in §3 are re-checked against it.

---

## 2. Sign-in

| Option | Cost | Security | Effort | Verdict |
|---|---|---|---|---|
| **Email magic link, with a 6-digit code in the same email** | One email per sign-in. Resend: free for 3,000 a month (100 a day), then $20 a month for 50,000 ([resend.com/pricing](https://resend.com/pricing); not confirmed). Supabase's built-in mailer is for testing only, about 2 an hour. A real sender is needed from the first outside user ([Brevo's Supabase SMTP guide](https://developers.brevo.com/docs/supabase-smtp-integration); not confirmed). | As strong as the person's email account. No password to leak or reuse. Links are single-use and short-lived. **The code in the same email matters.** Corporate mail scanners commonly open links in advance and use up one-time links (widely reported; not confirmed for any named scanner), and the code still works when that happens. | **Low.** Built into Supabase Auth. Needs a sending domain with SPF and DKIM. | **Recommended first.** |
| **Passkeys** (WebAuthn: fingerprint, face, device PIN) | $0. | **Strongest.** Phishing-resistant, since the key is bound to the site. Recovery still needs email. | **Medium.** Supabase Auth has passkeys **in beta, with an experimental client API that "may change without notice"** ([Supabase changelog](https://supabase.com/changelog); not confirmed). | **Second.** Offered after an email sign-in as "add a passkey to this device", once the API leaves beta. Never the only way in. |
| **Google** | $0 for sign-in (no charge has been found; not confirmed against a Google page). | Good, since it inherits Google's protections. **It tells Google which site a person uses.** Some professionals sign in with a work address that is not a Google account. | **Low to medium.** A Google Cloud OAuth client and consent screen. Verification of the app name and logo takes extra time. | **Third.** A convenience, not a necessity. |
| **WhatsApp OTP** | Meta charges per authentication message, plus a provider's fee (rate not confirmed). | Tied to a phone number. SIM-swap risk. | **High.** A business account, message templates and a provider. | **Later, Paid · last.** It belongs with WhatsApp alerts (`docs/VISION.md` §7). |

**Recommendation: email first, magic link plus code, sent through Resend from
Marginalia's own domain. Then passkeys as an optional second factor and faster
sign-in, then Google.** No passwords at any point, so there is no password store
to protect and no reset flow to build.

**Decided 4 November 2026 (§9, decision 5):** "Sign in" is a small text link to
the right of the search box in the header. This is an approved exception to
`docs/NAV_SEARCH_SPEC.md` §2.1, whose item list otherwise ends "Nothing else".

---

## 3. Database and hosting

The site is a Vite build of React on Vercel, with serverless functions in `api/`
and no database or scheduler today (`docs/DATA_LAYER_PLAN.md` §6.2). The figures
store in that plan is to be **Postgres** (`docs/ARCHIVE_PLAN.md` §3: "it moves to
Postgres when the figures store needs one"). One Postgres for both is simpler
than two systems.

### 3.1 The options

| | **Supabase** | **Neon** (what "Vercel Postgres" now is) | **Firebase** (Auth + Firestore) |
|---|---|---|---|
| What it is | Postgres, with sign-in, row-level security and an HTTP API in one product | Serverless Postgres only. Sign-in is a separate product. | A document database and sign-in, from Google |
| Vercel fit | Vercel Marketplace integration. Works from the browser and from `api/`. | Vercel's own Postgres was moved to Neon in December 2024 and is no longer offered ([Vercel docs](https://vercel.com/docs/postgres); [Neon transition guide](https://neon.tech/docs/guides/vercel-postgres-transition-guide)). Billed through Vercel. | Works, but nothing is shared with Vercel |
| **India region** | **Mumbai, `ap-south-1`** ([Supabase regions](https://supabase.com/docs/guides/platform/regions); not confirmed) | **None.** Nearest is Singapore. Mumbai is a forum request, not a region ([Neon regions](https://neon.com/docs/introduction/regions); not confirmed). | Firestore offers Mumbai (`asia-south1`) (not confirmed). **Where Firebase Auth keeps its users is not chosen by the customer** (not confirmed). |
| **EU region** | Frankfurt `eu-central-1`, and others | Frankfurt `aws-eu-central-1` | Yes |
| Free tier | 2 projects, **500 MB** database, **50,000** monthly active users. **Paused after a week with no activity** ([supabase.com/pricing](https://supabase.com/pricing); not confirmed). | 100 compute-hours a month, 0.5 GB storage (sources disagree; one says 1 GB) ([neon.com/pricing](https://neon.com/pricing); not confirmed) | Sign-in free to **50,000** MAU; Firestore 50,000 reads a day free ([firebase.google.com/pricing](https://firebase.google.com/pricing); not confirmed) |
| Paid | **Pro $25 a month**: 100,000 MAU, 8 GB database ($0.125 per GB after), 250 GB egress, $10 of compute credit covering the smallest instance; extra users $0.00325 each (not confirmed) | Launch, usage-based: $0.106 per compute-hour, $0.35 per GB-month, no minimum; "about $15 a month" for a small intermittent database (not confirmed) | Pay as you go: sign-in $0.0055 per MAU above 50,000; Firestore $0.03 per 100,000 reads, $0.09 per 100,000 writes (not confirmed) |
| Backups | Pro: daily, kept 7 days. Point-in-time recovery is a paid add-on (price not confirmed). | Restore window by plan; $0.20 per GB-month for instant restore (not confirmed) | Scheduled exports, set up by hand (not confirmed) |
| Access control | **Row-level security in Postgres**, enforced by the database whatever the client sends | Postgres RLS, but sign-in is separate, so the two must be wired together | Security rules in Firestore's own language |
| Against it | The free tier pauses. Passkeys are beta. | No Mumbai region, and sign-in is a second vendor | **Not Postgres.** The figures store would need a second database. Read and write charges grow with use. |

### 3.2 Monthly cost at 100, 1,000 and 10,000 users

Assumes the size guess in §1.3, about 4 email sign-ins per active user a month,
and fewer once passkeys exist. **Every figure is not confirmed** (see the links
above).

| | 100 users | 1,000 users | 10,000 users |
|---|---|---|---|
| **Supabase** | $0 on Free (private site, pausing accepted) or **$25** on Pro | **$25** (≈100 MB, well inside 8 GB) | **$25**, perhaps **~$40** if the smallest instance is outgrown (not measured) |
| **Neon** + a sign-in provider | ~$0–15, plus sign-in | ~$15–25, plus sign-in | ~$25–80 (always-on 1 compute unit is about $77 in compute alone), plus sign-in |
| **Firebase** | $0 | $0 to a few dollars | Probably under $10. Reads grow with every screen opened (not measured). |
| Email (Resend), any option | $0 | $0, until the 100-a-day cap bites on a busy day | **$20** |
| **Vercel Pro**, any option | — | — | **$20 per seat**. Hobby is "personal, non-commercial use" only ([Vercel Hobby docs](https://vercel.com/docs/plans/hobby)). **This applies at public launch whatever database is chosen**, accounts or not. |

**On Supabase, the total at 10,000 users is about $65–80 a month: database $25–40,
email $20, Vercel $20.**

### 3.3 Recommendation

**Supabase, one project in Mumbai (`ap-south-1`).**

- One vendor for sign-in, the database and row-level security.
- Data stays in India, the home jurisdiction for DPDP.
- Postgres, so the figures store in the data layer plan can share the project
  later.
- A free tier good enough for the private site.

Neon would be the choice only if a Mumbai region appeared and a separate sign-in
product were wanted. Firebase is ruled out by not being Postgres.

**Paid · last** (launch principle 3), each built and tested on the free tier
first:

| Item | Monthly | When |
|---|---|---|
| Supabase Pro | $25 | Just before public launch. Before that, accept the free tier's pause, or keep the project awake. |
| Point-in-time recovery add-on | not confirmed | Only if daily backups plus our own weekly dump (§6.5) prove too coarse |
| Resend Pro | $20 | When sign-ins pass 3,000 a month or 100 a day |
| Vercel Pro | $20 a seat | At public launch, required for any commercial site |
| WhatsApp OTP | per message | With WhatsApp alerts |
| Server storage for firm template files | small | With firm templates |

---

## 4. Moving browser-saved work into an account on first sign-in

**The rule: nothing is deleted from the browser by the move, and nothing is
called "moved" until it has been read back from the server and has reopened at
the same figure.**

### 4.1 What moves

| Browser store | Moves? | How |
|---|---|---|
| `marginalia.savedModels.v1` | **Yes** | Each record becomes a `saved_models` row plus one `model_versions` row, with `record` stored **exactly as found**. A version-1 or version-2 record goes up with its `missing` and `carriedOver` intact. It is not "upgraded" on the way, so the server never claims a judgement the record never had. |
| `marginalia.screens.v1` | **Yes** | One `screens` row each, `search` unchanged. |
| Unsaved edits on the figures screen | No, because they are not stored anywhere today | They keep working in the tab. Once signed in, a draft can be autosaved as a version (a later job, not this move). |
| House templates in IndexedDB | **No** | They stay on the device and the screen says so, until firm templates and document storage exist (§1.1). |

### 4.2 The sequence

1. **Ask first.** On first sign-in in a browser with saved work: "This browser
   holds 7 saved models and 3 screens. Copy them into your account?" The choice
   is *Copy* or *Not now*, never a silent upload. Under DPDP and GDPR the
   upload is processing, and the person should start it.
2. **Read the local stores and fingerprint each record.** Use the SHA-256 of its
   `serialise` text.
3. **Upload in one transaction per store.** Each record's local `id` is kept as
   an idempotency key, so running the move twice (a dropped connection, two
   tabs) creates no duplicates.
4. **Read back and compare.** Every uploaded record is fetched, put through
   `parse`, and fingerprinted again. Then **every saved model is reopened through
   the one restore path** and its value per share compared with the same reopen
   done from the local copy. Within 0, the same tolerance `verify/savedModel.mts`
   uses.
5. **Only then mark the local copy.** Each local entry gets "copied to your
   account on 3 Nov 2026" and is **kept**. Clearing it is a separate, offered
   action ("Remove the browser copies"), never automatic.
6. **Conflicts are kept, not resolved.** Suppose the account already has a model
   with the same `id` and a different fingerprint (the same work, edited on two
   devices). Both are kept, and the browser's copy is named "… (from this
   browser, 3 Nov)". Choosing between two sets of judgements is the reader's
   call (standing decision 2 in `CLAUDE.md`).
7. **A second browser does the same, later.** Its records merge in under the
   same rules.
8. **Signed out, the site still works exactly as today**, saving to the browser.
   Accounts are an addition, never a gate on modelling.

**A failure is said in words.** "3 of 7 models were copied. The other 4 are
still in this browser and nothing was lost. Try again." It never says "Done"
with a partial count.

---

## 5. Privacy

### 5.1 What today's promise says, and where it lives

| File | Today's words | Signed in, it becomes |
|---|---|---|
| `src/components/Footer.tsx:85–88` (Privacy modal) | "…scenario configurations remain strictly within your local browser session storage and are never permanently harvested…" | Rewritten in full (§5.2) |
| `src/components/figuresEditor.tsx:715` | "Nothing is uploaded or stored; a change lives in this browser tab." | True signed out. Signed in: "Saved to your account when you save the model." |
| `src/components/savedModelsPanel.tsx:152`, `:313` | "Saved models live in this browser on this device…" | Signed in: "Saved to your account, stored in Mumbai, India." |
| `src/components/screenerScreen.tsx:803` | "…screens are in this browser only until accounts arrive in build step 7." | Signed in: saved to the account |
| `src/components/houseTemplatePanel.tsx:167`, `:323`, `:334`; `src/data/templateStore.ts` `STORAGE_STATEMENT` | "…runs no server that receives it", "Kept on this device" | **Unchanged.** Templates stay on the device (§4.1). |
| `docs/COMPANY_OVERVIEW_SPEC.md` D6 | "Saved to this model on this device." | Two wordings, signed in and out |

The pattern `STORAGE_STATEMENT` already uses should be followed for every store:
**the on-screen claim is a constant in code**, so a check can compare what the
page says with where the code writes.

**Two things the current promise does not mention, and the new notice must:**
the feedback form posts what a person types, including any email they give, to
Web3Forms (`CoverageStatsSection.tsx:38–41`), and the site loads Vercel Web
Analytics (`App.tsx:556`). Neither is a server Marginalia runs, but both are
processors of what a visitor sends.

### 5.2 The new promise, in plain words (draft)

> **Signed out**, everything you do stays in this browser, as before.
> **Signed in**, the work you save is kept in our database in Mumbai, India, so
> you can open it on any device: your saved models and every version, with the
> reasons you gave, your screens, watchlists, notes and alert settings. We keep
> your email address to sign you in. We do not sell any of it, do not use it for
> advertising, and do not look at it except to fix a fault you report to us.
> **Download everything** at any time, as a file this site can read back.
> **Delete your account** and your data is erased at once; backup copies age out
> within 7 days. The companies that process data for us are Supabase (database
> and sign-in), Resend (sign-in emails), Vercel (hosting and visit counts) and
> Web3Forms (the feedback form).

### 5.3 India: the DPDP Act 2023 and the DPDP Rules 2025

- **Dates.** The Rules were notified on 13 November 2025 (MeitY), or 14 November
  2025 in the Gazette. Sources differ. The substantive duties apply 18 months
  later, **13 or 14 May 2027**. Notice, consent, security safeguards, breach
  reporting, retention and erasure, and the data principal's rights all fall
  then ([Shardul Amarchand Mangaldas](https://www.amsshardul.com/insight/enforcement-of-the-dpdp-act-and-notification-of-the-dpdp-rules/);
  [TCSA roadmap](https://www.tcsa.in/resources/dpdp-rules-2025-implementation-roadmap);
  the Gazette text itself, G.S.R. 846(E), was not opened, so this is **not confirmed**).
  `docs/VISION.md` says "design for them now". Building step 7 to these duties
  costs little more than building it without them.
- **What it means here:**
  - **Notice before consent.** A plain notice of what is collected and why, how
    to withdraw, how to exercise rights and how to complain to the Data
    Protection Board (Act s.5; Rules; exact rule numbering **not confirmed**).
    The notice is versioned, and `consent_events` records which version each
    person accepted.
  - **Withdrawal as easy as giving.** One button (Act s.6(4)).
  - **Rights:** information about the processing (s.11), correction and erasure
    (s.12), grievance redress (s.13), and a nominee (s.14). Export (§5.6) and
    deletion (§5.7) answer most of these. A contact for grievances must be
    published.
  - **Erase when the purpose ends or consent is withdrawn** (s.8(7)).
  - **Breaches.** Report to the Board and to each affected person. The detailed
    report is due within **72 hours** of becoming aware
    ([IAPP](https://iapp.org/resources/article/operational-impacts-of-indias-dpdpa-part10)).
    CERT-In separately expects cyber incidents within **6 hours** (not confirmed).
  - **Penalties.** Up to **₹250 crore** for failing to keep reasonable security
    safeguards, and up to ₹200 crore for not reporting a breach (Act Schedule;
    [Mondaq summary](https://www.mondaq.com/india/privacy-protection/1707558/digital-personal-data-protection-rules-2025-highlights)).
- **Children.** Anyone under 18 needs verifiable consent from a parent (Act
  s.9). Students are an intended audience. **Recommendation: accounts for 18 and
  over only at first**, with a plain "I am 18 or older" confirmation recorded in
  `profiles`. **Decided 4 November 2026: over-18s only at first** (§9, decision 4).
- **Cross-border.** The Act allows transfers abroad except to countries the
  government restricts (s.16). No such list has been confirmed. Hosting in
  Mumbai avoids the question for Indian users. Supabase's own support staff and
  sub-processors may sit outside India (**not confirmed**; read Supabase's
  data processing agreement in job A0).

### 5.4 GDPR basics, for readers in the EU

- **It applies** if the site offers its service to people in the EU, wherever
  Marginalia is based (GDPR Art. 3(2), [EUR-Lex](https://eur-lex.europa.eu/eli/reg/2016/679/oj)).
- **Lawful basis.** Storing a reader's own saved work so they can use it is
  **performance of a contract** (Art. 6(1)(b)). Analysing it for anything else,
  such as the corrections database, is a separate purpose needing **consent**
  (Art. 6(1)(a)), asked for separately.
- **Notice** (Art. 13). **Rights:** access (15), rectification (16), erasure
  (17), and portability in a machine-readable format (20). The JSON export
  already is one.
- **Processors** need written contracts (Art. 28): Supabase's, Resend's and
  Vercel's data processing agreements, signed before the first EU user.
- **Breach** to the supervisory authority within **72 hours** (Art. 33).
- **Transfers.** EU users' data would be held in India, which has no EU adequacy
  decision, so the transfer needs Standard Contractual Clauses (Chapter V).
  Whether Supabase's agreement includes them is **not confirmed**.
- **An EU representative** (Art. 27) may be needed by a non-EU business serving
  EU users. The exemption for occasional, low-risk processing may or may not
  fit. **Not confirmed. Ask the same qualified person who answers the SEBI
  question** (`ROADMAP.md` §9).
- **A second region for EU users is not recommended now.** One region keeps
  row-level security, backups and deletion in one place. Decided 4 November 2026:
  Mumbai only (§9, decision 1).

### 5.5 What is never collected

No name unless typed, no phone number until WhatsApp, no portfolio unless
imported, no tracking cookies. **The Supabase session is kept in browser
storage, not as an advertising cookie.** The cookie notice question does not
arise, but the notice says where the session token lives.

### 5.6 Export

One button on the account page downloads one JSON file. It holds every row the
person owns, in every table, with saved models in the existing `serialise`
format, so **the file can be imported back** with the import that already
exists. The check: per table, the count in the file equals the count in the
database for that user.

### 5.7 Deletion

"Delete my account" → confirm by email code → in one transaction, every row with
that `user_id` is deleted (`on delete cascade` from `profiles`) and the auth
user is removed. Backups age out in 7 days, and the notice says so. Nothing is
kept "for analytics". The check: after deletion, a count across every table
for that user is 0, and **the other test user's rows are untouched**.

---

## 6. Security

### 6.1 Row-level access, so no user can read another's data

- **Every table has row-level security enabled *and forced*.** Policies read
  `using ((select auth.uid()) = user_id)` for select, update and delete, and
  `with check ((select auth.uid()) = user_id)` for insert and update. A version
  row's `user_id` must also equal its parent model's (a trigger), so nobody can
  attach a version to someone else's model.
- **A check that cannot pass with a hole** (job A2, `verify/accounts.mts`):
  - Two users, A and B, against a **local** Supabase started by the Supabase CLI.
    No paid project and no real data is needed, and it runs in CI.
  - On **every table**: A cannot select, insert as B, update or delete B's rows.
    The anonymous key sees nothing.
  - **Tables are discovered, not listed.** The check queries
    `pg_tables`/`pg_class.relrowsecurity` and fails on any table in the schema
    without RLS, so a table added next year without a policy fails the run.
    This is the lesson of "a check that cannot fail" in `CLAUDE.md`.
  - **Proved by breaking:** disable RLS on one table, drop one policy, and widen
    one policy to `true`. Each must be reported by name.

### 6.2 Secrets

- **Browser-visible:** the project URL and the anon (publishable) key only.
  These are safe *because* RLS is on.
- **Server-only:** the service-role key, which bypasses RLS. It lives in Vercel
  environment variables and GitHub Actions secrets, and is read only in `api/`
  functions that need it (export, delete account, migrations).
- **The Vite trap.** Any variable named `VITE_*` is compiled into the public
  JavaScript. A check fails the build if `dist/` contains the service-role key's
  prefix, or if any `VITE_` variable name contains `SERVICE` or `SECRET`.
- **The Content Security Policy** in `vercel.json` must add the Supabase project
  URL to `connect-src`, and nothing wider.
- Short-lived access tokens (Supabase's default is one hour, not confirmed),
  refresh-token rotation on, and keys rotated if exposed.

### 6.3 Rate limits and size limits

| What | Limit (proposed) | Where enforced |
|---|---|---|
| Sign-in emails | Supabase's per-hour email limit and the 60-second-per-address minimum (defaults not confirmed), plus a per-IP limit | Supabase Auth settings, and the Vercel firewall (which `api/_guard.js` already relies on) |
| Writes per user | 60 a minute | A Postgres function, or Upstash Redis (free to 500,000 commands a month, then $0.20 per 100,000; [upstash.com/pricing/redis](https://upstash.com/pricing/redis); not confirmed). Postgres first: no new vendor. |
| Record size | 512 KB per `record` | A `check` constraint, so the database refuses it whatever the client does |
| Rows per user | e.g. 2,000 versions, 200 screens | A trigger, with a plain message when reached |

Job A1's measured record size sets the real numbers.

### 6.4 Logging

Supabase's auth and API logs, with no record contents in logs. Breach
procedure, written before launch: who decides, the 72-hour reports (§5.3, §5.4),
and the wording to users.

### 6.5 Backups we own

Supabase Pro keeps 7 daily backups. Two more things are added:
- a **weekly `pg_dump`** from GitHub Actions, encrypted, to Cloudflare R2
  (already chosen for the archive, `docs/ARCHIVE_PLAN.md` decision 2, and not
  yet set up);
- a **restore drill** into a local database, as a check: row counts match, and a
  restored model reopens at its saved figure.

Without the drill, a backup is only assumed to work.

---

## 7. What step 7 does not do

- **No alerts are sent.** Settings are stored, and sending waits for the
  scheduler.
- **No firm or shared workspaces.** Every row has one owner.
- **No server-side engine.** Models are still built in the browser. The server
  stores inputs only.
- **No payments.** Pricing tiers are a later step.
- **No change to any published default, threshold or refusal rule.** No
  workbook change.

---

## 8. Build sequence: small jobs, one per session

Each job ends with the full suite (`npm run verify`, `verify:workbook`,
`verify:dashboard`, `npx tsc --noEmit`, `npm run build`) at zero, plus its own
check, **proved to fail without its fix**. Jobs A1–A2 need no paid account and
no real project: they run against a local Supabase.

| Job | What | Its own check | Proved by breaking |
|---|---|---|---|
| **A0** | **Decisions and accounts (Nihar).** Open every "not confirmed" price page in a browser and correct §3. Create the Supabase project (Mumbai) and the Resend account and domain. Read Supabase's data processing agreement for sub-processors and SCCs. Decisions 1–5 taken 4 Nov 2026 (§9); decision 6 still open. | — (no code) | — |
| **A1** | **Schema as migrations** in `supabase/migrations/`, applied to a local database by the CLI in CI. **Measure** real `SavedModel` record sizes on the payload set and set the size limits from them. | Migrations apply cleanly from empty. Every table has RLS enabled (discovered from `pg_class`). | Add a table without RLS: the check names it. |
| **A2** | **The two-user access check**, `verify/accounts.mts` (§6.1). | A and B on every table, every operation, plus the anonymous key | Disable RLS on one table, drop a policy, and widen a policy to `true`: each reported by name |
| **A3** | **Email sign-in** (magic link plus code), the "Sign in" text link to the right of the search box (decision 5), and the session. CSP `connect-src` updated. | Signed out, every existing check passes unchanged. In a browser, sign in on local Supabase with a test mailbox (the CLI's local mail catcher), and sign out. | Break the redirect URL and watch the sign-in check fail |
| **A4** | **`SavedModelStore` goes async**, `localStore` is wrapped, and `serverStore` is written. Signed in, saving goes to the server. | `verify/savedModel.mts` runs **against `serverStore`** on local Supabase: every judgement round-trips, value per share and adjusted EBITDA within 0, computed the way the screen computes them | Drop the heads on the server write: the value goes 0.86% out, as §22f measured for the local store |
| **A5** | **Versions.** Saving an existing model makes a child version, and `data_basis` is recorded (first confirming what today's fingerprint identifies, §1.2). The bridge reads any two versions. | A chain of three versions reopens each at its own figure. Bridge parts sum exactly to the total ("parts = total"), recomputed rather than read from storage. | Make a save overwrite instead of append: the first version's figure is lost and reported |
| **A6** | **First-sign-in move** (§4). | Seed a browser with version-1, -2 and -3 records and 3 screens. Sign in and copy: every record is on the server, each reopens at the same figure as from the browser, the local copies are still present, and a second run adds no duplicates. | Drop one record from the upload: reported as "6 of 7", never "done" |
| **A7** | **Screens, watchlists and notes** on the server. The screener's browser key is moved by A6's mechanism. The "Your notes" tab gets its store. | Round trip per table. The screener's on-screen wording matches the store in use. | Write screens to `localStorage` while signed in: the wording check fails |
| **A8** | **Alert settings, stored only**, labelled "saved, not sent yet". | Round trip. The label is present wherever an alert setting is shown. | Remove the label: the check fails |
| **A9** | **Export and delete account** (§5.6, §5.7). | The export's per-table counts equal the database's. The export imports back. After deletion, 0 rows for A on every table and B unchanged. | Leave one table out of the cascade: the 0-rows check names it |
| **A10** | **The privacy notice and every storage sentence** (§5.1, §5.2) rewritten, `consent_events` written at sign-up, and the 18+ confirmation. Storage claims become constants in code, as `STORAGE_STATEMENT` is. | Each on-screen storage claim matches the store the code wrote to, signed in and signed out. The notice version is recorded per user. | Sign in and leave "Nothing is uploaded" in place: reported |
| **A11** | **Rate and size limits, and the secret scan** (§6.2, §6.3). | The 61st write in a minute is refused with a plain message. An oversized record is refused. `dist/` contains no service key. | Raise the limit to infinity, and plant a fake key in a `VITE_` variable: both reported |
| **A12** | **Backups we own, and the restore drill** (§6.5). Needs R2 to exist. | The restore reproduces row counts, and a restored model reopens at its figure. | Restore an empty dump: reported |
| A13 | **Passkeys**, once Supabase's passkey API leaves beta | Add, sign in with, and remove a passkey, in a browser with a virtual authenticator | Remove the passkey and sign in with it: refused |
| A14 | **Google sign-in** | Sign-in on a test client | — |
| Later | Thesis journal; firm templates (organisations, roles, R2 file storage, **Paid · last**); WhatsApp OTP (**Paid · last**); a corrections database (its own consent) | | |

**Roadmap bookkeeping.** When A3 ships, step 7 moves to *In flight* in
`ROADMAP.md`. When A10 ships, the privacy item in `docs/VISION.md` §5 ("Data
protection") gets its first Built line. `ROADMAP.md` has no row for step 7
today, so this plan is ahead of it. It is not changed in this commit.

---

## 9. Decisions for Nihar

**Taken on 4 November 2026 (approved by Nihar):**

1. **Provider and region: Supabase, Mumbai (`ap-south-1`).** One project in
   Mumbai. No EU project for now.
2. **Sign-in order:** an email link with a 6-digit code in the same email
   first, then passkeys, then Google. WhatsApp OTP comes later, with WhatsApp
   alerts.
3. **When to pay:** free tiers while the site is private, and pay only at
   public launch (**Paid · last**). This covers Supabase Pro, Resend Pro and
   Vercel Pro. The free tier's weekly pause is accepted on the private site.
4. **Age: over-18s only at first.** An "I am 18 or older" confirmation is
   recorded in `profiles`. No parental-consent flow is built.
5. **Where sign-in sits:** "Sign in" is a small text link to the right of the
   search box in the header. **This is an approved exception to
   `docs/NAV_SEARCH_SPEC.md` §2.1**, whose item list otherwise ends "Nothing
   else". Job A3 builds it there.

**Still open:**

6. **The legal questions to put to a qualified person**, alongside the SEBI
   question: whether an EU representative is needed; whether Supabase's terms
   cover EU→India transfers; and the final wording of the notice.

---

## Sources

Prices (all **not confirmed**: provider pages could not be opened from this
session, so figures were taken from search results quoting them):
[Supabase pricing](https://supabase.com/pricing) ·
[Supabase regions](https://supabase.com/docs/guides/platform/regions) ·
[Supabase changelog (passkeys beta)](https://supabase.com/changelog) ·
[Neon pricing](https://neon.com/pricing) ·
[Neon regions](https://neon.com/docs/introduction/regions) ·
[Vercel Postgres moved to Neon](https://vercel.com/docs/postgres) ·
[Neon's Vercel Postgres transition guide](https://neon.tech/docs/guides/vercel-postgres-transition-guide) ·
[Firebase pricing](https://firebase.google.com/pricing) ·
[Resend pricing](https://resend.com/pricing) ·
[Upstash Redis pricing](https://upstash.com/pricing/redis) ·
[Vercel Hobby plan](https://vercel.com/docs/plans/hobby) ·
[Brevo: Supabase custom SMTP and its limits](https://developers.brevo.com/docs/supabase-smtp-integration).
Secondary sources that quoted these pages:
[makerkit (Supabase)](https://makerkit.dev/blog/saas/supabase-pricing),
[jetadmin (Neon)](https://www.jetadmin.io/blog/neon-pricing/),
[SuperTokens (Firebase Auth)](https://supertokens.com/blog/firebase-pricing).

Law:
[GDPR, Regulation (EU) 2016/679 — EUR-Lex](https://eur-lex.europa.eu/eli/reg/2016/679/oj) ·
[Shardul Amarchand Mangaldas on the DPDP Rules' commencement](https://www.amsshardul.com/insight/enforcement-of-the-dpdp-act-and-notification-of-the-dpdp-rules/) ·
[TCSA DPDP roadmap](https://www.tcsa.in/resources/dpdp-rules-2025-implementation-roadmap) ·
[IAPP on DPDPA breach duties](https://iapp.org/resources/article/operational-impacts-of-indias-dpdpa-part10) ·
[Mondaq: DPDP Rules 2025 highlights](https://www.mondaq.com/india/privacy-protection/1707558/digital-personal-data-protection-rules-2025-highlights).
The DPDP Act 2023 section numbers are from the Act. The Rules' Gazette text
(G.S.R. 846(E)) was not opened, so the rule numbering is **not confirmed**.
