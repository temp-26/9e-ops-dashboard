import { useState } from 'react';
import { REDUCTION_DATE, sameDeptCost } from '../lib/model.js';
import { fmtDate, monthLabel } from '../lib/data.js';
import { Section, Card, Kpi, DataTable, Toggle, fmtNum } from '../components/ui.jsx';
import { Bars, C } from '../components/charts.jsx';
import { useDrill, asMixed } from '../components/drill.jsx';
import { useSalary } from '../lib/auth.jsx';

export default function Cost({ m }) {
  const cp = m.costProjection();
  const open = useDrill();
  const { money } = useSalary();
  const ent = [ 'Dubai', 'India', null ];
  const [sec, setSec] = useState(2);
  const s = cp.sections[sec];
  const totals = cp.sections.map((x) => x.rows[x.rows.length - 1]);
  const m0 = cp.months[0];
  const mN = cp.months[cp.months.length - 1];
  const chart = cp.months.map((m, i) => ({ name: monthLabel(m), Dubai: totals[0].byMonth[i], India: totals[1].byMonth[i], Other: totals[2].byMonth[i] - totals[0].byMonth[i] - totals[1].byMonth[i] }));
  const cols = [
    { key: 'dept', label: 'Department', render: (r) => {
      const e = ent[sec];
      const same = (d) => r.isTotal || sameDeptCost(d, r.dept);
      const ppl = m.peopleAt(m.asOf).filter((p) => (!e || p.entity === e) && same(p.dept)).map((p) => ({ ...p, amount: p.entity === 'Dubai' ? p.salaryPost : p.salaryAed }));
      const tmp = m.activeTemps.filter((t) => (!e || t.location === e) && same(t.dept));
      return <button className="name-link" onClick={() => open(`${r.dept} – staff and temps`, asMixed(ppl, tmp), 'mixed', { eyebrow: s.title })}>{r.dept}</button>;
    } },
    { key: 'perm', label: 'Permanent (AED)', num: true, render: (r) => money(r.perm) },
    { key: 'temp', label: 'Temp (AED)', num: true, render: (r) => money(r.temp) },
    { key: 'base', label: 'Monthly Base (AED)', num: true, render: (r) => money(r.base) },
    ...cp.months.map((m, i) => ({ key: `m${i}`, label: monthLabel(m), num: true, render: (r) => money(r.byMonth[i]) })),
    { key: 'total', label: 'Total to Year-End', num: true, render: (r) => money(r.total) },
  ];
  return (
    <Section eyebrow={`As of ${fmtDate(m.asOf)}`} title={`Departmental Cost Projection — ${monthLabel(m0).slice(0, 3)} to ${monthLabel(mN)}`}
      subtitle="By entity and combined · Dubai reflects the salary reduction · active temp staff included (AED) · joiners added from their start month · India in AED equivalent">
      <div className="kpis">
        <Kpi accent label="Combined total to year-end" value={`AED ${money(totals[2].total)}`} />
        <Kpi label="Combined monthly base" value={`AED ${money(totals[2].base)}`} />
        <Kpi label={`Dubai salary reduction (eff ${fmtDate(REDUCTION_DATE)}) — monthly saving`} value={`AED ${money(cp.saving, (v) => fmtNum(v, 2))}`} />
        <Kpi label={`× ${cp.savingMonths} months`} value={`AED ${money(cp.saving * cp.savingMonths, (v) => fmtNum(v, 2))}`} />
      </div>
      <Card title="Projected monthly cost" eyebrow="AED · stacked by entity">
        <Bars data={chart} cat="name" stacked money series={[
          { key: 'Dubai', label: 'Dubai (UAE)', color: C.red }, { key: 'India', label: 'India', color: C.ink2 }, { key: 'Other', label: 'Other-location temp (UK)', color: C.grey4 },
        ]} height={280} />
      </Card>
      <Card title={s.title} aside={<Toggle label="Entity" value={sec} onChange={setSec} options={cp.sections.map((x, i) => ({ value: i, label: x.title.split(' (')[0] }))} />}>
        <DataTable dense columns={cols} rows={s.rows.map((r) => ({ ...r, _total: r.isTotal }))} />
      </Card>
    </Section>
  );
}
