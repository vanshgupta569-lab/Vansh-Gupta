# SEC bulk data — research notes for STEP5_BUILD_PLAN part D (5 November 2026)

From a free-chat research pass. SEC = read on an sec.gov page; third party = another site; UNCONFIRMED = not checked. Job D0 must measure every UNCONFIRMED item locally before D2.

## Facts
- companyfacts.zip: https://www.sec.gov/Archives/edgar/daily-index/xbrl/companyfacts.zip (SEC). Rebuilt nightly about 3:00 a.m. ET (SEC). Holds the data behind both the Company Facts and Frames APIs (SEC).
- Size: about 2 GB compressed (third party, UNCONFIRMED); unpacked size UNCONFIRMED. Measure in D0.
- Contents (SEC): one JSON per company named by 10-digit CIK; standard taxonomies only (us-gaap, ifrs-full, dei, srt); custom tags and segment-level facts are left out; one array per unit (currency) per concept; facts from 10-Q, 10-K, 8-K, 20-F, 40-F, 6-K and variants.
- Defunct filers (acquired, bankrupt, deregistered): UNCONFIRMED. CIKs are never reused and the SEC CIK list includes some non-filers (SEC). D0 test: Time Warner Cable (acquired 2016), Sears Holdings (CIK 1310067, bankrupt 2018), and one deregistered company — look up CIKs in cik-lookup-data.txt, then check for files in the zip.
- Backfill if missing: Financial Statement Data Sets (SEC), quarterly from January 2009, face statements "as filed"; reprocessed December 2024 (segments field added). Frames API: last-filed fact that best fits a calendar period; defunct coverage UNCONFIRMED.
- Fair access (SEC): at most 10 requests per second per user across all machines; exceeding it brings a temporary limit lifted after 10 minutes below the threshold; declare a User-Agent ("Company Name contact@domain"); unclassified bots and crawlers are not allowed.
- Revenue tags: RevenueFromContractWithCustomerExcludingAssessedTax, …IncludingAssessedTax, Revenues, SalesRevenueNet, SalesRevenueGoodsNet and sector variants. ASC 606 applies to annual periods beginning after 15 Dec 2017. Example (third party): Apple used SalesRevenueNet 2009–2017, Revenues 2018, the ASC 606 tag 2019 onward; Coca-Cola SalesRevenueGoodsNet until 2017, then Revenues.
- Known problems: each 10-K repeats earlier years (restatements); the fy field is the filing's fiscal year, not the period's (third party); Frames use calendar-fit periods (annual = 365 ± 30 days, SEC); some filers use ifrs-full instead of us-gaap; a third party found 339 filers with no revenue value after the ASC 606 switch (UNCONFIRMED).

## Rules the builder (D1–D2) must follow
1. Download the bulk zip once per run with a declared User-Agent, at most 10 requests per second, record the snapshot date, read it as a stream.
2. Build the universe from the SEC CIK list, not the tickers file; if defunct filers are missing, backfill from the Financial Statement Data Sets, or label results "survivors only".
3. Revenue per fiscal year from the shared tag chain (D1), recording which tag each year used; a switch between including-tax and excluding-tax tags is flagged as a possible break.
4. Annual facts only: about 365 days (52/53-week years allowed); group by period end date, never by fy; transition periods excluded.
5. Keep the filed date on every fact so both latest-restated and as-first-filed series can be built.
6. Read both us-gaap and ifrs-full; keep the unit with every value; never mix currencies in a series; version 1 counts USD reporters only.
7. Companies with no usable top line (banks, insurers, custom or segment-only tags) are "not measurable", never zero.
8. CAGR is undefined when starting revenue is zero or negative: excluded and counted.
