import { nationalityLabel } from '../lib/model.js';
import { fmtDate } from '../lib/data.js';
import { Section, Card, DataTable, ShowTable, fmtPct } from '../components/ui.jsx';
import { Bars, SplitBar, C } from '../components/charts.jsx';
import { useDrill } from '../components/drill.jsx';

const parts = (set) => [
  { label: 'Female', value: set.filter((p) => p.gender === 'Female').length, color: C.red },
  { label: 'Male', value: set.filter((p) => p.gender === 'Male').length, color: C.grey4 },
];

export default function People({ m }) {
  const ACTIVE = m.active;
  const open = useDrill();
  const uae = ACTIVE.filter((p) => p.country === 'UAE');
  const ind = ACTIVE.filter((p) => p.country === 'India');
  const remoteLocs = [...new Set(ind.map((p) => p.location))].filter((l) => !['Kochi', 'Mumbai'].includes(l));
  const locRows = [
    { name: 'Dubai', set: uae }, { name: 'Mumbai', set: ind.filter((p) => p.location === 'Mumbai') },
    { name: 'Kochi', set: ind.filter((p) => p.location === 'Kochi') },
    { name: 'Remote Staff', set: ind.filter((p) => remoteLocs.includes(p.location)) },
  ].map((r) => ({ name: r.name, set: r.set, Female: r.set.filter((p) => p.gender === 'Female').length, Male: r.set.filter((p) => p.gender === 'Male').length }));
  const noGender = ACTIVE.filter((p) => !p.gender).length;

  const nat = {};
  uae.forEach((p) => { const k = nationalityLabel(p.nationality); nat[k] = (nat[k] || 0) + 1; });
  const natRows = Object.entries(nat).map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n);

  return (
    <Section eyebrow={`As of ${fmtDate(m.asOf)}`} title="Gender Analysis" subtitle="Permanent staff on board">
      <div className="grid-1-1">
        <Card title="Gender Analysis - UAE & India" eyebrow="By location">
          <Bars horizontal data={locRows} cat="name" catWidth={100} onBarClick={(row, key) => open(`${key} – ${row.name}`, row.set.filter((p) => p.gender === key), 'people')} series={[
            { key: 'Female', label: 'Female', color: C.red }, { key: 'Male', label: 'Male', color: C.grey4 },
          ]} height={300} />
          <p className="muted small">Remote Staff = India staff outside Kochi and Mumbai ({remoteLocs.join(', ')}).</p>
        </Card>
        <Card title="Split by entity">
          <SplitBar label="Gender Analysis - UAE + India" parts={parts(ACTIVE)} onPart={(p) => open(`${p.label} – UAE + India`, ACTIVE.filter((x) => x.gender === p.label), 'people')} />
          <SplitBar label="Gender Analysis - UAE" parts={parts(uae)} onPart={(p) => open(`${p.label} – UAE`, uae.filter((x) => x.gender === p.label), 'people')} />
          <SplitBar label="Gender Analysis - India" parts={parts(ind)} onPart={(p) => open(`${p.label} – India`, ind.filter((x) => x.gender === p.label), 'people')} />
          {noGender > 0 && <p className="muted small">{noGender} people have no gender recorded.</p>}
        </Card>
      </div>

      <div className="section-head sub">
        <div className="eyebrow">Dubai (UAE)</div>
        <h2>Nationality Analysis – UAE</h2>
      </div>
      <Card title="Nationality" eyebrow={`Dubai permanent staff · ${uae.length} people`}>
        <Bars horizontal data={natRows} cat="name" catWidth={130} onBarClick={(row) => open(`Nationality – ${row.name}`, uae.filter((p) => nationalityLabel(p.nationality) === row.name), 'people')} series={[{ key: 'n', label: 'Headcount', color: C.ink2 }]} height={Math.max(220, natRows.length * 30)} />
        <ShowTable>
          <DataTable dense columns={[{ key: 'name', label: 'Nationality' }, { key: 'n', label: 'Headcount', num: true }, { key: 'share', label: 'Share', num: true, render: (r) => fmtPct(r.n / uae.length, 1) }]} rows={natRows} />
        </ShowTable>
      </Card>
    </Section>
  );
}
