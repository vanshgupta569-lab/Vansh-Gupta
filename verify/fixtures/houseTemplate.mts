// A REPRESENTATIVE FIRM TEMPLATE, written the way an analyst writes one.
//
// Deliberately NOT built from our own labels: it uses the names a real model
// uses ("Sales", "COGS", "SG&A", "EBIT", "PP&E"), has its own tabs, its own
// year header, a units column, a logo row and a section of lines we do not
// carry at all. Matching against it is the honest test of the matcher, because
// a template made from our labels would match everything and prove nothing.
import { createRequire } from 'node:module';
const REPO = 'C:/Users/VANSH/Documents/Vansh-Gupta';
const ExcelJS = createRequire(`${REPO}/package.json`)('exceljs');

export async function houseTemplateBytes(): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();

  const P = wb.addWorksheet('P&L');
  P.getCell('B1').value = 'ACME CAPITAL PARTNERS';
  P.getCell('B2').value = 'Operating model — $m unless stated';
  P.getCell('C4').value = 'FY2022';
  P.getCell('D4').value = 'FY2023';
  P.getCell('E4').value = 'FY2024';
  P.getCell('F4').value = 'FY2025E';
  P.getCell('G4').value = 'FY2026E';
  const pl: [string, string][] = [
    ['Sales', '$m'],
    ['COGS', '$m'],
    ['Gross profit', '$m'],
    ['Gross margin', '%'],
    ['R&D', '$m'],
    ['SG&A', '$m'],
    ['D&A', '$m'],
    ['Share based compensation', '$m'],
    ['EBIT', '$m'],
    ['EBITDA', '$m'],
    ['Interest expense', '$m'],
    ['Interest income', '$m'],
    ['Profit before tax', '$m'],
    ['Tax', '$m'],
    ['Effective tax rate', '%'],
    ['Net income', '$m'],
    ['Diluted EPS', '$'],           // we do not carry this
    ['Dividend per share', '$'],    // nor this
  ];
  pl.forEach(([name, unit], i) => {
    P.getCell(`B${6 + i}`).value = name;
    P.getCell(`C${6 + i}`).value = unit;
  });
  // the units column sits at C, so figures start at D for this sheet
  P.getCell('C4').value = '';
  P.getCell('D4').value = 'FY2022';
  P.getCell('E4').value = 'FY2023';
  P.getCell('F4').value = 'FY2024';
  P.getCell('G4').value = 'FY2025E';
  P.getCell('H4').value = 'FY2026E';

  const B = wb.addWorksheet('Balance sheet');
  const bs = [
    'Cash and cash equivalents',
    'Accounts receivable',
    'Inventories',
    'Other current assets',
    'Property plant and equipment',
    'Total assets',
    'Accounts payable',
    'Accrued expenses',
    'Short term debt',
    'Long term debt',
    'Total liabilities',
    'Retained earnings',
    'Total equity',
    'Minority interests',          // we do not carry this as a BS line
  ];
  B.getCell('B2').value = 'Balance sheet';
  B.getCell('D3').value = 'FY2022';
  B.getCell('E3').value = 'FY2023';
  bs.forEach((name, i) => {
    B.getCell(`B${5 + i}`).value = name;
    B.getCell(`C${5 + i}`).value = '$m';
  });

  const C = wb.addWorksheet('Cash flow');
  const cf = [
    'Net income',
    'Depreciation and amortisation',
    'Cash from operations',
    'Capital expenditure',
    'Cash from investing',
    'Cash from financing',
    'Free cash flow',              // we do not carry this by that name
  ];
  C.getCell('B2').value = 'Cash flow';
  cf.forEach((name, i) => {
    C.getCell(`B${4 + i}`).value = name;
    C.getCell(`C${4 + i}`).value = '$m';
  });

  const buf = await wb.xlsx.writeBuffer();
  return buf as ArrayBuffer;
}
