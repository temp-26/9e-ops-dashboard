import { useState } from 'react';
import { GROUPS } from '../lib/model.js';
import { fmtDate } from '../lib/data.js';
import { Section, Card, Kpi, DataTable, ShowTable, fmtInt, fmtNum, Toggle } from '../components/ui.jsx';
import { Bars, C } from '../components/charts.jsx';
import { HeadcountBridge } from '../components/trends.jsx';
import { useDrill, Num, asMixed } from '../components/drill.jsx';

const DEPT_LABEL = { STR: 'Structures', 'Buss. Support': 'Business Support', Infra: 'Infrastructure', PM: 'Project Management' };
const SCOPES = [{ value: 'all', label: 'UAE & India' }, { value: 'UAE', label: 'UAE' }, { value: 'India', label: 'India' }];

function MonthlyTable({ rows }) {
  const keys = [...GROUPS, 'Temp Staff', 'Total'].filter((k) => k === 'Total' || rows.some((r) => r[k]));
  const cols = [{ key: 'dept', label: 'Dept' }, ...rows.map((r, i) => ({ key: `m${i}`, label: r.label, num: true }))];
  const body = keys.map((k) => {
    const o = { dept: DEPT_LABEL[k] ?? k, _total: k === 'Total' };
    rows.forEach((r, i) => { o[`m${i}`] = fmtInt(r[k]); });
    return o;
  });
  return <DataTable dense columns={cols} rows={body} />;
}

