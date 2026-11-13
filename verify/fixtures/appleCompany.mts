// FILE: verify/fixtures/appleCompany.mts
//
// APPLE'S OWN FILED PAYLOAD, served offline (KI-43, Nihar 2026-11-13).
//
// The dashboard check used to open Apple the way a reader did before
// 2026-11-12: search, then "Skip and build the model" on the questions screen.
// Every route into a company opens the company page now, and that page needs a
// payload. The check answered `/api/company?ticker=AAPL` with a 404 on the
// premise that the curated company "renders without fetching anything" — which
// stopped being true, so the journey dead-ended on "Nothing to show".
//
// THIS DOES NOT PUT THE HAND-BUILT MODEL BACK ON THE SITE. Standing decision 1
// says the engine builds every model and the hand-built Apple file is a test
// fixture and a verification reference, not something a reader sees. So the
// browser journey now drives THE ENGINE'S model of Apple, built from Apple's
// own filed payload — the same payload the live site would fetch — and the
// curated comparison stays where it does not need a browser: `npm run verify`
// and the workbook suite compare 60 models including curated Apple, and agree
// to 3.77e-9% at worst.
//
// NOTHING LEAVES THE MACHINE. The payload is the one already in
// `verify/payloads/AAPL.json`, which the capture archive maintains, so this
// adds no network call and no second copy of Apple's figures.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PAYLOAD = path.join(HERE, '..', 'payloads', 'AAPL.json');

export const APPLE_TICKER = 'AAPL';

/**
 * Apple's filed payload, read fresh each call.
 *
 * Fresh rather than cached because the check hands it to `route.fulfill` and
 * to `buildCompanyFrom` in the same run, and a shared object that one of them
 * mutates would put the page and the expectation quietly out of step — which
 * is the "comparing a figure against itself" trap wearing different clothes.
 */
export function applePayload(): any {
  if (!fs.existsSync(PAYLOAD)) {
    throw new Error(
      `verify/payloads/AAPL.json is missing, so the dashboard cannot drive Apple offline. ` +
        `Run the capture to restore it.`
    );
  }
  return JSON.parse(fs.readFileSync(PAYLOAD, 'utf8'));
}
