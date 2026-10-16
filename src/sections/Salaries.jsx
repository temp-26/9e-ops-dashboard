import { useState } from 'react';
import { GROUPS, REDUCTION_DATE } from '../lib/model.js';
import { fmtDate } from '../lib/data.js';
import { Section, Card, DataTable, ShowTable, Toggle, fmtInt, fmtNum, fmtCompact } from '../components/ui.jsx';
import { Bars, SAL } from '../components/charts.jsx';
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

// Workforce cost for the current month = salaries (the current month's bar on the salary chart)
// + temp staff. The subtotal row ties the table to the chart.
function WorkforceCost({ m, basis, monthLabel }) {
  const { money } = useSalary();
  const withPay = (l, b) => l.map((p) => ({ ...p, amount: m.salary(p, m.asOf, b) }));
  const dub = withPay(m.active.filter((p) => p.entity === 'Dubai'), 'salary');
  const ind = withPay(m.active.filter((p) => p.entity === 'India'), 'salary');
  const indAcc = withPay(m.active.filter((p) => p.entity === 'India'), 'access');
  const sum = (l) => l.reduce((s, p) => s + (p.amount ?? 0), 0);
  const tempCost = m.activeTemps.reduce((s, t) => s + t.cost, 0);
  const dubCost = sum(dub); const indCost = sum(ind);
  const access = basis === 'access' ? sum(indAcc) - indCost : 0;
  const accessList = indAcc.map((p, i) => ({ ...p, amount: (p.amount ?? 0) - (ind[i].amount ?? 0) }));
  const f2 = (v) => fmtNum(v, 2);
  const perm = dubCost + indCost + access;
  const rows = [
    { seg: 'Dubai permanent', hc: dub.length, cost: dubCost, list: dub, kind: 'salary' },
    { seg: 'India permanent – salary', hc: ind.length, cost: indCost, list: ind, kind: 'salary' },
    ...(basis === 'access' ? [{ seg: 'India – 35% Access', hc: ind.length, cost: access, list: accessList, kind: 'salary' }] : []),
    { seg: `Salaries – ${monthLabel}  (= ${monthLabel} bar on the salary chart)`, hc: dub.length + ind.length, cost: perm, list: basis === 'access' ? [...dub, ...indAcc] : [...dub, ...ind], kind: 'salary', _sub: true },
    { seg: '+ Temp staff (active)', hc: m.activeTemps.length, cost: tempCost, list: m.activeTemps, kind: 'temps' },
    { seg: `= Total workforce cost – ${monthLabel}`, hc: dub.length + ind.length + m.activeTemps.length, cost: perm + tempCost, _total: true, list: asMixed(m.active, m.activeTemps), kind: 'mixed' },
  ];
  return (
    <Card title={`Monthly Workforce Cost – ${monthLabel}`} eyebrow={`AED · as of ${fmtDate(m.asOf)}`}>
      <DataTable columns={[
        { key: 'seg', label: 'Segment' }, { key: 'hc', label: 'Headcount', num: true, render: (r) => <Num rows={r.list} kind={r.kind} title={r.seg}>{fmtInt(r.hc)}</Num> },
        { key: 'cost', label: 'Monthly Cost (AED)', num: true, render: (r) => money(r.cost, f2) },
      ]} rows={rows} />
      <p className="hint">Total workforce cost = salaries of permanent staff (the {monthLabel} bar on the salary chart) + temp staff. Temp cost converts INR and hourly rates as in the Excel.</p>
    </Card>
  );
}

