// Business logic: turns the raw Excel sheets into the people lists and figures the
// dashboard shows. Nothing here is hard-coded data — every number is computed from
// src/data/data.json, which is produced from the Excel file by `npm run update-data`.
import {
  table, cells, toDate, toNum, text, isBlank, monthEnd, monthStart, monthLabel,
} from './data.js';

// ---------- Department vocabulary (PPT terms) ----------
// The PPT groups Excel departments under these short names.
export const GROUPS = ['STR', 'MEP', 'Site Supervision', 'Buss. Support', 'Infra', 'AVIT', 'PM', 'AOR', 'Geotech'];
export const GROUP_LONG = {
  STR: 'Structures', MEP: 'MEP', 'Site Supervision': 'Site Supervision (Structures-Site + MEP-Site)',
  'Buss. Support': 'Business Support', Infra: 'Infrastructure', AVIT: 'AVIT', PM: 'Project Management',
  AOR: 'AOR', Geotech: 'Geotech',
};
export function groupOf(dept) {
  const d = text(dept).toLowerCase();
  if (!d) return 'Unassigned';
  if (d.includes('site')) return 'Site Supervision';
  if (d.startsWith('struct')) return 'STR';
  if (d.startsWith('mep')) return 'MEP';
  if (d.startsWith('business') || d.startsWith('buss')) return 'Buss. Support';
  if (d.startsWith('infra')) return 'Infra';
  if (d.startsWith('avit') || d.startsWith('av/it')) return 'AVIT';
  if (d.startsWith('project')) return 'PM';
  if (d.startsWith('aor')) return 'AOR';
  if (d.startsWith('geo')) return 'Geotech';
  return text(dept);
}
// Excel's own department names (used by the Excel "Dashboard" and "Cost Projection" sheets).
export const EXCEL_DEPTS = ['Structures', 'MEP', 'Structures-Site', 'MEP-Site', 'Business Support',
  'Project Management', 'Infrastructure', 'AVIT', 'AOR', 'Geotech'];

// ---------- Settings from the Checks sheet ----------
function checksValue(label) {
  for (const row of cells('Checks')) {
    const i = row.findIndex((v) => text(v).toLowerCase() === label.toLowerCase());
    if (i >= 0) return row[i + 1];
  }
  return null;
}
const AS_OF = toDate(checksValue('As-of date'));
const INR_PER_AED = toNum(checksValue('INR per 1 AED'));
const HOURS = toNum(checksValue('Hours / month (hourly temps)'));
export const SETTINGS = { asOf: AS_OF, inrPerAed: INR_PER_AED, hoursPerMonth: HOURS };
export const EXCEL_AS_OF = AS_OF;

// ---------- Salary reduction register ----------
const SR = (() => {
  const c = cells('Salary Reduction (Jun-26)');
  const hr = c.findIndex((r) => r.some((v) => text(v) === 'Employee Name'));
  return table('Salary Reduction (Jun-26)', hr);
})();
const nameKey = (s) => text(s).toLowerCase().replace(/[^a-z]/g, '');
export const REDUCTION = SR.rows
  .filter((r) => !isBlank(SR.get(r, 'Employee Name')))
  .map((r) => ({
    no: SR.get(r, 'No.'), dept: text(SR.get(r, 'Department')), name: text(SR.get(r, 'Employee Name')),
    title: text(SR.get(r, 'Job Title')), effective: toDate(SR.get(r, 'Effective Date')),
    current: toNum(SR.get(r, 'Current Salary (AED)')), cut: toNum(SR.get(r, 'Cut %')),
    reducedAmount: toNum(SR.get(r, 'Reduced Amount (AED)')), reduced: toNum(SR.get(r, 'Reduced Salary (AED)')),
    emailSent: text(SR.get(r, 'Email Sent')), signed: SR.get(r, 'Signed'), inRoster: text(SR.get(r, 'In Roster')),
  }));
export const REDUCTION_DATE = REDUCTION.find((r) => r.effective)?.effective ?? null;
const reductionByName = Object.fromEntries(REDUCTION.map((r) => [nameKey(r.name), r]));

// ---------- Permanent staff (FTE) ----------
const gender = (v) => { const t = text(v).toLowerCase(); return t === 'male' ? 'Male' : t === 'female' ? 'Female' : null; };
const isBimRole = (s) => /\bbim\b/i.test(s);

