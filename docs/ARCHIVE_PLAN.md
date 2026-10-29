# A point-in-time archive — the plan

**Status: approved on 2026-10-25. Stage 0 is BUILT; everything after it waits.**
The plan was written first and stopped for approval, as the brief asked; the
decisions are recorded in §9 and the measurements that answered them are in
§3.1 and §7. Measured against the live sources on 2026-10-25.

---

## The case, in one paragraph

Most of these sources keep their filings for ever, so it is tempting to think
the archive can wait. **What does not keep is the *first* version.** A figure as
first reported, before it was restated. Guidance as first given, before it was
revised or withdrawn. And in two of the eight sources the document itself goes:
Japan's free disclosure service holds **31 days** — counted, not assumed — and
India's exchange archive has already pruned everything filed before about
mid-2018. Every day of waiting is a day of first versions that cannot be
recovered later at any price, because there is nowhere left to get them.

---

## 1. What would be archived, and what "as first published" means

**The document, unchanged.** Stored byte for byte as the source returned it, with:

| Recorded beside it | Why |
|---|---|
| `sha256` of the bytes | so the copy can be proved to be the copy that was fetched |
| `source_url` | where it came from |
| `captured_at` | **the archive's own clock** — the moment we took it |
| `filed_at` / `published_at` | the source's own date for the document, which is a different thing |
| HTTP status, `Last-Modified`, `ETag`, `Content-Type`, `Content-Length` | what the server said about it at that moment |
| `company`, `country`, `source`, `doc_type` | what it is |

**Never a re-rendered, re-parsed or "cleaned" copy.** §6.3 of
`docs/DATA_LAYER_PLAN.md` already settles this for the figures store — *"The
document itself is kept, not only the figures. A hash in the store with no
document means the provenance claim cannot be re-checked"* — and the archive is
the same rule applied one layer earlier.

**Three classes of thing, and the third is the one nobody else keeps.**

1. **Periodic filings** — annual and interim reports, financial statements.
2. **Event filings** — auditor changes, director changes, related-party
   disclosures, shareholding patterns.
3. **Management guidance as published** — earnings releases, the Japanese
   tanshin forecast, investor presentations, call transcripts. This is the class
   that rots: a company revises its own forecast and the website copy is replaced,
   and the only durable record is the original announcement captured on the day.

**And guidance is stored as a statement, not as a document.** A captured PDF
answers "what did they say"; a company page has to answer "what did they
promise, for when, and has it changed". So each guidance statement extracted
from a captured document is one row:

| Field | What it holds | Example |
|---|---|---|
| `metric` | the measure being forecast, in the engine’s own vocabulary | `revenue_growth` |
| `target` | the number or range, with its unit and whether it is a floor, a ceiling or a midpoint | `12–14%` |
| `period` | what the target is for, as dates rather than words | FY2027, 2026-04-01 to 2027-03-31 |
| `scope` | consolidated or standalone, group or segment, constant currency or reported | consolidated, constant currency |
| `quote` | **the exact sentence**, unedited, as it appears | "We expect revenue growth of 12–14% in constant currency for FY2027." |
| `source` | the captured document: its hash, its page or timestamp, its URL | `sha256:…`, p. 4 |
| `captured_at` | when we took the copy the quote came from | 2026-10-25T08:35:13Z |

The `quote` is not decoration and not an audit afterthought: it is the field
that makes the other six checkable, and standing decision 8 allows extraction
**only** on that condition. A statement whose quote does not contain its target
is a failed extraction and is refused rather than stored. A guidance figure
with no quote is not a guidance figure.

**Superseded, never edited.** A revised forecast is a new row with its own
capture; the old row keeps its quote and gains a `superseded_by`. That is the
same rule as the figures store in `docs/DATA_LAYER_PLAN.md` §6.3, and it is
what lets a page show that a company cut its own guidance twice in a year
without either version being lost.

