# ACCOUNTS_PLAN job A0 — prices checked (8 November 2026)

Read from each provider's own pricing page on 8 Nov 2026 by a free-chat research pass (Firebase's page refused access: not confirmed). All USD per month. Replaces the "not confirmed" prices in docs/ACCOUNTS_PLAN.md.

| Item | Checked figure |
|---|---|
| Supabase Free | $0; 500 MB database, 50,000 monthly active users, 5 GB egress, 1 GB files; no automatic backups; projects pause after 1 week inactive; 2 active projects |
| Supabase Pro | from $25; 8 GB disk then $0.125/GB; 100,000 MAU then $0.00325 each; 250 GB egress then $0.09/GB; daily backups kept 7 days (point-in-time recovery is a $100 add-on); spend cap on by default |
| Supabase Mumbai | ap-south-1 available; regional price difference not shown |
| Supabase passkeys | experimental (not generally available) — keeps passkeys after email sign-in, as decided |
| Vercel Hobby | free, **non-commercial personal use only** (taking payment, ads or paying anyone to build/host counts as commercial) |
| Vercel Pro | $20 with $20 usage credit, one seat; CPU from $0.128/hour, memory from $0.0106/GB-hour, $0.60 per million invocations |
| Vercel functions | Pro: up to 4 GB memory / 2 vCPU, 300 s default (800 s max); bundle 250 MB uncompressed (5 GB "large functions" in beta). Vercel names Puppeteer's bundled Chromium as a common cause of exceeding 250 MB — relevant to TEARSHEET_SPEC job 8 |
| Resend | free 3,000/month capped at 100/day; $20 for 50,000 |
| Postmark | free 100/month; $15 for 10,000 |
| Amazon SES | $0.10 per 1,000 (new accounts $0.16 on Essentials from 21 Jul 2026) |
| Cloudflare R2 | $0.015/GB-month; 10 GB free; free egress |

## Monthly running cost (Supabase Pro + Vercel Pro + email + R2)
Assumes 2 sign-in emails and 2 PDFs per user per month, 5 MB stored per user.

| Users | With Resend | With SES |
|---|---|---|
| 100 | about $45 | about $45 |
| 1,000 | about $45 | about $45 |
| 10,000 | about $66 | about $48 |

Not included: tax, extra seats, a domain, traffic beyond Vercel's credit, Supabase compute above Micro.

## Decisions (Nihar, 8 November 2026)
- While private: Supabase Free and Vercel Hobby (non-commercial). Expect a paused dev project after a week idle.
- At public launch or the first paid feature, whichever comes first: Vercel Pro and Supabase Pro (Paid · last) — Vercel Hobby forbids commercial use.
- Sign-in email: Resend free tier first (simplest with Supabase); move to Amazon SES when volume passes about 3,000 a month or 100 a day.
- Tearsheet server PDF (TEARSHEET job 8) must measure the Chromium bundle against the 250 MB limit before relying on it.