const D = table('Dubai Details');
const dubai = D.rows.filter((r) => !isBlank(D.get(r, 'Employee Name'))).map((r) => {
  const deptRole = text(D.get(r, 'Dept Role'));
  const role = text(D.get(r, 'Role'));
  const title = text(D.get(r, 'Job Title'));
  return {
    entity: 'Dubai', country: 'UAE', location: text(D.get(r, 'Location')) || 'Dubai',
    dept: text(D.get(r, 'Dept.')), group: groupOf(D.get(r, 'Dept.')),
    payroll: text(D.get(r, 'Payroll No.')), name: text(D.get(r, 'Employee Name')), title, role, deptRole,
    grading: toNum(D.get(r, 'Grading')), startRaw: D.get(r, 'Start Date'), start: toDate(D.get(r, 'Start Date')),
    age: toNum(D.get(r, 'Age')), gender: gender(D.get(r, 'Gender')), nationality: text(D.get(r, 'Nationality')),
    exp: toNum(D.get(r, 'Total Years of Experience')), manager: text(D.get(r, 'L1')),
    salaryPre: toNum(D.get(r, 'Total Current Salary')),
    salaryPost: toNum(D.get(r, 'Effective Salary Jun-26 (AED)')),
    bim: isBimRole(deptRole) || (!deptRole && isBimRole(`${role} ${title}`)),
  };
});

const I = table('India Details');
const india = I.rows.filter((r) => !isBlank(I.get(r, 'Employee Name'))).map((r) => {
  const role2 = text(I.get(r, 'Role', 1));
  const sal = toNum(I.get(r, 'Monthly Salary in AED'));
  return {
    entity: 'India', country: 'India', location: text(I.get(r, 'Location')),
    dept: text(I.get(r, 'Dept.')), group: groupOf(I.get(r, 'Dept.')),
    payroll: text(I.get(r, 'Payroll No.')), name: text(I.get(r, 'Employee Name')), title: text(I.get(r, 'Job Title')),
    role: text(I.get(r, 'Role', 0)), deptRole: role2, grading: toNum(I.get(r, 'Grading')),
    startRaw: I.get(r, 'Start Date'), start: toDate(I.get(r, 'Start Date')),
    age: toNum(I.get(r, 'Age')), gender: gender(I.get(r, 'Gender')), nationality: 'Indian (India entity)',
    exp: toNum(I.get(r, 'Total Years of Experience')), expGrad: toNum(I.get(r, 'Years of Experience from graduation')),
    manager: text(I.get(r, 'Line Manager')),
    salaryAed: sal, salaryAccess: toNum(I.get(r, 'Total Monthly Salary in AED')),
    accessMargin: toNum(I.get(r, 'Access - Margin Cost')),
    bim: isBimRole(role2),
  };
});
export const PERMANENT = [...dubai, ...india];

// India "35% Access" margin as found in the data (Access margin ÷ monthly salary), used for leavers.
const ratios = india.filter((p) => p.salaryAed && p.accessMargin).map((p) => p.accessMargin / p.salaryAed).sort((a, b) => a - b);
export const ACCESS_RATIO = ratios.length ? ratios[Math.floor(ratios.length / 2)] : 0;


// ---------- Leavers ----------
const L = table('Resigned & Terminated');
export const LEAVERS = L.rows.filter((r) => !isBlank(L.get(r, 'Employee Name'))).map((r) => {
  const ent = text(L.get(r, 'Entity')).toLowerCase();
  const entity = ent.startsWith('india') ? 'India' : 'Dubai';
  const g = gender(L.get(r, 'Gender')) ?? gender(L.get(r, 'Nationality'));
  const aligned = !!gender(L.get(r, 'Gender'));
  const type = text(L.get(r, 'Resigned/Terminateed')).toLowerCase().startsWith('term') ? 'Termination' : 'Resignation';
  const name = text(L.get(r, 'Employee Name'));
  const reg = entity === 'Dubai' ? reductionByName[nameKey(name)] : null;
  const s = toNum(L.get(r, 'Monthly Salary (AED)'));
  return {
    entity, country: entity === 'India' ? 'India' : 'UAE', location: text(L.get(r, 'Location')),
    dept: text(L.get(r, 'Department')), group: groupOf(L.get(r, 'Department')), payroll: text(L.get(r, 'Payroll No.')),
    name, title: text(L.get(r, 'Job Title')), start: toDate(L.get(r, 'Start Date')),
    lwdRaw: L.get(r, 'Last Working Day'), lwd: toDate(L.get(r, 'Last Working Day')), type, gender: g,
    rowAligned: aligned,
    // Salary used for the monthly salary trend: register first, else the sheet's salary if plausible.
    salaryPre: reg?.current ?? (s && s >= 1000 ? s : null),
    salaryPost: reg?.reduced ?? (s && s >= 1000 ? s : null),
    salaryAed: entity === 'India' && s && s > 0 ? s : null,
  };
});