**What this is not.** It is not a mirror of an exchange, not a redistribution
service, and not a general crawl. It is a captured copy of the documents of the
companies this site models, held so that the site's own numbers can be traced
and so that "as first reported" is answerable. That distinction is load-bearing
in §2, because several of these terms turn on it.

### 1.1 The key: the LEI beside the ticker

**A ticker is not an identity.** It is a name one exchange gives one line of
one company, and this repository has already been bitten by that: the India
plan keys its store on ISIN rather than symbol because *"Eternal’s history
proves symbols are renamed, and the ISIN survived it"* (§6.3 there). An archive
spanning eight countries has the problem twice over — the same company arrives
as `RELIANCE.NS`, as an ISIN, as a CIK, as an EDINET code and as a DART
corp_code, and nothing in that list joins to anything else.

**So every captured document is keyed on the LEI as well.** The Legal Entity
Identifier is a 20-character code for the legal person that filed, issued by
the Global LEI Foundation, and GLEIF publishes it through a free API with no
key. Checked on 2026-10-25:

| Probe | Result |
|---|---|
| `filter[isin]=US0378331005` | **exactly one record** — `HWUPKR0MPOU8FGXBT394`, Apple Inc. |
| `filter[entity.legalName]=Reliance Industries Limited` | `5493003UOETFYRONLG31`, RELIANCE INDUSTRIES LIMITED, IN |
| what each record carries | legal name, legal address and country, registration status (`ISSUED`, `LAPSED`), next renewal date |
| authentication | none; no key, no registration |
| published rate limit | **none found in the response headers** — so the same politeness budget as everything else in §4 |

**Resolve by ISIN, never by name.** The same probe by name is fuzzy and
dangerous: `entity.legalName=Apple Inc.` returned Apple Inc., **Apple Ford,
Inc.** and **APPLE MANAGEMENT INC.** The ISIN filter returned one record and
the right one. Since the figures store is already keyed on ISIN, the LEI is one
join away and never a guess.

**What it buys.** A group structure that joins across countries — a subsidiary
disclosed in an Exhibit 21, an AOC-1 and a consolidated entity disclosure
statement is one legal person with one LEI, or it is three names that happen to
look alike. **And registration status is itself a fact worth keeping**: a
LAPSED LEI on a counterparty is a real signal, and the renewal date comes free
with the lookup.

**What it does not buy, said plainly.** Not every issuer has one, coverage
varies by country, and the LEI identifies the *legal entity*, not the listed
line: a company with two share classes has one LEI and two tickers. So the LEI
is an additional key, not a replacement for the ticker or the ISIN, and a
company without one is recorded as having none rather than being matched by
name.

---

## 2. The terms, source by source, quoted

Read at the source on 2026-10-25 unless the row says otherwise. Where a source
refused an automated request, the refusal is recorded and **nothing was retried
with a different user agent, a proxy or browser automation** — the rule
`CLAUDE.md` and §4 of the data layer plan both set.

### 2.1 SEC EDGAR — **yes, and it says so in numbers**

From `sec.gov/search-filings/edgar-search-assistance/accessing-edgar-data`:

> "Anyone can access and download this information for free"

> "Current max request rate: 10 requests/second. To ensure everyone has
> equitable access to SEC EDGAR content, please use efficient scripting.
> Download only what you need and please moderate requests to minimize server
> load."

> "The SEC does not allow botnets or automated tools to crawl the site. Any
> request that has been identified as part of a botnet or an automated tool
> outside of the acceptable policy will be managed to ensure fair access for all
> users. Please declare your user agent in request headers"

**Verdict: permitted, with a published rate ceiling and a named client.** The
repository already identifies itself this way through `SEC_CONTACT` in
`api/company.js`. SEC filings are works of the US government and carry no
further licence condition.

### 2.2 EDINET (Japan, FSA) — **yes, through the API, not by scraping**

From the EDINET 利用規約 (`disclosure2dl.edinet-fsa.go.jp`, revised 25 April 2025):

> 「EDINETウェブサイト…で公開している情報…は、どなたでも「公共データ利用規約（第1.0版）」（PDL1.0）に準拠した利用条件の下で、利用することができます。」

