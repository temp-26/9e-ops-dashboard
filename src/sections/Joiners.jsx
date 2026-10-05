import { useState } from 'react';
import { GROUPS, projectedHires } from '../lib/model.js';
import { fmtDate } from '../lib/data.js';
import { Section, Card, Kpi, DetailTable, DataTable, Select, Toggle, Pill, fmtInt, fmtNum } from '../components/ui.jsx';
import { Bars, C } from '../components/charts.jsx';
import { useDrill } from '../components/drill.jsx';

const SHORT = { STR: 'Structures', 'Buss. Support': 'Buss Supp', 'Site Supervision': 'Site' };

export default function Joiners({ m }) {
  const [month, setMonth] = useState('all');
  const [ent, setEnt] = useState('all');
  const asOf = m.asOf;
  const open = useDrill();

  const ytd = m.joinersYtd;
  const dubai = ytd.filter((p) => p.entity === 'Dubai').length;
  const rows = ytd.filter((p) => (month === 'all' || p.start.getUTCMonth() === +month) && (ent === 'all' || p.entity === ent));
  const byDept = GROUPS.map((g) => ({
    name: SHORT[g] ?? g, g,
    Dubai: ytd.filter((p) => p.group === g && p.entity === 'Dubai').length,
    India: ytd.filter((p) => p.group === g && p.entity === 'India').length,
  })).filter((r) => r.Dubai + r.India > 0);
  const status = (p) => (!p.lwd ? <Pill tone="good">Active</Pill>
    : p.lwd > asOf ? <Pill tone="warn">Notice · {fmtDate(p.lwd)}</Pill> : <Pill tone="muted">Left {fmtDate(p.lwd)}</Pill>);
  const statusText = (p) => (!p.lwd ? 'Active' : p.lwd > asOf ? 'Notice' : 'Left');
  const stillHere = ytd.filter((p) => !p.lwd || p.lwd > asOf).length;

  const blocks = projectedHires();
  const items = blocks.flatMap((b) => b.items);
  const totalOpen = items.reduce((s, i) => s + i.openings, 0);
  const sumLoc = (re) => items.filter((i) => re.test(i.location) && !/\//.test(i.location)).reduce((s, i) => s + i.openings, 0);
  const either = items.filter((i) => /\//.test(i.location)).reduce((s, i) => s + i.openings, 0);

  const cols = [
    { key: 'payroll', label: 'Payroll No.' }, { key: 'name', label: 'Employee Name' },
    { key: 'entity', label: 'Entity' }, { key: 'location', label: 'Location' }, { key: 'dept', label: 'Department' },
    { key: 'title', label: 'Designation' }, { key: 'gender', label: 'Gender' },
    { key: 'start', label: 'Start Date', render: (p) => fmtDate(p.start), text: (p) => fmtDate(p.start) },
    { key: 'status', label: 'Status', render: status, text: statusText },
  ];

  return (
    <Section eyebrow={`As of ${fmtDate(asOf)}`} title="New Joiners">
      <div className="kpis">
        <Kpi accent label="Avg new joiners / month" value={fmtNum(m.avgJoiners.avg, 1)} sub={`${m.avgJoiners.count} joiners ÷ ${m.avgJoiners.months} months (Jan–${m.months.at(-1).label.slice(0, 3)} ${m.year})`} onClick={() => open(`New joiners in ${m.year}`, ytd, 'people')} />
        <Kpi label={`Joined in ${m.year}`} value={fmtInt(ytd.length)} sub={`${stillHere} still with us`} onClick={() => open(`New joiners in ${m.year}`, ytd, 'people')} />
        <Kpi label="Dubai" value={fmtInt(dubai)} onClick={() => open(`New joiners in ${m.year} – Dubai`, ytd.filter((p) => p.entity === 'Dubai'), 'people')} />
        <Kpi label="India" value={fmtInt(ytd.length - dubai)} onClick={() => open(`New joiners in ${m.year} – India`, ytd.filter((p) => p.entity === 'India'), 'people')} />
        <Kpi label="Joining later" value={fmtInt(m.joiningLater.length)} sub="Start date after as-of or TBC" onClick={() => open('Joining later', m.joiningLater, 'people')} />
      </div>

      <div className="grid-1-1">
        <Card title="New joiners by month" eyebrow={`${m.year} to date`}>
          <Bars data={m.flow.map((f, i) => ({ name: f.label.slice(0, 3), Joiners: f.Joiners, mo: m.months[i] }))} cat="name"
            onBarClick={(row) => open(`New joiners – ${row.mo.label}`, ytd.filter((p) => p.start.getUTCMonth() === row.mo.m), 'people')}
            series={[{ key: 'Joiners', label: 'Joiners', color: C.red }]} height={260} />
          <p className="muted small">Average {fmtNum(m.avgJoiners.avg, 1)} a month.</p>
        </Card>
        <Card title="New joiners by department" eyebrow={`${m.year} to date`}>
          <Bars horizontal catWidth={90} data={byDept} cat="name" stacked
            onBarClick={(row, key) => open(`New joiners – ${row.name} · ${key}`, ytd.filter((p) => p.group === row.g && p.entity === key), 'people')}
            series={[{ key: 'Dubai', label: 'Dubai', color: C.red }, { key: 'India', label: 'India', color: C.grey4 }]} height={260} />
        </Card>
      </div>

      <Card title="New joiner details" eyebrow={`Started 01-Jan-${m.year} to ${fmtDate(asOf)}`}>
        <DetailTable columns={cols} rows={rows} controls={<>
          <Select id="jm" label="Month" value={month} onChange={setMonth} options={[
            { value: 'all', label: 'All months' }, ...m.months.map((mo) => ({ value: String(mo.m), label: `${mo.label} (${ytd.filter((p) => p.start.getUTCMonth() === mo.m).length})` })),
          ]} />
          <Toggle label="Entity" value={ent} onChange={setEnt} options={[{ value: 'all', label: 'All' }, { value: 'Dubai', label: 'Dubai' }, { value: 'India', label: 'India' }]} />
        </>} />
      </Card>

      <Card title="Joining later" eyebrow="On the staff lists, start date after the as-of date or TBC">
        <DetailTable columns={cols.filter((c) => c.key !== 'status').map((c) => (c.key === 'start' ? { ...c, render: (p) => (p.start ? fmtDate(p.start) : String(p.startRaw ?? 'TBC')), text: (p) => (p.start ? fmtDate(p.start) : 'TBC') } : c))} rows={m.joiningLater} maxHeight={360} />
      </Card>

      <div className="section-head sub">
        <div className="eyebrow">Open positions</div>
        <h2>Projected Hires</h2>
      </div>
      <div className="kpis">
        <Kpi accent label="Total openings" value={fmtInt(totalOpen)} />
        <Kpi label="Dubai" value={fmtInt(sumLoc(/dubai/i))} />
        <Kpi label="India" value={fmtInt(sumLoc(/india|mumbai|kochi/i))} />
        {either > 0 && <Kpi label="India / Dubai" value={fmtInt(either)} />}
      </div>
      <div className="grid-3">
        {blocks.map((b) => (
          <Card key={b.title} title={b.title}>
            <DataTable dense columns={[
              { key: 'location', label: 'Location' }, { key: 'position', label: 'Position' }, { key: 'openings', label: '# of Openings', num: true },
            ]} rows={[...b.items, { location: '', position: 'Total', openings: b.total, _total: true }]} />
          </Card>
        ))}
      </div>
    </Section>
  );
}
