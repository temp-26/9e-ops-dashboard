// Converts the workforce Excel file into the dashboard's encrypted data file.
//
// Usage:
//   npm run update-data                      -> uses the newest .xlsx in the data/ folder
//   npm run update-data -- path/to/file.xlsx -> uses that file
//
// The data is saved ENCRYPTED in the public/ folder: data.enc.json, locked with the
// dashboard password via key.json. See src/lib/vault.js.
//
// Every sheet, every row and every column is copied exactly as stored in Excel
// (formulas are copied as their last calculated value). The only exception is the
// personal ID columns listed in EXCLUDE_COLUMNS below, which are left out on purpose
// so they never reach the public website.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';
import readline from 'node:readline';
import { makeKeyFile, newDataKey, passwordKey, sealJson, unlockDataKey } from '../src/lib/vault.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'src', 'data', 'data.enc.json');
const PLAIN = path.join(ROOT, 'src', 'data', 'data.json');

// ---- Privacy setting -------------------------------------------------------
// Column headers matching any of these patterns are NOT copied into data.json.
// To include everything, change this to:  const EXCLUDE_COLUMNS = [];
const EXCLUDE_COLUMNS = [
  /passport/i,             // Passport No., Passport Expiry
  /^\s*visa\s*(no|expiry)/i, // Visa No., Visa Expiry (Visa Type is kept)
  /emirates\s*id/i,        // Emirates ID No.
  /labour\s*card/i,        // Labour Card No, Labour card expiry
  /contact\s*no/i,         // Employee Contact No. (phone)
  /date\s*of\s*birth/i,    // Date of Birth (Age is kept)
];
// ---------------------------------------------------------------------------

function pickInputFile() {
  const arg = process.argv[2];
  if (arg) return path.resolve(process.cwd(), arg);
  // excel-path.txt (made by "Update Dashboard.bat") points at the SharePoint file synced to this PC.
  const linkFile = path.join(ROOT, 'excel-path.txt');
  if (fs.existsSync(linkFile)) {
    const p = fs.readFileSync(linkFile, 'utf8').trim().replace(/^"|"$/g, '');
    if (p) {
      if (!fs.existsSync(p)) {
        console.error(`\n  Can't find the Excel file:\n  ${p}\n  Check that OneDrive is running and the file is synced, or delete excel-path.txt to choose again.\n`);
        process.exit(1);
      }
      return p;
    }
  }
  const dir = path.join(ROOT, 'data');
  const files = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => /\.xlsx$/i.test(f) && !f.startsWith('~$'))
    : [];
  if (!files.length) {
    console.error('\n  No Excel file found. Put your .xlsx file in the "data" folder and run again.\n');
    process.exit(1);
  }
  files.sort((a, b) => fs.statSync(path.join(dir, b)).mtimeMs - fs.statSync(path.join(dir, a)).mtimeMs);
  return path.join(dir, files[0]);
}

const pad = (n) => String(n).padStart(2, '0');

function cellValue(cell) {
  if (!cell) return null;
  if (cell.t === 'z') return null;
  if (cell.t === 'e') return cell.w ?? '#ERROR';
  if (cell.t === 'n' && cell.z && XLSX.SSF.is_date(cell.z)) {
    // Excel stores dates as serial numbers; convert to an exact calendar date string.
    const d = XLSX.SSF.parse_date_code(cell.v);
    if (d) {
      const date = `${d.y}-${pad(d.m)}-${pad(d.d)}`;
      const hasTime = d.H || d.M || Math.round(d.S);
      return hasTime ? `${date}T${pad(d.H)}:${pad(d.M)}:${pad(Math.round(d.S))}` : date;
    }
  }
  return cell.v === undefined ? null : cell.v;
}

const file = pickInputFile();
console.log(`\n  Reading: ${path.relative(ROOT, file) || file}`);
const wb = XLSX.readFile(file, { cellNF: true, cellDates: false, cellFormula: true });

const sheets = {};
const excluded = {};
let missingCache = 0;

for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name];
  if (!ws['!ref']) { sheets[name] = { cells: [] }; continue; }
  const range = XLSX.utils.decode_range(ws['!ref']);
  // Header row = first row; decide which columns to drop.
  const drop = new Set();
  for (let c = range.s.c; c <= range.e.c; c++) {
    const h = ws[XLSX.utils.encode_cell({ r: range.s.r, c })];
    const text = h && typeof h.v === 'string' ? h.v : '';
    if (text && EXCLUDE_COLUMNS.some((re) => re.test(text))) {
      drop.add(c);
      (excluded[name] ||= []).push(text.trim());
    }
  }
  const cells = [];
  // Rows/columns are kept from A1 so positions match the Excel sheet exactly.
  for (let r = 0; r <= range.e.r; r++) {
    const row = [];
    for (let c = 0; c <= range.e.c; c++) {
      if (drop.has(c)) continue;
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (cell && cell.f && cell.v === undefined) missingCache++;
      row.push(cellValue(cell));
    }
    cells.push(row);
  }
  sheets[name] = { cells };
  const used = cells.filter((r) => r.some((v) => v !== null && v !== '')).length;
  console.log(`  - ${name.padEnd(28)} ${String(used).padStart(4)} rows with data, ${cells[0]?.length ?? 0} columns`);
}

