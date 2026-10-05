import { useState } from 'react';
import { GROUPS } from '../lib/model.js';
import { fmtDate } from '../lib/data.js';
import { Section, Card, Kpi, DataTable, DetailTable, ShowTable, Select, Toggle, Pill, fmtInt, tenure } from '../components/ui.jsx';
import { Bars, C } from '../components/charts.jsx';
import { useDrill, Num } from '../components/drill.jsx';

const SHORT = { 'Buss. Support': 'Buss Supp', 'Site Supervision': 'Site', Infra: 'INFRA', Geotech: 'GEOTECH' };

export default function Leavers({ m }) {
  const [month, setMonth] = useState('all');
  const [ent, setEnt] = useState('all');
  const [type, setType] = useState('all');
  const ytd = m.leaversYtd;
  const open = useDrill();
  const res = ytd.filter((l) => l.type === 'Resignation').length;
  const groups = GROUPS.filter((g) => ytd.some((l) => l.group === g));
  const byLoc = ['Dubai', 'India'].map((loc) => {
    const o = { loc };
    groups.forEach((g) => { o[g] = ytd.filter((l) => l.entity === loc && l.group === g).length; });
    o.Total = ytd.filter((l) => l.entity === loc).length;
    return o;
  });
  const totalRow = { loc: 'Total', _total: true, Total: ytd.length };
  groups.forEach((g) => { totalRow[g] = ytd.filter((l) => l.group === g).length; });

  const rows = ytd.filter((l) => (month === 'all' || l.lwd.getUTCMonth() === +month) && (ent === 'all' || l.entity === ent) && (type === 'all' || l.type === type));
  const cols = [
    { key: 'payroll', label: 'Payroll No.' }, { key: 'name', label: 'Employee Name' },
    { key: 'entity', label: 'Entity' }, { key: 'location', label: 'Location' }, { key: 'dept', label: 'Department' },
    { key: 'title', label: 'Job Title' }, { key: 'gender', label: 'Gender', render: (l) => l.gender ?? '—' },
    { key: 'start', label: 'Start Date', render: (l) => fmtDate(l.start), text: (l) => fmtDate(l.start) },
    { key: 'lwd', label: 'Last Working Day', render: (l) => (l.lwd ? fmtDate(l.lwd) : String(l.lwdRaw ?? '—')), text: (l) => fmtDate(l.lwd) },
    { key: 'tenure', label: 'Tenure', render: (l) => tenure(l.start, l.lwd), text: (l) => tenure(l.start, l.lwd) },
    { key: 'type', label: 'Type', render: (l) => <Pill tone={l.type === 'Termination' ? 'red' : 'muted'}>{l.type}</Pill>, text: (l) => l.type },
  ];
  const other = [...m.leaversEarlier, ...m.leaversUndated];

  return (
    <Section eyebrow={`As of ${fmtDate(m.asOf)}`} title={`Leavers update Jan – ${m.months.at(-1).label.slice(0, 3)} ${m.year} - FTE`}>
      <div className="kpis">
        <Kpi label="Resignations" value={fmtInt(res)} onClick={() => open(`Resignations in ${m.year}`, ytd.filter((l) => l.type === 'Resignation'), 'leavers')} />
        <Kpi label="Terminations" value={fmtInt(ytd.length - res)} onClick={() => open(`Terminations in ${m.year}`, ytd.filter((l) => l.type === 'Termination'), 'leavers')} />
        <Kpi accent label="Total leavers" value={fmtInt(ytd.length)} sub={`Jan to ${fmtDate(m.asOf)}`} onClick={() => open(`Leavers in ${m.year}`, ytd, 'leavers')} />
        <Kpi label="Serving notice" value={fmtInt(m.servingNotice.length)} sub="Leaving after the as-of date" onClick={() => open('Serving notice', m.servingNotice, 'leavers')} />
      </div>
      <div className="grid-1-1">
        <Card title="Leavers by month">
          <Bars data={m.flow.map((f, i) => ({ name: f.label.slice(0, 3), Resignation: f.Resignation, Termination: f.Termination, mo: m.months[i] }))} cat="name" stacked
            onBarClick={(row, key) => open(`${key}s – ${row.mo.label}`, ytd.filter((l) => l.lwd.getUTCMonth() === row.mo.m && l.type === key), 'leavers')} series={[
            { key: 'Resignation', label: 'Resignation', color: C.grey4 }, { key: 'Termination', label: 'Termination', color: C.red },
          ]} height={290} />
        </Card>
        <Card title="By location and department">
          <DataTable columns={[{ key: 'loc', label: 'Location' },
            ...groups.map((g) => ({ key: g, label: SHORT[g] ?? g, num: true, render: (r) => <Num kind="leavers" rows={ytd.filter((l) => l.group === g && (r._total || l.entity === r.loc))} title={`Leavers – ${SHORT[g] ?? g} · ${r.loc}`}>{r[g]}</Num> })),
            { key: 'Total', label: 'Total', num: true, render: (r) => <Num kind="leavers" rows={ytd.filter((l) => r._total || l.entity === r.loc)} title={`Leavers – ${r.loc}`}>{r.Total}</Num> }]} rows={[...byLoc, totalRow]} />
          <p className="hint">Click any number to see the people.</p>
        </Card>
      </div>

      <Card title="Leaver details" eyebrow={`Last working day 01-Jan-${m.year} to ${fmtDate(m.asOf)}`}>
        <DetailTable columns={cols} rows={rows} controls={<>
          <Select id="lm" label="Month" value={month} onChange={setMonth} options={[
            { value: 'all', label: 'All months' }, ...m.months.map((mo) => ({ value: String(mo.m), label: `${mo.label} (${ytd.filter((l) => l.lwd.getUTCMonth() === mo.m).length})` })),
          ]} />
          <Toggle label="Entity" value={ent} onChange={setEnt} options={[{ value: 'all', label: 'All' }, { value: 'Dubai', label: 'Dubai' }, { value: 'India', label: 'India' }]} />
          <Toggle label="Type" value={type} onChange={setType} options={[{ value: 'all', label: 'All' }, { value: 'Resignation', label: 'Resigned' }, { value: 'Termination', label: 'Terminated' }]} />
        </>} />
      </Card>

      {m.servingNotice.length > 0 && (
        <Card title="Serving notice" eyebrow="Last working day after the as-of date">
          <DataTable dense columns={cols} rows={m.servingNotice} />
        </Card>
      )}

      {other.length > 0 && (
        <Card title={`Earlier leavers (before ${m.year}) and leavers with no last working day`}>
          <ShowTable label={`Show ${other.length} records`}>
            <DataTable dense columns={cols} rows={other} />
          </ShowTable>
        </Card>
      )}
    </Section>
  );
}
