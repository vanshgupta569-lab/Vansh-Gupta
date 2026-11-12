// FILE: scripts/secBulk.mts
//
//   npm run sec:bulk -- download     the archive, streamed to disk
//   npm run sec:bulk -- measure      its size, and what is inside it
//   npm run sec:bulk -- defunct      are companies that stopped filing kept?
//
// BUILD STEP 5, PART D, JOB D0: answer the open questions in
// `docs/STEP5_BUILD_PLAN.md` §4.2 by measurement, and record them in
// `DATA_CONSTRAINTS.md`. `docs/SEC_BULK_NOTES.md` is Nihar's research pass and
// marks each item SEC, third party or UNCONFIRMED; this is what turns the
// UNCONFIRMED ones into figures.
//
// THE RULES THIS OBEYS, from the data layer:
//
//   - ONE REQUEST. The bulk archive exists so that a base-rate table does not
//     make 18,000 per-company requests, and taking it is the polite path, not
//     a way around a limit.
//   - THE CLIENT IDENTIFIES ITSELF HONESTLY, with the same contact string the
//     fetcher uses. The SEC asks for it and it costs nothing to give.
//   - A REFUSAL IS A REFUSAL. A 403, a challenge or a redirect to one is the
//     answer, recorded as the answer. Nothing here retries with a different
//     user agent or from anywhere else.
//   - STREAMED TO DISK, never held in memory: the file is of the order of a
//     gigabyte and this machine has had tasks killed for memory today.
//   - KEPT OUT OF GIT, under `.sec-bulk/`, like the payload set.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const DIR = path.join(REPO, '.sec-bulk');
const ZIP = path.join(DIR, 'companyfacts.zip');

/** The same contact the fetcher sends. One client, one name. */
const SEC_CONTACT = 'Marginalia Research vanshgupta569@gmail.com';
const URL = 'https://www.sec.gov/Archives/edgar/daily-index/xbrl/companyfacts.zip';

/** The three the plan names, to answer "are defunct filers kept?" (§4.2 item 2). */
const DEFUNCT = [
  { name: 'Time Warner Cable', cik: null as string | null, why: 'acquired by Charter in 2016' },
  { name: 'Sears Holdings', cik: '0001310067', why: 'bankrupt in 2018' },
  { name: 'Dell Technologies (the 2013 going-private)', cik: null as string | null, why: 'deregistered, then relisted' },
];