export default function Headcount({ m }) {
  const open = useDrill();
  const breakup = m.breakup();
  const tot = breakup.reduce((a, r) => ({ Fixed: a.Fixed + r.Fixed, Temp: a.Temp + r.Temp, Total: a.Total + r.Total }), { Fixed: 0, Temp: 0, Total: 0 });
  const countries = [...new Set([...m.active.map((p) => p.country), ...m.activeTemps.map((t) => t.country)])].map((c) => ({
    c, fte: m.active.filter((p) => p.country === c), temp: m.activeTemps.filter((t) => t.country === c),
  }));
  const [tempScope, setTempScope] = useState('UAE');
  const [scope, setScope] = useState('all');
  const scopeLabel = SCOPES.find((x) => x.value === scope).label;
  const inScope = (c) => scope === 'all' || c === scope;
  const rows = m.monthlyHeadcount(scope);
  const tempList = m.activeTemps.filter((t) => t.country === tempScope);
  const asOfLabel = fmtDate(m.asOf);
  const openLabel = fmtDate(new Date(Date.UTC(m.year, 0, 1)));

  const onMonth = (row, key) => {
    const mo = m.months.find((x) => x.label === row.name);
    if (!mo) return;
    const ppl = m.peopleAt(mo.end).filter((p) => inScope(p.country));
    const tmp = m.tempsAt(mo.end).filter((t) => inScope(t.country));
    const when = mo.partial ? fmtDate(mo.end) : `end of ${mo.label}`;
    if (key === 'Temp Staff') open(`Temp staff on board – ${when}`, tmp, 'temps', { eyebrow: scopeLabel });
    else open(`Permanent staff on board – ${when}`, ppl, 'people', { eyebrow: scopeLabel });
  };

  return (
    <Section eyebrow={`As of ${asOfLabel}`} title="Headcount – UAE & India">
      <div className="kpis">
        <Kpi accent label="Total (FTE + Temp)" value={fmtInt(tot.Total)} onClick={() => open('Everyone on board', asMixed(m.active, m.activeTemps), 'mixed', { eyebrow: `As of ${asOfLabel}` })} />
        <Kpi label="FTE" value={fmtInt(tot.Fixed)} onClick={() => open('Permanent staff (FTE)', m.active, 'people', { eyebrow: `As of ${asOfLabel}` })} />
        <Kpi label="Temp Staff" value={fmtInt(tot.Temp)} onClick={() => open('Temp staff', m.activeTemps, 'temps', { eyebrow: `As of ${asOfLabel}` })} />
        <Kpi label="Avg new joiners / month" value={fmtNum(m.avgJoiners.avg, 1)} sub={`Jan–${m.months.at(-1).label.slice(0, 3)} ${m.year}`} onClick={() => open(`New joiners in ${m.year}`, m.joinersYtd, 'people')} />
        {countries.map((c) => <Kpi key={c.c} label={c.c} value={fmtInt(c.fte.length + c.temp.length)} sub={`${c.fte.length} FTE + ${c.temp.length} temp`}
          onClick={() => open(`${c.c} – everyone on board`, asMixed(c.fte, c.temp), 'mixed', { eyebrow: `As of ${asOfLabel}` })} />)}
      </div>

      <div className="grid-2-1">
        <Card title={`Headcount – ${scopeLabel}`} eyebrow={`Month-end · ${m.months[0].label} to ${asOfLabel}`}
          aside={<Toggle label="Entity" value={scope} onChange={setScope} options={SCOPES} />}>
          <Bars data={rows.map((r) => ({ name: r.label, FTE: r.FTE, 'Temp Staff': r['Temp Staff'] }))} cat="name" stacked onBarClick={onMonth}
            series={[{ key: 'FTE', label: 'Permanent (FTE)', color: C.red }, { key: 'Temp Staff', label: 'Temp Staff', color: C.grey4 }]} height={320} />
          <ShowTable><MonthlyTable rows={rows} /></ShowTable>
        </Card>
        <Card title="Breakup Current Dated" eyebrow={`UAE & India · as of ${asOfLabel}`}>
          <DataTable columns={[
            { key: 'dept', label: 'Dept', render: (r) => DEPT_LABEL[r.dept] ?? r.dept },
            { key: 'Fixed', label: 'Fixed', num: true, render: (r) => <Num rows={r._total ? m.active : m.active.filter((p) => p.group === r.dept)} title={`${DEPT_LABEL[r.dept] ?? r.dept} – permanent staff`}>{r.Fixed}</Num> },
            { key: 'Temp', label: 'Temp', num: true, render: (r) => <Num kind="temps" rows={r._total ? m.activeTemps : m.activeTemps.filter((t) => t.group === r.dept)} title={`${DEPT_LABEL[r.dept] ?? r.dept} – temp staff`}>{r.Temp}</Num> },
            { key: 'Total', label: 'Total', num: true, render: (r) => <Num kind="mixed" rows={asMixed(r._total ? m.active : m.active.filter((p) => p.group === r.dept), r._total ? m.activeTemps : m.activeTemps.filter((t) => t.group === r.dept))} title={`${DEPT_LABEL[r.dept] ?? r.dept} – everyone`}>{r.Total}</Num> },
          ]} rows={[...breakup, { dept: 'Total', ...tot, _total: true }]} />
          <p className="hint">Click any number to see the people.</p>
        </Card>
      </div>

      <Card title={`Headcount by department – ${scopeLabel}`} eyebrow={`${openLabel} + joined − left = ${asOfLabel}`}>
        <HeadcountBridge bridge={m.bridge(scope)} monthly={rows} labels={DEPT_LABEL} openLabel={openLabel} nowLabel={asOfLabel} />
        <p className="hint">Click any number to see who joined, who left and who is on board.</p>
      </Card>

      <Card title="Temp staff" eyebrow="Active temporary / contract staff" aside={
        <Toggle label="Location" value={tempScope} onChange={setTempScope} options={
          [...new Set(m.activeTemps.map((t) => t.country))].map((c) => ({ value: c, label: `${c} (${m.activeTemps.filter((t) => t.country === c).length})` }))
        } />
      }>
        <DataTable dense maxHeight={340} columns={[
          { key: 'name', label: 'Name' }, { key: 'group', label: 'Dept', render: (t) => DEPT_LABEL[t.group] ?? t.group }, { key: 'title', label: 'Designation' },
          { key: 'company', label: 'Company' }, { key: 'contract', label: 'Contract' }, { key: 'location', label: 'Location' },
          { key: 'start', label: 'Start', render: (t) => (t.start ? fmtDate(t.start) : String(t.startRaw ?? '—')) },
          { key: 'cost', label: 'Monthly Cost (AED)', num: true, render: (t) => (t.costMissing ? '—' : fmtInt(t.cost)) },
        ]} rows={tempList} />
      </Card>
    </Section>
  );
}
