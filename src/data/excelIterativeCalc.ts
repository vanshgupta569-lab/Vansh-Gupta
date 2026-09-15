// FILE: src/data/excelIterativeCalc.ts
//
// exceljs 4.4.0 writes only `fullCalcOnLoad` into a workbook's <calcPr>
// element (see node_modules/exceljs/lib/xlsx/xform/book/workbook-calc-
// properties-xform.js) — Workbook.calcProperties has no iterate /
// iterateCount / iterateDelta fields, and setting them on the object has no
// effect on the bytes exceljs writes. Excel needs iterate="1" in <calcPr> to
// resolve a circular reference by iterating rather than erroring, so without
// this patch the model sheet's circularity switch would be correct in
// formula terms but throw a circular-reference warning the moment a reader
// turned it on.
//
// This edits the already-serialized xlsx in place: unzip, rewrite
// xl/workbook.xml's <calcPr>, rezip. jszip is already a transitive
// dependency of exceljs — it's what exceljs itself uses to read and write
// the zip container — so this is declared directly rather than relied on
// implicitly.

import JSZip from 'jszip';

export interface IterativeCalcOptions {
  iterateCount?: number;
  iterateDelta?: number;
}

const CALC_PR = /<calcPr\b[^>]*\/>/;

export async function enableIterativeCalculation(
  buffer: ArrayBuffer | Uint8Array,
  options: IterativeCalcOptions = {}
): Promise<Uint8Array> {
  const { iterateCount = 100, iterateDelta = 0.001 } = options;
  const replacement = `<calcPr calcId="171027" fullCalcOnLoad="1" iterate="1" iterateCount="${iterateCount}" iterateDelta="${iterateDelta}"/>`;

  const zip = await JSZip.loadAsync(buffer);
  const path = 'xl/workbook.xml';
  const file = zip.file(path);
  if (!file) return buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

  const xml = await file.async('string');
  const patched = CALC_PR.test(xml)
    ? xml.replace(CALC_PR, replacement)
    : xml.replace('</workbook>', `${replacement}</workbook>`);
  zip.file(path, patched);

  return zip.generateAsync({ type: 'uint8array' });
}

export default { enableIterativeCalculation };