const MB = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(0)}MB`;
const GB = (bytes: number) => `${(bytes / 1024 / 1024 / 1024).toFixed(2)}GB`;

async function download() {
  fs.mkdirSync(DIR, { recursive: true });
  if (fs.existsSync(ZIP)) {
    const { size, mtime } = fs.statSync(ZIP);
    console.log(`already here: ${GB(size)}, fetched ${mtime.toISOString().slice(0, 19)}Z`);
    console.log('delete .sec-bulk/companyfacts.zip to fetch it again');
    return;
  }
  console.log(`asking ${URL}`);
  console.log(`identifying as: ${SEC_CONTACT}`);
  const started = Date.now();
  const res = await fetch(URL, { headers: { 'User-Agent': SEC_CONTACT } });
  console.log(`  ${res.status} ${res.statusText}`);
  if (!res.ok || !res.body) {
    // A refusal is the answer, written down as the answer.
    console.log(`REFUSED: ${res.status}. Recorded as the answer; nothing is retried another way.`);
    process.exit(1);
  }
  const declared = Number(res.headers.get('content-length') || 0);
  if (declared) console.log(`  content-length says ${GB(declared)}`);
  const tmp = `${ZIP}.part`;
  await pipeline(Readable.fromWeb(res.body as any), fs.createWriteStream(tmp));
  fs.renameSync(tmp, ZIP);
  const { size } = fs.statSync(ZIP);
  const secs = (Date.now() - started) / 1000;
  console.log(`\ndownloaded ${GB(size)} in ${secs.toFixed(0)}s (${MB(size / secs)}/s)`);
}

async function measure() {
  if (!fs.existsSync(ZIP)) {
    console.log('no archive yet: run `npm run sec:bulk -- download` first');
    process.exit(1);
  }
  const { size, mtime } = fs.statSync(ZIP);
  console.log(`\n=== the SEC bulk company-facts archive ===`);
  console.log(`  compressed on disk: ${GB(size)} (${size.toLocaleString('en-US')} bytes)`);
  console.log(`  fetched: ${mtime.toISOString().slice(0, 19)}Z`);

  // THE CENTRAL DIRECTORY, READ WITHOUT UNPACKING. A zip ends with an
  // end-of-central-directory record that says how many entries it holds and
  // where the directory starts; walking the directory gives every entry's name
  // and its uncompressed size without writing a single file to disk. Unpacking
  // this archive would cost many gigabytes to learn what the directory already
  // says.
  const fd = fs.openSync(ZIP, 'r');
  try {
    const tailLen = Math.min(size, 66 * 1024);
    const tail = Buffer.alloc(tailLen);
    fs.readSync(fd, tail, 0, tailLen, size - tailLen);
    let eocd = -1;
    for (let i = tail.length - 22; i >= 0; i--) {
      if (tail.readUInt32LE(i) === 0x06054b50) {
        eocd = i;
        break;
      }
    }
    if (eocd < 0) {
      console.log('  no end-of-central-directory record: not a zip this can read');
      return;
    }
    let entries = tail.readUInt16LE(eocd + 10);
    let dirSize = tail.readUInt32LE(eocd + 12);
    let dirAt = tail.readUInt32LE(eocd + 16);

    // Zip64, which an archive of this size needs: the 32-bit fields saturate.
    if (entries === 0xffff || dirAt === 0xffffffff || dirSize === 0xffffffff) {
      for (let i = tail.length - 20; i >= 0; i--) {
        if (tail.readUInt32LE(i) === 0x07064b50) {
          const z64At = Number(tail.readBigUInt64LE(i + 8));
          const z64 = Buffer.alloc(56);
          fs.readSync(fd, z64, 0, 56, z64At);
          if (z64.readUInt32LE(0) === 0x06064b50) {
            entries = Number(z64.readBigUInt64LE(32));
            dirSize = Number(z64.readBigUInt64LE(40));
            dirAt = Number(z64.readBigUInt64LE(48));
          }
          break;
        }
      }
      console.log('  (zip64: the 32-bit fields saturate at this size)');
    }
    console.log(`  entries: ${entries.toLocaleString('en-US')}`);

    const dir = Buffer.alloc(dirSize);
    fs.readSync(fd, dir, 0, dirSize, dirAt);
    let at = 0;
    let unpacked = 0;
    let counted = 0;
    const ciks = new Set<string>();
    while (at < dir.length - 46) {
      if (dir.readUInt32LE(at) !== 0x02014b50) break;
      const nameLen = dir.readUInt16LE(at + 28);
      const extraLen = dir.readUInt16LE(at + 30);
      const commentLen = dir.readUInt16LE(at + 32);
      let size32 = dir.readUInt32LE(at + 24);
      const name = dir.subarray(at + 46, at + 46 + nameLen).toString('utf8');
      if (size32 === 0xffffffff) {
        // zip64 extra field: the real size is in there.
        const extra = dir.subarray(at + 46 + nameLen, at + 46 + nameLen + extraLen);
        let e = 0;
        while (e < extra.length - 4) {
          const id = extra.readUInt16LE(e);
          const len = extra.readUInt16LE(e + 2);
          if (id === 0x0001 && len >= 8) size32 = Number(extra.readBigUInt64LE(e + 4));
          e += 4 + len;
        }
      }
      unpacked += size32;
      counted++;
      const m = name.match(/CIK(\d{10})\.json/i);
      if (m) ciks.add(m[1]);
      at += 46 + nameLen + extraLen + commentLen;
    }
    console.log(`  unpacked: ${GB(unpacked)} across ${counted.toLocaleString('en-US')} files`);
    console.log(`  one JSON per filer, named by 10-digit CIK: ${ciks.size.toLocaleString('en-US')} of them`);
    console.log(
      `  so D2 reads it on a machine with at least ${Math.ceil(unpacked / 1024 ** 3) + 1}GB free, or streams it entry by entry`
    );
    fs.writeFileSync(
      path.join(DIR, 'measured.json'),
      JSON.stringify(
        {
          measuredAt: new Date().toISOString(),
          url: URL,
          compressedBytes: size,
          unpackedBytes: unpacked,
          entries: counted,
          filers: ciks.size,
        },
        null,
        2
      )
    );
    console.log(`  written to .sec-bulk/measured.json`);
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * ARE COMPANIES THAT STOPPED FILING STILL IN THE ARCHIVE? (§4.2 item 2.)
 *
 * `BASE_RATE_SPEC` item 2 and `docs/SEC_BULK_NOTES.md` both mark this
 * UNCONFIRMED, and rule 9 says a base rate built on survivors only has to SAY
 * "survivors only; likely overstates growth". Whether that sentence is needed
 * is this question, and it is answered by looking rather than by reasoning.
 *
 * THREE COMPANIES THAT STOPPED FILING FOR THREE DIFFERENT REASONS, because one
 * of them being present would not tell us about the others: an acquisition, a
 * bankruptcy, and a going-private. Their CIKs come from the SEC's own lookup
 * file — a company is identified by its number, and a name typed here could
 * match the wrong filer.
 */
async function defunct() {
  if (!fs.existsSync(ZIP)) {
    console.log('no archive yet: run `npm run sec:bulk -- download` first');
    process.exit(1);
  }
  const lookupFile = path.join(DIR, 'cik-lookup-data.txt');
  if (!fs.existsSync(lookupFile)) {
    const url = 'https://www.sec.gov/Archives/edgar/cik-lookup-data.txt';
    console.log(`asking ${url}`);
    const res = await fetch(url, { headers: { 'User-Agent': SEC_CONTACT } });
    console.log(`  ${res.status} ${res.statusText}`);
    if (!res.ok || !res.body) {
      console.log('REFUSED. Recorded as the answer; nothing is retried another way.');
      process.exit(1);
    }
    await pipeline(Readable.fromWeb(res.body as any), fs.createWriteStream(lookupFile));
  }
  const lookup = fs.readFileSync(lookupFile, 'latin1');

  // Every CIK the archive holds, from its central directory.
  const present = new Set<string>();
  const fd = fs.openSync(ZIP, 'r');
  try {
    const { size } = fs.statSync(ZIP);
    const tail = Buffer.alloc(Math.min(size, 66 * 1024));
    fs.readSync(fd, tail, 0, tail.length, size - tail.length);
    let eocd = -1;
    for (let i = tail.length - 22; i >= 0; i--) if (tail.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
    let dirSize = tail.readUInt32LE(eocd + 12);
    let dirAt = tail.readUInt32LE(eocd + 16);
    if (dirAt === 0xffffffff || dirSize === 0xffffffff) {
      for (let i = tail.length - 20; i >= 0; i--) {
        if (tail.readUInt32LE(i) === 0x07064b50) {
          const z64At = Number(tail.readBigUInt64LE(i + 8));
          const z64 = Buffer.alloc(56);
          fs.readSync(fd, z64, 0, 56, z64At);
          dirSize = Number(z64.readBigUInt64LE(40));
          dirAt = Number(z64.readBigUInt64LE(48));
          break;
        }
      }
    }
    const dir = Buffer.alloc(dirSize);
    fs.readSync(fd, dir, 0, dirSize, dirAt);
    let at = 0;
    while (at < dir.length - 46) {
      if (dir.readUInt32LE(at) !== 0x02014b50) break;
      const nameLen = dir.readUInt16LE(at + 28);
      const extraLen = dir.readUInt16LE(at + 30);
      const commentLen = dir.readUInt16LE(at + 32);
      const name = dir.subarray(at + 46, at + 46 + nameLen).toString('utf8');
      const m = name.match(/CIK(\d{10})\.json/i);
      if (m) present.add(m[1]);
      at += 46 + nameLen + extraLen + commentLen;
    }
  } finally {
    fs.closeSync(fd);
  }
  console.log(`