(Anyone may use the content under Public Data License 1.0.) Attribution is
required, and an edited or processed version must say that it was edited and by
whom. Then, in 2.2) 禁止行為:

> 「ウェブサイトから情報を抽出するコンピュータソフトウェア技術（スクレイピング等）を利用して本ウェブサイトからコンテンツを機械的に取得することは禁止します。ただし、API機能を利用する場合…はこの限りではありません。本ウェブサイトのコンテンツを機械的に取得するには、API機能を利用してください」

(Scraping the website is prohibited; to take content mechanically, use the API.)
And 3.2): no act that harms the API's operation, including 「短時間における大量
のアクセス」 — large volumes of access in a short time.

**Verdict: permitted through the EDINET API, under PDL 1.0, with attribution.**
A scraper of the web pages would be a breach; the API is the sanctioned route.
**Prerequisite not yet met:** the v2 API issues a subscription key on
registration, which nobody has obtained.

### 2.3 OpenDART (Korea, FSS) — **yes, with a registered key**

From the OpenDART 이용약관 (`opendart.fss.or.kr/intro/terms.do`):

> 제11조 ① 「금융감독원이 제공하는 서비스는 원칙적으로 무료입니다.」 (the service is free in principle)

> 제10조 ④ 「오픈API 서비스는 이용횟수에 허용량 제한이 있으며, 이를 홈페이지에 게시합니다.」 (there is a usage quota, published on the site)

> 제5조 — anything the terms do not cover falls under the 공공데이터법 (Public Data Act)

> 제10조 ⑥ — excessive network access or hacking attempts can have the service withdrawn

**Verdict: permitted, free, with a key.** Registration asks for the intended
use, and for corporate use the company name, business registration number, the
requesting system's IP and the business registration certificate — so the key is
tied to a declared purpose. OpenDART's own menu offers XBRL financial statements
and a bulk download of the notes, so much of Korea arrives as data rather than
as documents. **The quota's number could not be read**: the FAQ page returns a
shell that fills in from script.

### 2.4 FCA National Storage Mechanism (UK) — **yes, and it is the most permissive of the eight**

From `data.fca.org.uk/artefacts/NSM_Terms_of_Use.pdf`:

> "You may use the material and documents contained in the NSM for any lawful
> purpose not otherwise excluded by these terms and conditions or the Acceptable
> Use Policy. You may not, for the avoidance of doubt, use the FCA's name, logo
> or any other identifying mark for any purpose."

And, on material uploaded by third parties:

> "you grant other users of this site a limited licence to use, store and copy
> that content and to distribute and make it available to third parties
> including for any lawful commercial purpose."

The Acceptable Use Policy (`NSM_General_AUP.pdf`) lists prohibited uses —
unlawful purposes, harm, spam, malware — and asks users "Not to reproduce,
duplicate, copy or re-sell any part of our site in contravention of the
provisions of our terms of website use", and not to interfere with the site.
**It says nothing at all about automated access, robots, spiders or scraping.**

**Verdict: permitted.** Of the eight, the UK is the only source that explicitly
licenses storage and onward distribution of the documents themselves.

### 2.5 SEDAR+ (Canada, CSA) — **no**

From the SEDAR+ Terms of Use (`systems.securities-administrators.ca`):

> §5(b) — no "using any robot, spider or other automatic device, software
> program or manual process to monitor, access, scrape, copy" web pages

> §5 — you "will not perform automated searches against the SEDAR+ Public
> Website (including automated 'bots' or 'link checkers')"

> §2(f) — do not "engage in 'scraping' or the use of any automated means to use
> or reproduce multiple pieces" of Public Information

> §2(e) — do not use Public Information to "construct a database of any kind"

> §2(b) — you may not "seek to commercialize the Public Information"

**Verdict: prohibited, four ways over.** §2(e) forbids the archive by name even
if every request were made by hand. The CSA sells a licensed bulk feed (Data
Distribution Services); that is the only route, and it is a contract, not a
crawl.

