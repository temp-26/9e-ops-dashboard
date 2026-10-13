// Low-level helpers for reading the workforce data (a faithful copy of the Excel file,
// decrypted in the browser after the password is entered).
// META and SHEETS are live bindings: loadRaw() swaps in new data (e.g. on "Refresh data").
export let META = { sourceFile: '', sheetOrder: [], excludedColumns: {} };
export let SHEETS = {};
export function loadRaw(raw) {
  META = raw.meta;
  SHEETS = raw.sheets;
}

const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

export function isBlank(v) {
  return v === null || v === undefined || (typeof v === 'string' && v.replace(/ /g, '').trim() === '');
}

/** Finds a sheet by name, ignoring capitals and extra spaces ("Cost projection" = "Cost Projection"). */
function sheetOf(sheet) {
  if (SHEETS[sheet]) return SHEETS[sheet];
  const k = Object.keys(SHEETS).find((n) => norm(n) === norm(sheet));
  return k ? SHEETS[k] : null;
}
export const hasSheet = (sheet) => !!sheetOf(sheet);

export function cells(sheet) {
  const s = sheetOf(sheet);
  if (!s) throw new Error(`Sheet "${sheet}" not found in the Excel data`);
  return s.cells;
}

/**
 * Reads a sheet whose first row (or `headerRow`) holds column names.
 * Returns { headers, rows, get(row, name, occurrence) }.
 * `occurrence` picks the n-th column with that name (Excel files often repeat headers).
 */
export function table(sheet, headerRow = 0) {
  const c = cells(sheet);
  const headers = c[headerRow] ?? [];
  const index = {};
  headers.forEach((h, i) => {
    const k = norm(h);
    if (!k) return;
    (index[k] ||= []).push(i);
  });
  const rows = c.slice(headerRow + 1).filter((r) => r.some((v) => !isBlank(v)));
  const col = (name, occurrence = 0) => {
    const list = index[norm(name)];
    if (!list) return -1;
    return occurrence < 0 ? list[list.length + occurrence] : list[occurrence] ?? -1;
  };
  const get = (row, name, occurrence = 0) => {
    const i = col(name, occurrence);
    return i < 0 ? null : row[i];
  };
  return { headers, rows, col, get };
}

// ---------- value parsing ----------
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** Parses Excel-ish date values into a UTC Date, or null if not a real date. */
export function toDate(v) {
  if (isBlank(v)) return null;
  if (typeof v === 'number') {
    if (v > 20000 && v < 80000) return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000); // Excel serial
    if (v >= 1990 && v <= 2100) return new Date(Date.UTC(v, 0, 1)); // a bare year
    return null;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/); // dd-mm-yyyy
  if (m) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
  m = s.match(/^(\d{1,2})[- ]([A-Za-z]{3,})[- ](\d{2,4})$/); // 12-Oct-26
  if (m) {
    const mi = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase());
    if (mi >= 0) return new Date(Date.UTC(m[3].length === 2 ? 2000 + +m[3] : +m[3], mi, +m[1]));
  }
  return null;
}

export function toNum(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const t = v.replace(/,/g, '').trim();
    if (/^-?\d+(\.\d+)?$/.test(t)) return +t;
  }
  return null;
}

export const text = (v) => (isBlank(v) ? '' : String(v).replace(/ /g, ' ').replace(/\s+/g, ' ').trim());

export const monthEnd = (y, m) => new Date(Date.UTC(y, m + 1, 0));
export const monthStart = (y, m) => new Date(Date.UTC(y, m, 1));
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const monthLabel = (d) => `${MON[d.getUTCMonth()]}-${String(d.getUTCFullYear()).slice(2)}`;
export const fmtDate = (d) => (d ? `${String(d.getUTCDate()).padStart(2, '0')}-${MON[d.getUTCMonth()]}-${d.getUTCFullYear()}` : '—');