=== are companies that stopped filing still here? ===`);
  console.log(`  the archive holds ${present.size.toLocaleString('en-US')} filers`);

  const wanted = [
    ['TIME WARNER CABLE', 'acquired by Charter in 2016'],
    ['SEARS HOLDINGS', 'bankrupt in 2018, delisted'],
    ['DELL INC', 'taken private in 2013, deregistered'],
  ];
  const out: any[] = [];
  for (const [name, why] of wanted) {
    // The lookup file is `NAME:CIK:` per line, upper case.
    const rows = lookup
      .split(/\r?\n/)
      .filter((l) => l.toUpperCase().startsWith(name + ':') || l.toUpperCase().startsWith(name + ' '))
      .slice(0, 6);
    const seen = new Set<string>();
    if (!rows.length) {
      console.log(`  ${name} (${why}): NOT IN THE SEC'S OWN LOOKUP FILE — reported, not guessed at`);
      out.push({ name, why, cik: null, inArchive: null });
      continue;
    }
    for (const row of rows) {
      const parts = row.trim().split(':').filter(Boolean);
      const cik = String(parts[parts.length - 1] || '').padStart(10, '0');
      if (seen.has(cik)) continue;
      seen.add(cik);
      const held = present.has(cik);
      console.log(`  ${parts[0]} — ${why}`);
      console.log(`      CIK ${cik}: ${held ? 'IS in the archive' : 'is NOT in the archive'}`);
      out.push({ name: parts[0], why, cik, inArchive: held });
    }
  }
  // JUDGED PER COMPANY, NOT PER NAME ROW.
  //
  // The lookup file carries every entity whose name begins with the one asked
  // for, and most of them are subsidiaries that never filed in their own
  // right: "Time Warner Cable Information Services (Alabama), LLC" is absent
  // because it never had facts, which says nothing about whether the SEC keeps
  // a filer after it stops filing. Counting rows answered "4 of 8" and the
  // true answer is three out of three. The question is about each COMPANY, so
  // a company counts as kept when ANY of its entities is in the archive.
  const byCompany = new Map<string, boolean>();
  for (const o of out) {
    if (o.inArchive === null) continue;
    byCompany.set(o.why, (byCompany.get(o.why) ?? false) || o.inArchive);
  }
  const kept = [...byCompany.values()].filter(Boolean).length;
  const tested = [...byCompany.keys()];
  console.log(
    `
  ${kept} of ${tested.length} companies that stopped filing are still in the archive,` +
      ` judged per company: an entity that never filed in its own right is absent for that reason` +
      ` and not because the SEC dropped it.`
  );
  console.log(
    kept === tested.length && tested.length > 0
      ? '  So the universe is NOT survivors-only, and rule 9 needs no warning sentence.'
      : kept === 0
        ? '  So the universe IS survivors-only: rule 9 requires "survivors only; likely overstates growth".'
        : '  MIXED: some are kept and some are not, so the warning is needed and the reason recorded.'
  );
  fs.writeFileSync(path.join(DIR, 'defunct.json'), JSON.stringify({ checkedAt: new Date().toISOString(), filers: present.size, tested: out }, null, 2));
  console.log('  written to .sec-bulk/defunct.json');
}

const what = process.argv[2] || 'measure';
if (what === 'download') await download();
else if (what === 'measure') await measure();
else if (what === 'defunct') await defunct();
else {
  console.log('usage: npm run sec:bulk -- download | measure | defunct');
  process.exit(1);
}