// ---------- Temp staff ----------
const T = table('Temp Staff');
export const TEMPS = T.rows.filter((r) => !isBlank(T.get(r, 'Name'))).map((r) => {
  const currency = text(T.get(r, 'Currency')).toUpperCase();
  const amt = toNum(T.get(r, 'Cost (number)'));
  let cost = toNum(T.get(r, 'Monthly Cost (AED)', 1));
  if (cost === null && amt !== null) {
    cost = currency === 'INR' ? amt / INR_PER_AED : currency === 'AED/HR' ? amt * HOURS
      : currency === 'INR/HR' ? (amt * HOURS) / INR_PER_AED : amt;
  }
  const loc = text(T.get(r, 'Location'));
  const status = text(T.get(r, 'Status'));
  const include = text(T.get(r, 'Include? (Y/N)')).toUpperCase() !== 'N';
  return {
    contract: text(T.get(r, 'Contract')), location: loc,
    country: /dubai/i.test(loc) ? 'UAE' : /india/i.test(loc) ? 'India' : /uk|london/i.test(loc) ? 'United Kingdom' : loc,
    startRaw: T.get(r, 'Start Date'), start: toDate(T.get(r, 'Start Date')),
    endRaw: T.get(r, 'End Date'), end: toDate(T.get(r, 'End Date')),
    company: text(T.get(r, 'Company')), dept: text(T.get(r, 'Department')), group: groupOf(T.get(r, 'Department')),
    name: text(T.get(r, 'Name')), title: text(T.get(r, 'Designation')), status, include,
    active: include && /^active$/i.test(status), cost: cost ?? 0, costMissing: cost === null || cost === 0,
    currency, comments: text(T.get(r, 'Comments')), note: text(T.get(r, 'Review note')),
    bim: /\bbim\b|model/i.test(text(T.get(r, 'Designation'))),
  };
});

// =====================================================================
// Everything below is calculated for a chosen as-of date (default: the
// "As-of date" in the Excel Checks sheet). Nothing after that date is shown.
// =====================================================================

const tempOnBoard = (t, at) => {
  if (!t.include) return false;
  if (at >= AS_OF) return t.active; // at the Excel date, use the sheet's Status
  if (t.start && t.start > at) return false; // a start with no year/month counts as already on board
  if (t.active) return !t.end || t.end >= at;
  return !!t.end && t.end >= at && (!t.start || t.start <= at);
};

// Permanent staff on board on a date. From the Excel as-of date onwards the
// Dubai/India staff lists are used as-is (people on the Resigned sheet are excluded,
// as in the Excel). For earlier dates, leavers count until their last working day.
const leaverKnown = LEAVERS.filter((l) => l.lwd && l.start);
function permanentAt(at) {
  const roster = PERMANENT.filter((p) => p.start && p.start <= at);
  if (at >= AS_OF) return roster;
  return [...roster, ...leaverKnown.filter((l) => l.start <= at && l.lwd >= at)];
}

const salaryOf = (p, at, indiaBasis) => {
  const afterCut = REDUCTION_DATE && at >= REDUCTION_DATE;
  if (p.entity === 'Dubai') return afterCut ? p.salaryPost : p.salaryPre;
  if ('salaryAccess' in p) return indiaBasis === 'access' ? p.salaryAccess : p.salaryAed;
  if (p.salaryAed === null) return null;
  return indiaBasis === 'access' ? p.salaryAed * (1 + ACCESS_RATIO) : p.salaryAed;
};

const sameDeptCost = (a, b) => text(a).toLowerCase() === text(b).toLowerCase();