### 2.6 ASX (Australia) — **no, without written consent**

From the ASX terms of use (`asx.com.au/legals/terms-of-use`):

> permitted: "save an electronic copy, or print out a paper copy, of parts of
> the Site for your own information purposes only, including research, study or
> other personal, non-commercial use, but only if you keep all content intact
> and in the same form as presented on the Site"

> prohibited: "use any spider, screen scraper, robot, other similar software or
> device, or other similar process, to use or access the Site in any way
> whatsoever, including monitoring, downloading or copying any content on the
> Site (except as otherwise permitted under these terms or with ASX's prior
> written consent)"

> prohibited: "modify, copy, reproduce, republish, frame, download onto a
> computer, upload to a third party, post, transmit or distribute any content on
> the Site in any way except as expressly provided for in these terms, on the
> Site or with ASX's prior written consent"

**Verdict: prohibited without ASX's prior written consent**, and the permitted
use is expressly personal and non-commercial.

### 2.7 TDnet (Japan, JPX) — **the free service is a 31-day window; the paid routes are contracts**

The free 適時開示情報閲覧サービス at `release.tdnet.info` was fetched on
2026-10-25: its date selector offered **exactly 31 dates, 2026-09-25 to
2026-10-25 inclusive**, which matches JPX's own statement that the service shows
31 days including the day of disclosure. Older disclosures are not there at all.

JPX offers two paid routes: a server-type feed, where redistributing received
data to third parties attracts a per-volume charge, and a **TDnet API** under a
JPX contract, of which JPX states that information obtained from it **may be
redistributed to third parties**.

**Verdict: unverified for the free service** — its own terms page was not read,
because `jpx.co.jp` returned 403 to an automated request and the JPX statements
above were read through a search index that quoted them. **Whatever those terms
say, the 31-day window makes the free service useless as an archive unless it is
captured daily from today.** Price of the paid routes: not published; a JPX
contract.

### 2.8 NSE (India) — **no**

Already quoted in `docs/DATA_LAYER_PLAN.md` §1 and §4, from
`nseindia.com/static/nse-terms-of-use`:

> "User is prohibited to conduct any systematic or automated data collection
> activities (including scraping, data mining, data extraction and data
> harvesting) on or in relation to our Website / Mobile Application."

and from `nse-copyright`:

> "no portion of the Content may be reproduced on or transmitted to or stored in
> any other website or in other form of electronic retrieval system … Users may
> view, print copies and download the Content for personal, non-commercial or
> educational purpose"

**Verdict: prohibited, and the second sentence forbids the store as well as the
fetch.** Decision 1 of the data layer plan is the same decision.

### 2.9 BSE (India) — **no**

**Read by Nihar in a browser and sent on 2026-10-29**, which is the only way this
row was ever going to be answered: `www.bseindia.com` returns **403** to an
automated request on every path — the home page and the terms page included —
because the site is a single-page application whose content is drawn by
JavaScript from an API that refuses automated callers (`docs/DATA_LAYER_PLAN.md`
§1 and §2.1). The terms themselves say:

> "Any reproduction, redistribution or transmission, for consideration or
> otherwise, of any such information contained on the Website is strictly
> prohibited"

and that nothing may be reproduced

> "without the express written consent of BSE".

**Verdict: prohibited, and as with NSE it is the second sentence that settles
it.** The first forbids redistribution and transmission "for consideration or
otherwise", which covers a site showing a reader what it captured; the second
makes any reproduction at all conditional on BSE's **express written consent**.
An archive is a reproduction that is kept, so both halves bite. **Licence
needed — Paid · last**, exactly as NSE is, and for the same reason: the fetch
and the store are each forbidden on their own, so there is no narrower version
of this that is permitted.

**What this closes.** It was the last unverified row in §2.10, and the only one
that could not be read from here. It also answers option (b) of
`docs/DATA_LAYER_PLAN.md` §11: BSE is **not** more permissive than NSE, so there
is no cheaper Indian exchange route, and the Indian primary-filings layer waits
on a licence or a written permission whichever exchange it is built on.