export default function Salaries({ m }) {
  const [basis, setBasis] = useState('access');
  const open = useDrill();
  const { visible, money } = useSalary();
  const [scope, setScope] = useState('all');
  // Jan..Dec; months after the as-of month are projected.
  const uae = m.monthlySalaries('UAE', 'salary', true);
  const indSal = m.monthlySalaries('India', 'salary', true);
  const indAcc = m.monthlySalaries('India', 'access', true);
  const rows = m.monthlySalaries(scope, basis, true); // department detail (table + trend)
  const temps = m.monthlyTempCost(scope);
  const last = m.months.length - 1; // the as-of month (KPIs and changes are to date)
  const showUae = scope !== 'India';
  const showInd = scope !== 'UAE';
  const showAcc = showInd && basis === 'access';

  const chart = m.yearMonths.map((mo, i) => {
    const r = { name: mo.label, projected: mo.projected, partial: mo.partial };
    if (showUae) r.UAE = uae[i].Total;
    if (showInd) r.India = indSal[i].Total;
    if (showAcc) r.Access = indAcc[i].Total - indSal[i].Total;
    r.Temp = temps[i].cost; // used by the Temp staff KPI only, not drawn
    r.Total = (r.UAE ?? 0) + (r.India ?? 0) + (r.Access ?? 0);
    return r;
  });
  const series = [
    ...(showUae ? [{ key: 'UAE', label: 'UAE salaries', color: SAL.uae }] : []),
    ...(showInd ? [{ key: 'India', label: 'India salaries', color: SAL.india }] : []),
    ...(showAcc ? [{ key: 'Access', label: 'India 35% Access', color: SAL.access, inside: true, insideColor: '#1F4F4C' }] : []),
  ];
  const cur = chart[last];
  const pctChange = (a, b) => (!visible ? MASK : a ? `${b >= a ? '+' : '−'}${Math.abs(((b - a) / a) * 100).toFixed(1)}% vs ${chart[0].name}` : '');
  const inScope = (c) => scope === 'all' || c === scope;
  const staffOf = (mo) => (mo.projected
    ? [...m.active, ...m.joiningLater.filter((p) => p.start && p.start <= mo.end)]
    : m.peopleAt(mo.end));
  const payList = (mo, filter = () => true, b = basis) => staffOf(mo).filter((p) => inScope(p.country) && filter(p))
    .map((p) => ({ ...p, amount: m.salary(p, mo.start, b) })).sort((a, z) => (z.amount ?? 0) - (a.amount ?? 0));
  const accessList = (mo) => staffOf(mo).filter((p) => p.country === 'India')
    .map((p) => ({ ...p, amount: (m.salary(p, mo.start, 'access') ?? 0) - (m.salary(p, mo.start, 'salary') ?? 0) })).sort((a, z) => z.amount - a.amount);
  const lastMo = m.months[last];
  const scopeLabel = SCOPES.find((x) => x.value === scope).label;
  const toDate = rows.slice(0, last + 1);
  const onBar = (row, key) => {
    const i = m.yearMonths.findIndex((x) => x.label === row.name);
    const mo = m.yearMonths[i];
    if (!mo) return;
    const tag = `${mo.label}${mo.projected ? ' (projected)' : ''}`;
    if (key === 'Temp') open(`Temp staff · ${tag}`, temps[i].list, 'temps');
    else if (key === 'Access') open(`India 35% Access · ${tag}`, accessList(mo), 'salary');
    else open(`Salaries – ${key} · ${tag}`, payList(mo, (p) => p.country === key, 'salary'), 'salary');
  };
  const kpiPeople = (f) => payList(lastMo, f);

  return (
    <Section eyebrow={`As of ${fmtDate(m.asOf)}`} title="Salaries – UAE & India"
      subtitle={`Monthly payroll of permanent staff, in AED · Dubai reflects the ${fmtDate(REDUCTION_DATE)} reduction · India in AED equivalent`}>
      <div className="row-between">
        <div className="cost-eq" aria-label="How the workforce cost adds up">
          <button className="eq-box eq-salary" onClick={() => open(`Salaries · ${lastMo.label}`, kpiPeople(() => true), 'salary')}>
            <span className="eq-label">Salaries · {cur.name}</span>
            <span className="eq-value">AED {money(cur.Total, fmtCompact)}</span>
            <span className="eq-sub">{visible ? `UAE ${fmtCompact(cur.UAE ?? 0)} · India ${fmtCompact((cur.India ?? 0) + (cur.Access ?? 0))}${showAcc ? ' incl. Access' : ''}` : MASK}</span>
            <span className="eq-note">= the {cur.name} bar on the chart</span>
          </button>
          <span className="eq-op" aria-hidden="true">+</span>
          <button className="eq-box eq-temp" onClick={() => open(`Temp staff · ${lastMo.label}`, temps[last].list, 'temps')}>
            <span className="eq-label">Temp staff · {cur.name}</span>
            <span className="eq-value">AED {money(cur.Temp, fmtCompact)}</span>
            <span className="eq-sub">{temps[last].list.length} active</span>
            <span className="eq-note">not in the salary chart</span>
          </button>
          <span className="eq-op" aria-hidden="true">=</span>
          <button className="eq-box eq-total" onClick={() => open(`Workforce · ${lastMo.label}`, asMixed(m.active.filter((p) => inScope(p.country)), temps[last].list), 'mixed')}>
            <span className="eq-label">Total workforce cost · {cur.name}</span>
            <span className="eq-value">AED {money(cur.Total + cur.Temp, fmtCompact)}</span>
            <span className="eq-sub">{pctChange(chart[0].Total + chart[0].Temp, cur.Total + cur.Temp)}</span>
            <span className="eq-note">salaries + temp staff</span>
          </button>
        </div>
        <div className="controls">
          <Toggle label="Entity" value={scope} onChange={setScope} options={SCOPES} />
          <Toggle label="India salary basis" value={basis} onChange={setBasis} options={[
            { value: 'access', label: 'India incl. 35% Access' }, { value: 'salary', label: 'India salary only' },
          ]} />
        </div>
      </div>

      <WorkforceCost m={m} basis={basis} monthLabel={lastMo.label} />

      <Card title={`Monthly salaries – ${scopeLabel}`} eyebrow={`Jan–${lastMo.label.slice(0, 3)} ${m.year} (Actuals)${m.yearMonths[last + 1] ? ` | ${m.yearMonths[last + 1].label.slice(0, 3)}–Dec ${m.year} (Projected)` : ''}`}>
        {!visible ? <SalaryHidden height={340} /> : <Bars money data={chart} cat="name" stacked series={series} height={340} onBarClick={onBar} highlight={cur.name} />}
        <ShowTable label="Show salaries by department"><MonthlyTable rows={rows} /></ShowTable>
      </Card>

      <Card title={`Salaries by department – ${scopeLabel}`} eyebrow={`AED per month · permanent staff · change from ${rows[0].label} to ${rows[last].label}`}>
        <DeptTrend neutral masked={!visible} onRow={(g) => open(`Salaries – ${DEPT_LABEL[g] ?? g} · ${lastMo.label}`, payList(lastMo, (p) => p.group === g), 'salary', { eyebrow: scopeLabel })} rows={toDate} keys={GROUPS} labels={DEPT_LABEL} fmt={fmtInt} firstLabel={rows[0].label} lastLabel={rows[last].label} />
      </Card>

      <CostProjection m={m} basis={basis} />
    </Section>
  );
}
