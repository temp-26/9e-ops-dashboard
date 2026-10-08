import { REDUCTION_DATE, SETTINGS } from '../lib/model.js';
import { fmtDate } from '../lib/data.js';
import { Section, Card, Kpi, DataTable, fmtInt, fmtAed, fmtNum, fmtPct } from '../components/ui.jsx';
import { SplitBar, Bars, C } from '../components/charts.jsx';
import { useDrill, Num, asMixed } from '../components/drill.jsx';

export default function Overview({ m }) {
  const s = m.summary();
  const open = useDrill();
  const at = `As of ${fmtDate(m.asOf)}`;
  const dub = m.active.filter((p) => p.entity === 'Dubai');
  const ind = m.active.filter((p) => p.entity === 'India');
  const sameD = (a, b) => a.trim().toLowerCase() === b.toLowerCase();
  const later = m.joiningLater;
  const tempsIn = (r) => m.activeTemps.filter((t) => r._total || sameD(t.dept, r.dept));
  const otherTempDepts = [...new Set(m.activeTemps.map((t) => t.dept.trim()))].filter((d) => !s.byDept.some((b) => sameD(d, b.dept)));
  const onFlow = (row, key) => {
    const mo = m.months.find((x) => x.label === row.name);
    if (!mo) return;
    if (key === 'Joiners') open(`New joiners – ${mo.label}`, m.joinersYtd.filter((p) => p.start.getUTCMonth() === mo.m), 'people');
    else open(`Leavers – ${mo.label}`, m.leaversYtd.filter((l) => l.lwd.getUTCMonth() === mo.m), 'leavers');
  };
  const act = s.dubai + s.india;
  return (
    <Section eyebrow={`As of ${fmtDate(m.asOf)}`} title="Workforce Overview"
      subtitle={`Dubai (UAE), India and temporary staff · Dubai salaries reflect the ${fmtDate(REDUCTION_DATE)} reduction · India in AED equivalent`}>
      <div className="kpis six">
        <Kpi accent label="Total active" value={fmtInt(s.total + s.temp)} sub={`${s.total} permanent + ${s.temp} temp staff`} onClick={() => open('All active staff (permanent + temp)', asMixed(m.active, m.activeTemps), 'mixed', { eyebrow: at })} />
        <Kpi label="Dubai (UAE)" value={fmtInt(s.dubai)} sub={`Permanent · +${s.joiningLaterDubai} future joiners`} onClick={() => open('Dubai (UAE) – permanent staff', dub, 'people', { eyebrow: at })} />
        <Kpi label="India" value={fmtInt(s.india)} sub={`Permanent · +${s.joiningLaterIndia} future joiners`} onClick={() => open('India – permanent staff', ind, 'people', { eyebrow: at })} />
        <Kpi label="Temp staff" value={fmtInt(s.temp)} sub="Active contract / temporary" onClick={() => open('Temp staff', m.activeTemps, 'temps', { eyebrow: at })} />
        <Kpi label="Active payroll" value={fmtInt(s.payroll)} sub="AED / month · permanent" onClick={() => open('Active payroll', m.active.map((p) => ({ ...p, amount: p.entity === 'Dubai' ? m.salary(p, m.asOf, 'salary') : p.salaryAed })), 'salary', { eyebrow: at })} />
      </div>
      <div className="kpis">
        <Kpi accent label="Avg new joiners / month" value={fmtNum(m.avgJoiners.avg, 1)} sub={`${m.avgJoiners.count} joiners in ${m.avgJoiners.months} months of ${m.year}`} onClick={() => open(`New joiners in ${m.year}`, m.joinersYtd, 'people')} />
        <Kpi label={`Joiners since Jan ${m.year} to date`} value={fmtInt(m.joinersYtd.length)} sub={`${m.joiningLater.length} future joiners`} onClick={() => open(`New joiners in ${m.year}`, m.joinersYtd, 'people')} />
        <Kpi label={`Leavers since Jan ${m.year} to date`} value={fmtInt(m.leaversYtd.length)} sub={`${m.leaversYtd.filter((l) => l.type === 'Resignation').length} resigned · ${m.leaversYtd.filter((l) => l.type === 'Termination').length} terminated`} onClick={() => open(`Leavers in ${m.year}`, m.leaversYtd, 'leavers')} />
        <Kpi label="Serving notice" value={fmtInt(m.servingNotice.length)} sub="Last working day after as-of date" onClick={() => open('Serving notice', m.servingNotice, 'leavers', { eyebrow: at })} />
        <Kpi label="Future joiners" value={fmtInt(later.length)} sub="Start date after as-of or TBC" onClick={() => open('Future joiners', later, 'people', { eyebrow: at })} />
      </div>

      <Card title="Joiners vs leavers by month" eyebrow={`${m.year} to date`}>
        <Bars data={m.flow.map((f) => ({ name: f.label, Joiners: f.Joiners, Leavers: f.Resignation + f.Termination }))} cat="name" onBarClick={onFlow}
          series={[{ key: 'Joiners', label: 'Joiners', color: C.red }, { key: 'Leavers', label: 'Leavers', color: C.grey4 }]} height={260} />
      </Card>

      <div className="grid-1-1">
        <Card title="Headcount by Department" eyebrow="Active (Dubai + India + Temp staff)">
          <DataTable dense columns={[
            { key: 'dept', label: 'Department' },
            { key: 'Dubai', label: 'Dubai', num: true, render: (r) => <Num rows={dub.filter((p) => r._total || sameD(p.dept, r.dept))} title={`${r._total ? 'All departments' : r.dept} – Dubai`}>{r.Dubai}</Num> },
            { key: 'India', label: 'India', num: true, render: (r) => <Num rows={ind.filter((p) => r._total || sameD(p.dept, r.dept))} title={`${r._total ? 'All departments' : r.dept} – India`}>{r.India}</Num> },
            { key: 'Temp', label: 'Temp Staff', num: true, render: (r) => <Num kind="temps" rows={tempsIn(r)} title={`${r._total ? 'All departments' : r.dept} – temp staff`}>{tempsIn(r).length}</Num> },
            { key: 'Total', label: 'Total', num: true, render: (r) => <Num kind="mixed" rows={asMixed(m.active.filter((p) => r._total || sameD(p.dept, r.dept)), tempsIn(r))} title={`${r._total ? 'All departments' : r.dept} – everyone`}>{r.Dubai + r.India + tempsIn(r).length}</Num> },
          ]} rows={[...s.byDept, ...otherTempDepts.map((d) => ({ dept: d, Dubai: 0, India: 0 })), { dept: 'Total', Dubai: s.dubai, India: s.india, _total: true }]} />
        </Card>
        <div className="stack">
          <Card title="Headcount by Location" eyebrow="Active">
            <DataTable dense columns={[
              { key: 'loc', label: 'Location' }, { key: 'n', label: 'Headcount', num: true, render: (r) => <Num rows={r.loc.startsWith('Dubai') ? dub : ind.filter((p) => p.location === r.loc)} title={`${r.loc} – permanent staff`}>{r.n}</Num> },
              { key: 'share', label: 'Share', num: true, render: (r) => fmtPct(act ? r.n / act : 0, 1) },
            ]} rows={s.byLocation.filter((r) => r.n > 0)} />
          </Card>
          <Card title="Gender Split" eyebrow="Active">
            <SplitBar label="Dubai + India" parts={[{ label: 'Female', value: s.female, color: C.red }, { label: 'Male', value: s.male, color: C.grey4 }]} onPart={(p) => open(`${p.label} – Dubai + India`, m.active.filter((x) => x.gender === p.label), 'people', { eyebrow: at })} />
          </Card>
        </div>
      </div>
      <div>
        <Card title="Workforce Metrics" eyebrow="Active">
          <div className="kpis three">
            <Kpi label="Average age (yrs)" value={fmtNum(s.avgAge, 1)} />
            <Kpi label="Avg total experience (yrs)" value={fmtNum(s.avgExp, 1)} />
            <Kpi label="Avg monthly salary" value={fmtAed(s.avgSalary)} />
          </div>
          <p className="muted small">INR converted at {SETTINGS.inrPerAed} per AED.</p>
        </Card>
      </div>
    </Section>
  );
}