### 2.10 The verdicts, together

| Source | Automated archiving | Licence / condition | Read at source today |
|---|---|---|---|
| **SEC EDGAR** | **Yes** | public domain; ≤10 req/s; declare a user agent | ✓ |
| **FCA NSM (UK)** | **Yes** | "any lawful purpose"; onward distribution expressly licensed | ✓ |
| **EDINET (Japan)** | **Yes, API only** | PDL 1.0 with attribution; scraping the site prohibited; key required | ✓ |
| **OpenDART (Korea)** | **Yes, with a key** | free; published quota; Public Data Act | ✓ |
| **TDnet (Japan)** | **Free service: 31-day window** | paid API permits redistribution; free terms not read | ~ |
| **SEDAR+ (Canada)** | **No** | scraping, automated search and database construction all prohibited | ✓ |
| **ASX (Australia)** | **No** | without ASX's prior written consent; personal, non-commercial only | ✓ |
| **NSE (India)** | **No** | automated collection and third-party storage both prohibited | ✓ (earlier session) |
| **BSE (India)** | **No** | reproduction, redistribution and transmission prohibited; express written consent required — **Paid · last** | ✓ (browser, by Nihar) |

**So the archive can start in four jurisdictions and not in four.** The US, the
UK, Japan via EDINET, and Korea are permitted today. Canada, Australia and India
are not — India on both of its exchanges, now that BSE has been read — and
Japan's TDnet is a separate question from EDINET. **No row is unverified any
more**: every one has been read at its own source, eight of them from here and
BSE in a browser. The EU is not in
this table because the brief did not list an EU source; the German Bundesanzeiger
and the national officially-appointed mechanisms have not been assessed.

---

## 3. Where it would be stored

**Two stores, one of them boring on purpose.**

**The documents: object storage, content-addressed.** Each capture is written
once, at a key built from its hash, and never modified:

```
<source>/<country>/<company>/<doc_type>/<filed_at>/<sha256>.<ext>
```

Writing at the hash makes a re-capture of an unchanged document a no-op instead
of a second copy, and makes "has this document changed since we last looked"
answerable without downloading it.

**The index: one row per capture**, in the same grain as §6.3 of the data layer
plan so the two stores join cleanly. SQLite on disk is enough to begin — the row
count is in the tens of thousands, not millions — and it moves to Postgres when
the figures store needs one.

**Why not git.** The obvious cheap answer is "commit the documents". It is wrong
here: git stores whole new blobs for changed binaries, repacks the whole history
periodically, and makes every clone of this repository carry every PDF ever
captured. Object storage is a tenth of the trouble and an order of magnitude
cheaper.

**Chosen: Cloudflare R2** (decision 2, 2026-10-25) — **and not set up yet.**
The account is yours to create; nothing here provisions anything, and stage 0
needs no account at all. Published pricing (checked 2026-10-25): **$0.015
per GB-month**, Class A (writes and lists) **$4.50 per million**, Class B
(reads) **$0.36 per million**, **free egress**, and a free tier of 10 GB-month,
1M Class A and 10M Class B operations. Free egress is the one that matters,
because the site itself will read these documents to show a reader the page a
figure came from. Backblaze B2 is cheaper per GB and charges egress; AWS S3 is
dearer on both.

**Where the job runs.** The crawl is slow by design — one request at a time —
so it wants a runner with a long timeout rather than a fast one. A scheduled
GitHub Actions workflow fits (and the free allowance covers a nightly job of
this size); a Vercel cron can trigger it, since the repository already deploys
there, but Vercel's function timeouts make it a poor host for the crawl itself.

### 3.1 Where stage 0’s captures live, and why not in the repository

The decision was to put them in the repository **if a year of them came to
under 100 MB**, and otherwise to keep them in an ignored folder and say so.
Measured on 2026-10-25, on the set as it stands:

| | |
|---|---|
| the set today | **176 payloads, 10.34 MB**, mean 60 KB, largest 69 KB |
| what a full refetch adds | **10.3 MB** — one new capture per company, every time |
| a year at one full refetch a month | **124 MB** |
| a year at one a week | **538 MB** |
| compressed, for reference | 2.90 MB per full refetch (28%) |

**A refetch always writes a new capture for every company**, so there is no
deduplication to hope for: `fetchedAt` and the live `quote.price` are inside
the payload, so no two fetches of the same company are ever byte-identical.
The monthly figure is the conservative one — the payload version was bumped
twice in the four weeks to 2026-10-22, and each bump forces a full refetch —
so **124 MB a year is a floor, not an estimate**, and it is over the line.

**And there is a second reason, which decides it regardless of size.**
`verify/.gitignore` has kept payloads out of this repository from the start,
and the comment says why: *"Yahoo-sourced figures are vendor data the site is
not licensed to redistribute"*. `verify/README.md` says the same at more
length. **A history of vendor data is still vendor data**, and committing
versions of it would publish the thing that constraint exists to keep
unpublished — which is exactly the "quietly relaxing a rule" that `CLAUDE.md`
forbids as a side effect of another job.

**So the captures live in `verify/payloads/versions/`, which the existing
ignore rule already covers**, and the ignore file now says that it covers them
and why. Keeping the history is ours to do; publishing it is not. If the set
ever moves to sources that are ours to redistribute — the SEC-only subset
already is — this is worth revisiting, and it is a licensing question rather
than a storage one.

---

## 4. How often it runs

| Source | Cadence | Why that cadence |
|---|---|---|
| **TDnet** (if licensed) | **daily, non-negotiable** | the window is 31 days; a missed week is a permanent hole |
| SEC EDGAR | daily | the daily index names the day's filings; cheap and complete |
| EDINET | daily | same shape, and the API is the sanctioned route |
| OpenDART | daily | same |
| FCA NSM | weekly | no window, no index API found yet; weekly is enough until one is |
| Guidance capture | on the earnings calendar | the class that rots: capture on the day, not on the next sweep |

**The politeness budget, carried over from the data layer plan §4.** One request
at a time, four seconds apart, from one session; no concurrency; fetch once ever,
because a filing at a URL is immutable and the store *is* the cache; honour
`Retry-After` and back off; stop at the first sign of being unwelcome. SEC
publishes a 10 requests/second ceiling and this would use a fraction of it.

---

## 5. What it costs per month

**The volume, measured rather than guessed.** Apple's FY2025 Form 10-K as filed
is **16 files, 13.68 MB** for the whole accession. A 10-Q is a fraction of that
and an 8-K is usually under a megabyte, so a working average is **3–5 MB per
filing**.

For the 176 companies in the payload set, at roughly 12 filings a year each
(one annual, three interim, and the event filings), that is **~2,100 documents
and 7–11 GB a year** for the US; the UK, Japan and Korea together add a similar
order. Call it **20 GB in year one, growing by about 20 GB a year**.

| Line | Year 1 | Year 5 |
|---|---|---|
| R2 storage, 20 GB → 100 GB at $0.015/GB-month | **$0.30/mo** | **$1.50/mo** |
| Class A operations (~3,000 writes/month) | ~$0.01/mo | ~$0.01/mo |
| Class B operations (reads by the site) | under $0.10/mo | under $0.10/mo |
| Compute (scheduled runner) | $0 on existing allowances | $0 |
| **Total** | **well under $1/month** | **under $2/month** |

The first 10 GB-month is free, so year one is likely to cost **nothing at all**.

**The real cost is not money.** It is the attention of whoever watches a daily
job that must not silently stop — a crawl that fails quietly for three weeks
loses three weeks of TDnet for ever. The check that matters is not "did it run"
but "is every expected day present", and §7 builds that in.

**The paid alternatives, for comparison.** TDnet's server-type feed and API are
JPX contracts with unpublished prices. NSE licenses data commercially; the data
layer plan could not price a fundamentals licence either. The CSA sells SEDAR+
data through Data Distribution Services. None of these was priced, and each is a
conversation rather than a measurement.