const data = {
  meta: {
    sourceFile: path.basename(file),
    // When the Excel was last saved (used as its "as-of" date if it has no Checks sheet).
    excelSaved: (wb.Props?.ModifiedDate instanceof Date && !Number.isNaN(+wb.Props.ModifiedDate)
      ? wb.Props.ModifiedDate : fs.statSync(file).mtime).toISOString(),
    convertedAt: new Date().toISOString(),
    sheetOrder: wb.SheetNames,
    excludedColumns: excluded,
  },
  sheets,
};

// ---------------------------------------------------------------------------
// Encrypt with the dashboard password. The first run sets the password; later runs
// ask for it again so people already signed in keep working and can simply press
// "Refresh data". Typing a different password offers to change it.
// (For automation, the password can be given in the DASHBOARD_PASSWORD variable.)
// ---------------------------------------------------------------------------
function prompter() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: !!process.stdin.isTTY });
  let muted = false;
  rl._writeToOutput = (str) => { if (!muted || /^\r?\n$/.test(str)) rl.output.write(str); else if (str.length === 1) rl.output.write('*'); };
  const lines = rl[Symbol.asyncIterator]();
  const ask = async (q, hidden = false) => {
    muted = false; rl.output.write(q); muted = hidden;
    const { value, done } = await lines.next();
    muted = false;
    if (done) { console.log('\n  Cancelled.'); process.exit(1); }
    return value;
  };
  return { ask, close: () => rl.close() };
}

const PUB = path.join(ROOT, 'public');
const KEYFILE = path.join(PUB, 'key.json');
fs.mkdirSync(PUB, { recursive: true });
let keyFile = fs.existsSync(KEYFILE) ? JSON.parse(fs.readFileSync(KEYFILE, 'utf8')) : null;
let dataKey;
const env = process.env.DASHBOARD_PASSWORD;
const p = env ? null : prompter();
try {
  const choose = async (first) => {
    let pw = first;
    while (!pw) {
      const a = await p.ask('\n  New dashboard password (min 10 characters): ', true);
      if (a.length < 10) { console.log('\n  Too short. Use at least 10 characters.'); continue; }
      const b = await p.ask('\n  Type it again: ', true);
      if (a === b) pw = a; else console.log('\n  The two passwords did not match.');
    }
    dataKey = newDataKey();
    keyFile = await makeKeyFile(pw, dataKey);
    fs.writeFileSync(KEYFILE, JSON.stringify(keyFile, null, 1));
    console.log('\n  New password set. Tell your colleagues; the old one stops working once this is published.');
  };
  if (keyFile) {
    const pw = env ?? await p.ask('\n  Dashboard password: ', true);
    try {
      dataKey = await unlockDataKey(await passwordKey(pw, keyFile.salt, keyFile.iter), keyFile);
    } catch {
      if (env) { console.log('\n  DASHBOARD_PASSWORD is not the current dashboard password.\n'); process.exit(1); }
      console.log('\n  That is not the current dashboard password.');
      const yn = await p.ask('  Do you want to CHANGE the password to a new one? (Y/N): ');
      if (!/^y/i.test(yn.trim())) { console.log('\n  Nothing changed. Run again and type the current password.\n'); process.exit(1); }
      await choose(null);
    }
  } else {
    console.log('\n  First time: choose the password people will type to open the dashboard.');
    await choose(env);
  }
} finally { p?.close(); }
console.log('');

fs.writeFileSync(path.join(PUB, 'data.enc.json'), JSON.stringify(await sealJson(dataKey, data)));
// Remove files from older versions and any plain copy.
for (const old of [OUT, PLAIN, path.join(PUB, 'access.json'), path.join(PUB, 'salary.enc.json')]) if (fs.existsSync(old)) fs.unlinkSync(old);

console.log('  Saved the encrypted data to public\\data.enc.json');
const ex = Object.entries(excluded);
if (ex.length) console.log(`  Left out (privacy): ${ex.map(([s, h]) => `${s}: ${h.join(', ')}`).join(' | ')}`);
if (missingCache) {
  console.log(`\n  WARNING: ${missingCache} formula cells had no saved value.`);
  console.log('  Open the file in Excel, press Save, then run this command again.');
}
console.log('\n  Done. Commit and push to GitHub to update the live dashboard.\n');
