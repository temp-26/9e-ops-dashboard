import { useState } from 'react';
import { GROUPS, REDUCTION_DATE } from '../lib/model.js';
import { fmtDate } from '../lib/data.js';
import { Section, Card, Kpi, DataTable, ShowTable, Toggle, fmtInt, fmtNum, fmtCompact } from '../components/ui.jsx';
import { Bars, C } from '../components/charts.jsx';
import { DeptTrend } from '../components/trends.jsx';
import { useDrill, Num, asMixed } from '../components/drill.jsx';

const DEPT_LABEL = { STR: 'Structures', 'Buss. Support': 'Business Support', Infra: 'Infrastructure', PM: 'Project Management' };
const SCOPES = [{ value: 'all', label: 'UAE & India' }, { value: 'UAE', label: 'UAE' }, { value: 'India', label: 'India' }];

function MonthlyTable({ rows }) {
  const keys = [...GROUPS, 'Total'].filter((k) => k === 'Total' || rows.some((r) => r[k]));
  const cols = [{ key: 'dept', label: 'Dept' }, ...rows.map((r, i) => ({ key: `m${i}`, label: r.label, num: true }))];
  const body = keys.map((k) => {
    const o = { dept: DEPT_LABEL[k] ?? k, _total: k === 'Total' };
    rows.forEach((r, i) => { o[`m${i}`] = fmtInt(r[k]); });
    return o;
  });
  return <DataTable dense columns={cols} rows={body} />;
}

function WorkforceCost({ m }) {
  const s = m.summary();
  const dub = m.active.filter((p) => p.entity === 'Dubai');
  const ind = m.active.filter((p) => p.entity === 'India');
  return (
    <Card title="Monthly Workforce Cost" eyebrow={`AED · as of ${fmtDate(m.asOf)}`}>
      <DataTable columns={[
        { key: 'seg', label: 'Segment' }, { key: 'hc', label: 'Headcount', num: true, render: (r) => <Num rows={r.list} kind={r.kind} title={r.seg}>{fmtInt(r.hc)}</Num> },
        { key: 'cost', label: 'Monthly Cost (AED)', num: true, render: (r) => fmtNum(r.cost, 2) },
      ]} rows={[
        { seg: 'Dubai permanent', hc: s.dubai, cost: s.dubCost, list: dub.map((p) => ({ ...p, amount: m.salary(p, m.asOf, 'salary') })), kind: 'salary' },
        { seg: 'India permanent', hc: s.india, cost: s.indCost, list: ind.map((p) => ({ ...p, amount: p.salaryAed })), kind: 'salary' },
        { seg: 'Temp staff (active)', hc: s.temp, cost: s.tempCost, list: m.activeTemps, kind: 'temps' },
        { seg: 'Total workforce cost', hc: s.total + s.temp, cost: s.dubCost + s.indCost + s.tempCost, _total: true, list: asMixed(m.active, m.activeTemps), kind: 'mixed' },
      ]} />
      <p className="hint">India here is "Monthly Salary in AED" (no Access margin); temp cost converts INR and hourly rates as in the Excel.</p>
    </Card>
  );
}

export default function Salaries({ m }) {
  const [basis, setBasis] = useState('access');
  const open = useDrill();
  const [scope, setScope] = useState('all');
  const uae = m.monthlySalaries('UAE', basis);
  const ind = m.monthlySalaries('India', basis);
  const rows = scope === 'UAE' ? uae : scope === 'India' ? ind : m.monthlySalaries('all', basis);
  const last = rows.length - 1;
  const pctChange = (a, b) => (a ? `${b >= a ? '+' : '−'}${Math.abs(((b - a) / a) * 100).toFixed(1)}% vs ${rows[0].label}` : '');
  const inScope = (c) => scope === 'all' || c === scope;
  const payList = (mo, filter = () => true, any = false) => m.peopleAt(mo.end).filter((p) => (any || inScope(p.country)) && filter(p))
    .map((p) => ({ ...p, amount: m.salary(p, mo.start, basis) })).sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0));
  const lastMo = m.months[m.months.length - 1];
  const scopeLabel = SCOPES.find((x) => x.value === scope).label;

  const chart = rows.map((r, i) => ({ name: r.label, UAE: uae[i].Total, India: ind[i].Total }));
  const series = scope === 'all'
    ? [{ key: 'UAE', label: 'UAE', color: C.red }, { key: 'India', label: 'India', color: C.ink2 }]
    : [{ key: scope, label: scopeLabel, color: scope === 'UAE' ? C.red : C.ink2 }];

  return (
    <Section eyebrow={`As of ${fmtDate(m.asOf)}`} title="Salaries – UAE & India (FTE)"
      subtitle={`Monthly payroll of permanent staff, in AED · Dubai reflects the ${fmtDate(REDUCTION_DATE)} reduction · India in AED equivalent`}>
      <div className="row-between">
        <div className="kpis">
          <Kpi onClick={() => open(`Salaries – UAE & India · ${lastMo.label}`, payList(lastMo, () => true, true), 'salary')} accent label={`Total · ${rows[last].label}`} value={`AED ${fmtCompact(uae[last].Total + ind[last].Total)}`} sub={pctChange(uae[0].Total + ind[0].Total, uae[last].Total + ind[last].Total)} />
          <Kpi onClick={() => open(`Salaries – UAE · ${lastMo.label}`, payList(lastMo, (p) => p.country === 'UAE', true), 'salary')} label="UAE" value={`AED ${fmtCompact(uae[last].Total)}`} sub={pctChange(uae[0].Total, uae[last].Total)} />
          <Kpi onClick={() => open(`Salaries – India · ${lastMo.label}`, payList(lastMo, (p) => p.country === 'India', true), 'salary')} label="India" value={`AED ${fmtCompact(ind[last].Total)}`} sub={pctChange(ind[0].Total, ind[last].Total)} />
        </div>
        <div className="controls">
          <Toggle label="Entity" value={scope} onChange={setScope} options={SCOPES} />
          <Toggle label="India salary basis" value={basis} onChange={setBasis} options={[
            { value: 'access', label: 'India incl. 35% Access' }, { value: 'salary', label: 'India salary only' },
          ]} />
        </div>
      </div>

      <WorkforceCost m={m} />

      <Card title={`Monthly salaries – ${scopeLabel}`} eyebrow={`AED · ${m.months[0].label} to ${fmtDate(m.asOf)}`}>
        <Bars money data={chart} cat="name" stacked series={series} height={320}
          onBarClick={(row, key) => { const mo = m.months.find((x) => x.label === row.name); if (mo) open(`Salaries – ${key} · ${mo.label}`, m.peopleAt(mo.end).filter((p) => p.country === key).map((p) => ({ ...p, amount: m.salary(p, mo.start, basis) })).sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0)), 'salary'); }} />
        <ShowTable><MonthlyTable rows={rows} /></ShowTable>
      </Card>

      <Card title={`Salaries by department – ${scopeLabel}`} eyebrow={`AED per month · change from ${rows[0].label} to ${rows[last].label}`}>
        <DeptTrend neutral onRow={(g) => open(`Salaries – ${DEPT_LABEL[g] ?? g} · ${lastMo.label}`, payList(lastMo, (p) => p.group === g), 'salary', { eyebrow: scopeLabel })} rows={rows} keys={GROUPS} labels={DEPT_LABEL} fmt={fmtInt} firstLabel={rows[0].label} lastLabel={rows[last].label} />
      </Card>
    </Section>
  );
}