const cache = new Map();
export function makeModel(asOf = AS_OF) {
  const key = asOf.getTime();
  if (cache.has(key)) return cache.get(key);

  const year = asOf.getUTCFullYear();
  const lastM = asOf.getUTCMonth();
  // Month points Jan .. as-of month. The last point is the as-of date itself.
  const months = Array.from({ length: lastM + 1 }, (_, m) => {
    const end = m === lastM ? asOf : monthEnd(year, m);
    return { m, start: monthStart(year, m), end, label: monthLabel(monthStart(year, m)), partial: m === lastM && asOf < monthEnd(year, m) };
  });

  const active = permanentAt(asOf);
  const activeTemps = TEMPS.filter((t) => tempOnBoard(t, asOf));
  const yearStart = monthStart(year, 0);

  // --- joiners & leavers ---
  const everyone = [...PERMANENT, ...LEAVERS];
  const seen = new Set();
  const joinersYtd = everyone.filter((p) => {
    if (!p.start || p.start < yearStart || p.start > asOf) return false;
    const k = `${p.payroll}|${p.name}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).sort((a, b) => a.start - b.start);
  const joiningLater = PERMANENT.filter((p) => !p.start || p.start > asOf)
    .sort((a, b) => (a.start ?? Infinity) - (b.start ?? Infinity));
  const leaversYtd = LEAVERS.filter((l) => l.lwd && l.lwd >= yearStart && l.lwd <= asOf).sort((a, b) => a.lwd - b.lwd);
  const servingNotice = LEAVERS.filter((l) => l.lwd && l.lwd > asOf).sort((a, b) => a.lwd - b.lwd);
  const leaversUndated = LEAVERS.filter((l) => !l.lwd);
  const leaversEarlier = LEAVERS.filter((l) => l.lwd && l.lwd < yearStart);
  const monthsElapsed = months.length;

  const flow = months.map((mo) => ({
    label: mo.label,
    Joiners: joinersYtd.filter((p) => p.start.getUTCMonth() === mo.m).length,
    Resignation: leaversYtd.filter((l) => l.lwd.getUTCMonth() === mo.m && l.type === 'Resignation').length,
    Termination: leaversYtd.filter((l) => l.lwd.getUTCMonth() === mo.m && l.type === 'Termination').length,
  }));

  function monthlyHeadcount(scope = 'all') {
    const inScope = (c) => scope === 'all' || c === scope;
    return months.map((mo) => {
      const row = { label: mo.label, partial: mo.partial };
      GROUPS.forEach((g) => { row[g] = 0; });
      permanentAt(mo.end).forEach((p) => { if (inScope(p.country)) row[p.group] = (row[p.group] || 0) + 1; });
      row['Temp Staff'] = TEMPS.filter((t) => inScope(t.country) && tempOnBoard(t, mo.end)).length;
      row.FTE = GROUPS.reduce((s, g) => s + row[g], 0);
      row.Total = row.FTE + row['Temp Staff'];
      return row;
    });
  }

  function monthlySalaries(scope = 'all', indiaBasis = 'access') {
    const inScope = (c) => scope === 'all' || c === scope;
    return months.map((mo) => {
      const row = { label: mo.label, partial: mo.partial, missing: 0 };
      GROUPS.forEach((g) => { row[g] = 0; });
      permanentAt(mo.end).forEach((p) => {
        if (!inScope(p.country)) return;
        const v = salaryOf(p, mo.start, indiaBasis);
        if (v === null || v === undefined) row.missing += 1;
        else row[p.group] = (row[p.group] || 0) + v;
      });
      row.Total = GROUPS.reduce((s, g) => s + row[g], 0);
      return row;
    });
  }

  function breakup() {
    return GROUPS.map((g) => {
      const fixed = active.filter((p) => p.group === g).length;
      const temp = activeTemps.filter((t) => t.group === g).length;
      return { dept: g, Fixed: fixed, Temp: temp, Total: fixed + temp };
    });
  }

  function engVsBim(includeSite = false) {
    const groups = includeSite ? [...ENG_GROUPS, 'Site Supervision'] : ENG_GROUPS;
    const people = [
      ...active.map((p) => ({ group: p.group, loc: p.country === 'UAE' ? 'Dubai' : 'India', bim: p.bim, ref: { ...p, kind: 'FTE' } })),
      ...activeTemps.map((t) => ({ group: t.group, loc: t.country === 'UAE' ? 'Dubai' : t.country === 'India' ? 'India' : 'UK', bim: t.bim, ref: { ...t, kind: 'Temp', entity: t.country } })),
    ].filter((p) => groups.includes(p.group));
    return groups.map((g) => {
      const rows = ['Dubai', 'India', 'UK'].map((loc) => {
        const set = people.filter((p) => p.group === g && p.loc === loc);
        const e = set.filter((p) => !p.bim).map((p) => p.ref); const bm = set.filter((p) => p.bim).map((p) => p.ref);
        return { loc, eng: e.length, bim: bm.length, engList: e, bimList: bm };
      }).filter((r) => r.loc !== 'UK' || r.eng + r.bim > 0);
      const eng = rows.reduce((s, r) => s + r.eng, 0);
      const bim = rows.reduce((s, r) => s + r.bim, 0);
      return { group: g, rows, eng, bim, total: eng + bim, engList: rows.flatMap((r) => r.engList), bimList: rows.flatMap((r) => r.bimList) };
    });
  }

  function summary() {
    const dub = active.filter((p) => p.entity === 'Dubai');
    const ind = active.filter((p) => p.entity === 'India');
    const sal = (p) => (p.entity === 'Dubai' ? salaryOf(p, asOf, 'salary') : ('salaryAccess' in p ? p.salaryAed : p.salaryAed)) ?? 0;
    const ages = active.filter((p) => p.age !== null && p.age !== undefined && p.age >= 16 && p.age <= 75).map((p) => p.age);
    const exps = [
      ...dub.filter((p) => p.exp !== null && p.exp !== undefined && p.exp >= 0 && p.exp <= 55).map((p) => p.exp),
      ...ind.filter((p) => p.exp !== null && p.exp !== undefined && p.exp >= 0 && p.exp <= 55 && p.expGrad !== null && p.expGrad >= 0).map((p) => p.exp),
    ];
    const dubCost = dub.reduce((s, p) => s + sal(p), 0);
    const indCost = ind.reduce((s, p) => s + sal(p), 0);
    const tempCost = activeTemps.reduce((s, t) => s + t.cost, 0);
    const locs = ['Kochi', 'Mumbai', 'Bangalore', 'Delhi', 'Andhra Pradesh', 'Chennai'];
    const otherIndia = [...new Set(ind.map((p) => p.location))].filter((l) => l && !locs.includes(l));
    return {
      total: active.length, dubai: dub.length, india: ind.length, temp: activeTemps.length,
      leaversYtd: leaversYtd.length, servingNotice: servingNotice.length,
      joiningLaterDubai: joiningLater.filter((p) => p.entity === 'Dubai').length,
      joiningLaterIndia: joiningLater.filter((p) => p.entity === 'India').length,
      payroll: dubCost + indCost, dubCost, indCost, tempCost,
      byDept: EXCEL_DEPTS.map((d) => ({ dept: d, Dubai: dub.filter((p) => sameDeptCost(p.dept, d)).length, India: ind.filter((p) => sameDeptCost(p.dept, d)).length })),
      byLocation: [{ loc: 'Dubai (UAE)', n: dub.length }, ...[...locs, ...otherIndia].map((l) => ({ loc: l, n: ind.filter((p) => p.location === l).length }))],
      male: active.filter((p) => p.gender === 'Male').length, female: active.filter((p) => p.gender === 'Female').length,
      avgAge: ages.length ? ages.reduce((a, b) => a + b, 0) / ages.length : null,
      avgExp: exps.length ? exps.reduce((a, b) => a + b, 0) / exps.length : null,
      avgSalary: active.length ? (dubCost + indCost) / active.length : null,
    };
  }

  function costProjection() {
    const c = cells('Cost Projection');
    const hdr = c.find((r) => text(r[1]) === 'Department') ?? [];
    const pmonths = hdr.map(toDate).filter(Boolean);
    const salary = (p) => (p.entity === 'Dubai' ? p.salaryPost : p.salaryAed) ?? 0;
    const build = (entity) => EXCEL_DEPTS.map((d) => {
      const staff = PERMANENT.filter((p) => (!entity || p.entity === entity) && sameDeptCost(p.dept, d));
      const perm = staff.filter((p) => p.start && p.start <= asOf).reduce((s, p) => s + salary(p), 0);
      const temps = activeTemps.filter((t) => sameDeptCost(t.dept, d) && (!entity || t.location === entity));
      const temp = temps.reduce((s, t) => s + t.cost, 0);
      const byMonth = pmonths.map((m) => staff.filter((p) => p.start && p.start <= m).reduce((s, p) => s + salary(p), 0) + temp);
      return { dept: d, perm, temp, base: perm + temp, byMonth, total: byMonth.reduce((a, b) => a + b, 0) };
    });
    const totalRow = (rows, label) => ({
      dept: label, perm: rows.reduce((s, r) => s + r.perm, 0), temp: rows.reduce((s, r) => s + r.temp, 0),
      base: rows.reduce((s, r) => s + r.base, 0), byMonth: pmonths.map((_, i) => rows.reduce((s, r) => s + r.byMonth[i], 0)),
      total: rows.reduce((s, r) => s + r.total, 0), isTotal: true,
    });
    const d = build('Dubai'); const i = build('India'); const all = build(null);
    const saving = PERMANENT.filter((p) => p.entity === 'Dubai' && p.salaryPost !== null)
      .reduce((s, p) => s + ((p.salaryPre ?? 0) - p.salaryPost), 0);
    return {
      months: pmonths, saving, savingMonths: pmonths.length,
      sections: [
        { title: 'DUBAI (UAE)', rows: [...d, totalRow(d, 'DUBAI (UAE) — total')] },
        { title: 'INDIA', rows: [...i, totalRow(i, 'INDIA — total')] },
        { title: 'COMBINED (Dubai + India + Temp)', rows: [...all, totalRow(all, 'COMBINED (Dubai + India + Temp) — total')] },
      ],
    };
  }

  // Headcount bridge from 1 January: opening + joined − left − serving notice = now.
  const openDate = new Date(Date.UTC(year - 1, 11, 31));
  const opening = permanentAt(openDate);
  function bridge(scope = 'all') {
    const inScope = (p) => scope === 'all' || p.country === scope;
    const rows = GROUPS.map((g) => {
      const f = (list) => list.filter((p) => p.group === g && inScope(p));
      return { group: g, opening: f(opening), joined: f(joinersYtd), left: f(leaversYtd), notice: f(servingNotice), now: f(active) };
    }).filter((r) => r.opening.length + r.joined.length + r.left.length + r.now.length > 0);
    const tf = (list) => list.filter((t) => scope === 'all' || t.country === scope);
    return { rows, tempOpening: tf(TEMPS.filter((t) => tempOnBoard(t, openDate))), tempNow: tf(activeTemps), openDate };
  }

  const model = {
    asOf, year, months, bridge, openDate,
    peopleAt: permanentAt, tempsAt: (d) => TEMPS.filter((t) => tempOnBoard(t, d)),
    salary: (p, d, basis) => salaryOf(p, d, basis), active, activeTemps, joinersYtd, joiningLater, leaversYtd, servingNotice,
    leaversUndated, leaversEarlier, flow,
    avgJoiners: { count: joinersYtd.length, months: monthsElapsed, avg: monthsElapsed ? joinersYtd.length / monthsElapsed : 0 },
    monthlyHeadcount, monthlySalaries, breakup, engVsBim, summary, costProjection,
  };
  cache.set(key, model);
  return model;
}

export const ENG_GROUPS = ['STR', 'MEP', 'AVIT', 'Infra', 'Geotech'];

// ---------- Projected hires (parsed from the sheet's blocks) ----------
export function projectedHires() {
  const c = cells('Projected Hires');
  const blocks = [];
  c.forEach((row, r) => row.forEach((v, ci) => {
    if (text(v).toLowerCase() !== 'location') return;
    const title = text(c[r - 1]?.[ci]) || 'Openings';
    const items = [];
    for (let rr = r + 1; rr < c.length; rr++) {
      const pos = text(c[rr][ci + 1]);
      if (!pos) break;
      items.push({ location: text(c[rr][ci]), position: pos, openings: toNum(c[rr][ci + 2]) ?? 0 });
    }
    blocks.push({ title, items, total: items.reduce((s, i) => s + i.openings, 0) });
  }));
  return blocks;
}

// Display clean-up for nationality labels (data.json itself is untouched).
const NAT = { phillipines: 'Philippines', filipino: 'Philippines', uk: 'United Kingdom', british: 'United Kingdom',
  indian: 'India', canadian: 'Canada', 'sri lankan': 'Sri Lanka', 'new zealand': 'New Zealand', sweden: 'Sweden',
  egyptian: 'Egypt', jordanian: 'Jordan', syrian: 'Syria', emirati: 'UAE (Emirati)', 'south african': 'South Africa' };
export const nationalityLabel = (n) => NAT[text(n).toLowerCase()] ?? (text(n) || 'Not recorded');