---

## 6. What we lose for each day we wait

**1. Japan: one day, every day.** The free TDnet service holds 31 days — counted
on 2026-10-25, exactly 31 dates in the selector. Every day that passes without a
capture is a day of Japanese disclosure, including the tanshin forecasts that are
the only XBRL guidance in any of the eight countries, that leaves the free
service permanently. Over a year of waiting, that is a year of forecasts
available only under a JPX contract, if at all.

**2. India: about a year of filings per year.** Already measured in
`docs/DATA_LAYER_PLAN.md` §2.3: NSE's XBRL archive advertises twenty years and
delivers **six to seven**, with the oldest resolving filing dated around mid-2018
for every company tested. The archive prunes from the back. Nothing can be
captured there today anyway under NSE's terms — but the clock is running on what
a licence, if one is obtained, would still be able to reach.

**3. Everywhere: the first version, which is the whole point.** A restated figure
cannot be un-restated. "As first reported" is only answerable from a document
captured before the restatement, and that is true even at the SEC, where both
versions remain on EDGAR but nothing in this repository records which one it
read, or when. `ROADMAP.md` §13 lists point-in-time as a Next item; §6.3 of the
data layer plan says a store that overwrites "cannot be made point-in-time later
— the history is gone".

**4. Our own payloads were overwriting themselves. ~~Right now~~ — closed on
2026-10-25 by stage 0 (§7).** This was the cheapest loss to stop and the easiest
to overlook: the 176 payloads in `verify/payloads/` each carry a `fetchedAt`, and
a refetch **replaced the file**. Six were refetched on 2026-10-25 before the
store existed, and those previous versions are gone for good — including the
risk-free rate block as it stood and the prices earlier measurements were struck
against. Everything from the store onwards is kept. **Nothing third-party had to
agree to anything for that to stop**, which is the whole argument for doing the
stages in this order.

**5. Guidance, which rots fastest.** A company that revises or withdraws a
forecast replaces the copy on its own website. The original survives in the
original announcement — on EDGAR, on EDINET, on TDnet for 31 days — and nowhere
else.

**In one line: waiting a month costs about 175 filings and one gigabyte in
places that will still have them, and thirty-one days of Japan in the one place
that will not.**

---

## 7. The staged build

Each stage is one job with its own checks, in the pattern the data layer plan
uses. Stages 1 and later touch third parties; **stage 0 does not**, which is
why it is the one that is built.

**Stage 0 — stop overwriting what we already fetch. BUILT on 2026-10-25.**
A fetch now writes the capture first and moves the pointer second:

```
verify/payloads/<TICKER>.json                          the pointer, which is
                                                        what everything reads
verify/payloads/versions/<TICKER>/<when>__<sha>.json    the capture, written
                                                        once, then read-only
verify/payloads/versions/index.jsonl                    one appended line per
                                                        capture
```

The capture’s **name is the hash of its own contents**, which is what makes an
edit detectable rather than merely discouraged, and the file is chmod 444 after
writing, so a careless script gets an error from the operating system before
the check ever runs. The log carries what §1 requires of every capture: the
hash, our capture time, the source’s own `fetchedAt`, the shape version, the
source, the price it was struck at, and the size.

The 176 payloads that predate the store were **adopted** as their first capture,
dated by their own `fetchedAt` rather than by a time invented for them.

*The check, in `npm run verify`:* every capture still hashes to its own name;
the log and the files agree in **both** directions, so neither a deleted file
nor a deleted line can hide; every payload has at least one capture; and the
pointer the whole suite reads is byte-for-byte the newest capture.

*Proved by breaking, three ways at once* — one capture edited, one deleted,
and one pointer rewritten in place the way a refetch used to. The check
reported **6 faults** naming each: *"has been changed since it was captured: it
is named for 2392cdd5c2ad and now hashes to 7b1bdf6ea38b"*, *"is in the capture
log and not on disk"*, *"is not its newest capture … so the set is reading
something that was never kept"*. The read-only flag refused the first write on
its own (`EPERM`) before the break was forced through.

