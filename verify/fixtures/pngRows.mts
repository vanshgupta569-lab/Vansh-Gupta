// FILE: verify/fixtures/pngRows.mts
//
// A PNG read back as per-row counts of lit pixels, without a decoding library.
//
// WHY A CHECK NEEDS THIS AT ALL: a bounding box is not what a reader sees.
// The header's wordmark sat in a box that was centred to the pixel while its
// INK sat 9px high of centre, because `leading-none` on a baseline-aligned
// box puts the glyphs where the box is not. A DOM assertion would have passed
// throughout. Only the picture shows it.
import zlib from 'node:zlib';

/** Lit pixels per row, top to bottom. `threshold` is 0-255 luminance. */
export function litRows(png: Buffer, threshold = 90): number[] {
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  const depth = png[24];
  const colour = png[25];
  if (depth !== 8 || (colour !== 6 && colour !== 2)) {
    throw new Error(`png ${depth}/${colour} is not read here`);
  }
  const channels = colour === 6 ? 4 : 3;
  const chunks: Buffer[] = [];
  let at = 8;
  while (at < png.length) {
    const len = png.readUInt32BE(at);
    if (png.toString('ascii', at + 4, at + 8) === 'IDAT') chunks.push(png.subarray(at + 8, at + 8 + len));
    at += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(chunks));
  const stride = width * channels;
  const prior = new Uint8Array(stride);
  const out: number[] = [];
  let pos = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[pos++];
    const line = new Uint8Array(raw.subarray(pos, pos + stride));
    pos += stride;
    // The five PNG filters, undone.
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? line[i - channels] : 0;
      const b = prior[i];
      const c = i >= channels ? prior[i - channels] : 0;
      if (filter === 1) line[i] = (line[i] + a) & 255;
      else if (filter === 2) line[i] = (line[i] + b) & 255;
      else if (filter === 3) line[i] = (line[i] + ((a + b) >> 1)) & 255;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        line[i] = (line[i] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      }
    }
    prior.set(line);
    let lit = 0;
    for (let x = 0; x < width; x++) {
      const i = x * channels;
      if (0.2126 * line[i] + 0.7152 * line[i + 1] + 0.0722 * line[i + 2] >= threshold) lit++;
    }
    out.push(lit);
  }
  return out;
}

/** The first and last rows carrying any ink, or null when the crop is blank. */
export function inkBand(png: Buffer, threshold = 90): { first: number; last: number; height: number } | null {
  const rows = litRows(png, threshold);
  const first = rows.findIndex((n) => n > 0);
  if (first < 0) return null;
  let last = first;
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i] > 0) {
      last = i;
      break;
    }
  }
  return { first, last, height: rows.length };
}
