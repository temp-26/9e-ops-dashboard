import { useState } from 'react';
import { GROUPS, REDUCTION_DATE } from '../lib/model.js';
import { fmtDate } from '../lib/data.js';
import { Section, Card, Kpi, DataTable, ShowTable, Toggle, fmtInt, fmtNum, fmtCompact } from '../components/ui.jsx';
import { Bars, C } from '../components/charts.jsx';
import { DeptTrend } from '../components/trends.jsx';
import { useDrill, Num, asMixed } from '../components/drill.jsx';
import { useSalary, MASK } from '../lib/auth.jsx';
import { SalaryHidden } from '../components/charts.jsx';
import CostProjection from './CostProjection.jsx';

const DEPT_LABEL = { STR: 'Structures', 'Buss. Support': 'Business Support', Infra: 'Infrastructure', PM: 'Project Management' };
const SCOPES = [{ value: 'all', label: 'UAE & India' }, { value: 'UAE', label: 'UAE' }, { value: 'India', label: 'India' }];

function MonthlyTable({ rows }) {
  const { money } = useSalary();
  const keys = [...GROUPS, 'Total'].filter((k) => k === 'Total' || rows.some((r) => r[k]));
  const cols = [{ key: 'dept', label: 'Dept' }, ...rows.map((r, i) => ({ key: `m${i}`, label: `${r.label}${r.projected ? ' *' : ''}`, num: true }))];
  const body = keys.map((k) => {
    const o = { dept: DEPT_LABEL[k] ?? k, _total: k === 'Total' };
    rows.forEach((r, i) => { o[`m${i}`] = money(r[k]); });
    return o;
  });
  return <><DataTable dense columns={cols} rows={body} />{rows.some((r) => r.projected) && <p className="hint">* Projected month.</p>}</>;
}

// Workforce cost for the current month. Its permanent subtotal is the same figure as the
// current month's bar on the Monthly salaries chart (same staff, same India basis).
function WorkforceCost({ m, basis, monthLabel }) {
  const { money } = useSalary();
  const dub = m.active.filter((p) => p.entity === 'Dubai').map((p) => ({ ...p, amount: m.salary(p, m.asOf, basis) }));
  const ind = m.active.filter((p) => p.entity === 'India').map((p) => ({ ...p, amount: m.salary(p, m.asOf, basis) }));
  const sum = (l) => l.reduce((s, p) => s + (p.amount ?? 0), 0);
  const tempCost = m.activeTemps.reduce((s, t) => s + t.cost, 0);
  const dubCost = sum(dub); const indCost = sum(ind);
  const f2 = (v) => fmtNum(v, 2);
  return (
    <Card title={`Monthly Workforce Cost – ${monthLabel}`} eyebrow={`AED · as of ${fmtDate(m.asOf)}`}>
      <DataTable columns={[
        { key: 'seg', label: 'Segment' }, { key: 'hc', label: 'Headcount', num: true, render: (r) => <Num rows={r.list} kind={r.kind} title={r.seg}>{fmtInt(r.hc)}</Num> },
        { key: 'cost', label: 'Monthly Cost (AED)', num: true, render: (r) => money(r.cost, f2) },
      ]} rows={[
        { seg: 'Dubai permanent', hc: dub.length, cost: dubCost, list: dub, kind: 'salary' },
        { seg: `India permanent (${basis === 'access' ? 'incl. 35% Access' : 'salary only'})`, hc: ind.length, cost: indCost, list: ind, kind: 'salary' },
        { seg: `Permanent salaries – ${monthLabel}`, hc: dub.length + ind.length, cost: dubCost + indCost, list: [...dub, ...ind], kind: 'salary', _sub: true },
        { seg: 'Temp staff (active)', hc: m.activeTemps.length, cost: tempCost, list: m.activeTemps, kind: 'temps' },
        { seg: 'Total workforce cost', hc: dub.length + ind.length + m.activeTemps.length, cost: dubCost + indCost + tempCost, _total: true, list: asMixed(m.active, m.activeTemps), kind: 'mixed' },
      ]} />
      <p className="hint">"Permanent salaries – {monthLabel}" is the {monthLabel} bar on the Monthly salaries chart below. Temp cost converts INR and hourly rates as in the Excel. The India basis follows the switch at the top of this page.</p>
    </Card>
  );
}