*And proved forward, on a real refetch:* MSFT was refetched after the store was
built. Its capture of 2026-10-21 (price **531.68**) is still there beside the
new one of 2026-10-25 (**524.51**), and the pointer equals the newer. Under the
behaviour of the day before, 531.68 would have been gone.

**Stage 1 — the SEC archive.** Daily index, documents for the watchlist, hashes,
the index table, and the store.
*Checks:* every document's stored hash matches a re-download; a day with no
filings is recorded as *captured and empty* rather than missing; a gap in the
day sequence fails the run.

**Stage 2 — as first reported.** The point-in-time query over the captured
documents, and the restatement view `ROADMAP.md` §13 asks for.
*Checks:* a figure restated between two captures is shown as two rows, not one;
the first-reported value reproduces the number in the document captured that day;
breaking the `superseded_by` link makes it fail.

**Stage 3 — EDINET, OpenDART, the NSM.** One adapter each, the API key work, and
the attribution the EDINET licence requires.
*Checks:* per-source; plus the attribution string appears wherever EDINET content
is shown.

**Stage 4 — guidance.** Earnings releases, the tanshin forecast, presentations
and transcripts, with the extraction contract from `docs/DATA_LAYER_PLAN.md`
§12: every extracted value carries its sentence, its page and its document hash,
and "not disclosed" where the document is silent.
*Checks:* no guidance value without a quotable sentence and a page; a document
with no forecast produces "not disclosed" rather than nothing.

**Stage 5 — gated on permission.** NSE, BSE, ASX, SEDAR+, TDnet. Nothing is
built here until there is a written answer or a licence.

---

## 8. Risks

- **Terms change.** Each source's terms are quoted here with the date they were
  read. A capture job should re-read them on a schedule and stop if the page it
  quoted no longer says what it said.
- **An archive is not a licence to redistribute.** Several of the permitted
  sources permit *use*; only the FCA's terms expressly license onward
  distribution. Showing a reader the document we captured is a separate
  question from holding it, and it should be decided per source rather than
  assumed.
- **Filings contain personal data** — names, addresses, shareholdings. They are
  published by law, but `CLAUDE.md`'s consent rule should be read before any of
  it is indexed or made searchable by person.
- **Silent failure is the real failure mode.** A daily job that stops is worse
  than one that never started, because the hole is invisible until someone asks
  for a date that is not there. Hence the day-sequence check in stage 1.
- **Scope creep into a mirror.** The archive is the documents of the companies
  this site models. "While we're here, take everything" turns a modest, defensible
  capture into a crawl of somebody's whole site, which is where terms get
  breached.

---

## 9. The decisions, and what is still open

**Taken on 2026-10-25:**

1. **Approved, and stage 0 started immediately.** Built the same day; §7 has
   what it does, what it measured and how it was proved to fail.
2. **Cloudflare R2 for the later stages — not set up yet.** The account will be
   created by Nihar, who will say when. Nothing in this repository provisions,
   configures or writes to any remote store, and stage 0 needs none.
3. **The permission letters are on hold until the end** — NSE, ASX and the CSA
   are not to be written to for now. **JPX (TDnet) is a separate decision Nihar
   will take on its own**, because it is the only one with a clock on it: the
   free service holds 31 days, so every week of delay is a week that can never
   be captured, whatever the answer turns out to be.
4. **BSE: read in a browser and sent — answered on 2026-10-29.** The terms
   prohibit "any reproduction, redistribution or transmission, for consideration
   or otherwise" of the information on the site, and require BSE's "express
   written consent" for any reproduction. **So BSE is NSE's position, not a
   softer one: licence needed, Paid · last** (§2.9). It was the last unverified
   row in §2.10 and the table now has none.

**Still open, and nothing is blocked on them today:**

- Whether the captured documents may be *shown* to a reader, source by source.
  Only the FCA’s terms expressly license onward distribution (§8).
- When stage 1 starts, which needs nothing from anyone: the SEC permits it and
  the store is built.
