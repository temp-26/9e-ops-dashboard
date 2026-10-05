// Converts the workforce Excel file into src/data/data.json.
//
// Usage:
//   npm run update-data                      -> uses the newest .xlsx in the data/ folder
//   npm run update-data -- path/to/file.xlsx -> uses that file
//
// It asks for the dashboard password and saves the data ENCRYPTED to
// src/data/data.enc.json (AES-256-GCM, key from PBKDF2-SHA256). Without the password
// the file is unreadable, so it is safe to put on GitHub. The same password opens the
// dashboard in the browser. To change the password, just run this again with a new one.
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
import { webcrypto as wc } from 'node:crypto';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'src', 'data', 'data.enc.json');
const PLAIN = path.join(ROOT, 'src', 'data', 'data.json');
const ITERATIONS = 600000;

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
    convertedAt: new Date().toISOString(),
    sheetOrder: wb.SheetNames,
    excludedColumns: excluded,
  },
  sheets,
};

async function getPassword() {
  if (process.env.DASHBOARD_PASSWORD) return process.env.DASHBOARD_PASSWORD;
  // One prompt session for all questions; typed characters are shown as *.
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: !!process.stdin.isTTY });
  let muted = false;
  rl._writeToOutput = (str) => { if (!muted || /^\r?\n$/.test(str)) rl.output.write(str); else if (str.length === 1) rl.output.write('*'); };
  const lines = rl[Symbol.asyncIterator]();
  const ask = async (q) => {
    muted = false; rl.output.write(q); muted = true;
    const { value, done } = await lines.next();
    muted = false;
    if (done) { console.log('\n  No password entered.'); process.exit(1); }
    return value;
  };
  try {
    for (;;) {
      const a = await ask('\n  Dashboard password: ');
      if (a.length < 10) { console.log('\n  Use at least 10 characters (mix words, numbers and symbols).'); continue; }
      const b = await ask('\n  Type it again:      ');
      if (a === b) { console.log(''); return a; }
      console.log('\n  The two passwords did not match. Try again.');
    }
  } finally { rl.close(); }
}

async function encrypt(obj, password) {
  const enc = new TextEncoder();
  const salt = wc.getRandomValues(new Uint8Array(16));
  const iv = wc.getRandomValues(new Uint8Array(12));
  const base = await wc.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  const key = await wc.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
  const data = await wc.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj)));
  const b64 = (u) => Buffer.from(u).toString('base64');
  return { format: '9e-aes-gcm-v1', kdf: 'PBKDF2-SHA256', iter: ITERATIONS, salt: b64(salt), iv: b64(iv), data: b64(new Uint8Array(data)) };
}

const password = await getPassword();
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(await encrypt(data, password)));
if (fs.existsSync(PLAIN)) fs.unlinkSync(PLAIN); // never leave an unencrypted copy in the project
const kb = (fs.statSync(OUT).size / 1024).toFixed(0);
console.log(`\n  Saved src/data/data.enc.json (${kb} KB, encrypted).`);
const ex = Object.entries(excluded);
if (ex.length) console.log(`  Left out (privacy): ${ex.map(([s, h]) => `${s}: ${h.join(', ')}`).join(' | ')}`);
if (missingCache) {
  console.log(`\n  WARNING: ${missingCache} formula cells had no saved value.`);
  console.log('  Open the file in Excel, press Save, then run this command again.');
}
console.log('\n  Done. Commit and push to GitHub to update the live dashboard.\n');