export default function Salaries({ m }) {
  const [basis, setBasis] = useState('salary');
  const open = useDrill();
  const { visible, money } = useSalary();
  const [scope, setScope] = useState('all');
  // Jan..Dec; months after the as-of month are projected.
  const uae = m.monthlySalaries('UAE', basis, true);
  const ind = m.monthlySalaries('India', basis, true);
  const rows = scope === 'UAE' ? uae : scope === 'India' ? ind : m.monthlySalaries('all', basis, true);
  const last = m.months.length - 1; // the as-of month (KPIs and changes are to date)
  const pctChange = (a, b) => (!visible ? MASK : a ? `${b >= a ? '+' : '−'}${Math.abs(((b - a) / a) * 100).toFixed(1)}% vs ${rows[0].label}` : '');
  const inScope = (c) => scope === 'all' || c === scope;
  const payList = (mo, filter = () => true, any = false) => staffOf(mo).filter((p) => (any || inScope(p.country)) && filter(p))
    .map((p) => ({ ...p, amount: m.salary(p, mo.start, basis) })).sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0));
  const staffOf = (mo) => (mo.projected
    ? [...m.active, ...m.joiningLater.filter((p) => p.start && p.start <= mo.end)]
    : m.peopleAt(mo.end));
  const lastMo = m.months[m.months.length - 1];
  const scopeLabel = SCOPES.find((x) => x.value === scope).label;
  const toDate = rows.slice(0, last + 1);

  const chart = rows.map((r, i) => ({ name: r.label, projected: r.projected, partial: r.partial, UAE: uae[i].Total, India: ind[i].Total }));
  const series = scope === 'all'
    ? [{ key: 'UAE', label: 'UAE', color: C.red }, { key: 'India', label: 'India', color: C.ink2 }]
    : [{ key: scope, label: scopeLabel, color: scope === 'UAE' ? C.red : C.ink2 }];

  return (
    <Section eyebrow={`As of ${fmtDate(m.asOf)}`} title="Salaries – UAE & India (FTE)"
      subtitle={`Monthly payroll of permanent staff, in AED · Dubai reflects the ${fmtDate(REDUCTION_DATE)} reduction · India in AED equivalent`}>
      <div className="row-between">
        <div className="kpis">
          <Kpi onClick={() => open(`Salaries – UAE & India · ${lastMo.label}`, payList(lastMo, () => true, true), 'salary')} accent label={`Total · ${rows[last].label}`} value={`AED ${money(uae[last].Total + ind[last].Total, fmtCompact)}`} sub={pctChange(uae[0].Total + ind[0].Total, uae[last].Total + ind[last].Total)} />
          <Kpi onClick={() => open(`Salaries – UAE · ${lastMo.label}`, payList(lastMo, (p) => p.country === 'UAE', true), 'salary')} label="UAE" value={`AED ${money(uae[last].Total, fmtCompact)}`} sub={pctChange(uae[0].Total, uae[last].Total)} />
          <Kpi onClick={() => open(`Salaries – India · ${lastMo.label}`, payList(lastMo, (p) => p.country === 'India', true), 'salary')} label="India" value={`AED ${money(ind[last].Total, fmtCompact)}`} sub={pctChange(ind[0].Total, ind[last].Total)} />
        </div>
        <div className="controls">
          <Toggle label="Entity" value={scope} onChange={setScope} options={SCOPES} />
          <Toggle label="India salary basis" value={basis} onChange={setBasis} options={[
            { value: 'access', label: 'India incl. 35% Access' }, { value: 'salary', label: 'India salary only' },
          ]} />
        </div>
      </div>

      <WorkforceCost m={m} basis={basis} monthLabel={lastMo.label} />

      <Card title={`Monthly salaries – ${scopeLabel}`} eyebrow={`AED · ${rows[0].label} to ${rows[rows.length - 1].label} · to ${fmtDate(m.asOf)}, then projected`}>
        {!visible ? <SalaryHidden height={320} /> : <Bars money data={chart} cat="name" stacked series={series} height={320}
          onBarClick={(row, key) => { const mo = m.yearMonths.find((x) => x.label === row.name); if (mo) open(`Salaries – ${key} · ${mo.label}${mo.projected ? ' (projected)' : ''}`, payList(mo, (p) => p.country === key, true), 'salary'); }} />}
        <ShowTable><MonthlyTable rows={rows} /></ShowTable>
      </Card>

      <Card title={`Salaries by department – ${scopeLabel}`} eyebrow={`AED per month · change from ${rows[0].label} to ${rows[last].label}`}>
        <DeptTrend neutral masked={!visible} onRow={(g) => open(`Salaries – ${DEPT_LABEL[g] ?? g} · ${lastMo.label}`, payList(lastMo, (p) => p.group === g), 'salary', { eyebrow: scopeLabel })} rows={toDate} keys={GROUPS} labels={DEPT_LABEL} fmt={fmtInt} firstLabel={rows[0].label} lastLabel={rows[last].label} />
      </Card>

      <CostProjection m={m} basis={basis} />
    </Section>
  );
}
