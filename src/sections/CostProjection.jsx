import { useState } from 'react';
import { REDUCTION_DATE, sameDeptCost } from '../lib/model.js';
import { fmtDate } from '../lib/data.js';
import { Card, Kpi, DataTable, Toggle, fmtNum } from '../components/ui.jsx';
import { Bars, SAL } from '../components/charts.jsx';
import { useDrill, asMixed } from '../components/drill.jsx';
import { useSalary } from '../lib/auth.jsx';

/** Departmental cost projection, Jan–Dec, shown at the bottom of the Salaries tab. */
export default function CostProjection({ m, basis }) {
  const cp = m.costProjection(basis);
  const open = useDrill();
  const { money } = useSalary();
  const ent = ['Dubai', 'India', null];
  const [sec, setSec] = useState(2);
  const s = cp.sections[sec];
  const totals = cp.sections.map((x) => x.rows[x.rows.length - 1]);
  const first = cp.months[0];
  const last = cp.months[cp.months.length - 1];
  const cur = m.months[m.months.length - 1]; // the as-of month
  const chart = cp.months.map((mo, i) => ({
    name: mo.label, projected: mo.projected, partial: mo.partial,
    Dubai: totals[0].byMonth[i], India: totals[1].byMonth[i],
    Other: (() => { const v = totals[2].byMonth[i] - totals[0].byMonth[i] - totals[1].byMonth[i]; return v >= 1 ? v : 0; })(),
  }));
  const hasOther = chart.some((r) => r.Other > 0.5);
  const monthHead = (mo) => `${mo.label}${mo.projected ? ' *' : ''}`;
  const cols = [
    { key: 'dept', label: 'Department', render: (r) => {
      const e = ent[sec];
      const same = (d) => r.isTotal || sameDeptCost(d, r.dept);
      const ppl = m.active.filter((p) => (!e || p.entity === e) && same(p.dept)).map((p) => ({ ...p, amount: m.salary(p, m.asOf, basis) }));
      const tmp = m.activeTemps.filter((t) => (!e || (e === 'Dubai' ? t.country === 'UAE' : t.country === 'India')) && same(t.dept));
      return <button className="name-link" onClick={() => open(`${r.dept} – staff and temps`, asMixed(ppl, tmp), 'mixed', { eyebrow: `${s.title} · as of ${fmtDate(m.asOf)}` })}>{r.dept}</button>;
    } },
    { key: 'perm', label: 'Permanent (AED)', num: true, render: (r) => money(r.perm) },
    { key: 'temp', label: 'Temp (AED)', num: true, render: (r) => money(r.temp) },
    { key: 'base', label: 'Monthly Base (AED)', num: true, render: (r) => money(r.base) },
    ...cp.months.map((mo, i) => ({ key: `m${i}`, label: monthHead(mo), num: true, render: (r) => money(r.byMonth[i]) })),
    { key: 'total', label: `Total Jan–Dec ${m.year}`, num: true, render: (r) => money(r.total) },
  ];

  return (
    <>
      <div className="section-head sub">
        <div className="eyebrow">{`${first.label.slice(0, 3)} to ${last.label} · AED`}</div>
        <h2>Cost Projection</h2>
      </div>
      <div className="kpis">
        <Kpi accent label={`Combined total Jan–Dec ${m.year}`} value={`AED ${money(totals[2].total)}`} />
        <Kpi label={`Combined monthly base · ${cur.label}`} value={`AED ${money(totals[2].base)}`} sub="Permanent + temp, as of today" />
        <Kpi label={`Dubai salary reduction (eff ${fmtDate(REDUCTION_DATE)}) — monthly saving`} value={`AED ${money(cp.saving, (v) => fmtNum(v, 2))}`} />
        <Kpi label={`× ${cp.savingMonths} months (${cp.months.find((mo) => REDUCTION_DATE && mo.start >= REDUCTION_DATE)?.label.slice(0, 3) ?? ''}–${last.label.slice(0, 3)})`} value={`AED ${money(cp.saving * cp.savingMonths, (v) => fmtNum(v, 2))}`} />
      </div>
      <Card title="Projected monthly cost" eyebrow={`AED · stacked by entity · ${first.label} to ${last.label}`}>
        <Bars data={chart} cat="name" stacked money height={300} series={[
          { key: 'Dubai', label: 'Dubai (UAE)', color: SAL.uae }, { key: 'India', label: 'India', color: SAL.india },
          ...(hasOther ? [{ key: 'Other', label: 'Other-location temp (UK)', color: SAL.other }] : []),
        ]} />
      </Card>
      <Card title={s.title} aside={<Toggle label="Entity" value={sec} onChange={setSec} options={cp.sections.map((x, i) => ({ value: i, label: x.title.split(' (')[0] }))} />}>
        <DataTable dense columns={cols} rows={s.rows.map((r) => ({ ...r, _total: r.isTotal }))} />
        <p className="hint">* Projected month. Permanent, Temp and Monthly Base are as of {fmtDate(m.asOf)}. Click a department to see the people.</p>
      </Card>
    </>
  );
}
