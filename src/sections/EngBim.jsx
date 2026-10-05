import { useState } from 'react';
import { fmtDate } from '../lib/data.js';
import { Section, Card, Kpi, DataTable, Toggle, fmtInt, fmtPct } from '../components/ui.jsx';
import { Bars, C } from '../components/charts.jsx';
import { useDrill, Num } from '../components/drill.jsx';

export default function EngBim({ m }) {
  const [site, setSite] = useState(false);
  const groups = m.engVsBim(site);
  const eng = groups.reduce((s, g) => s + g.eng, 0);
  const bim = groups.reduce((s, g) => s + g.bim, 0);
  const open = useDrill();
  const allEng = groups.flatMap((g) => g.engList); const allBim = groups.flatMap((g) => g.bimList);
  const label = (g) => ({ STR: 'Structures', Infra: 'Infra', 'Site Supervision': 'Site' }[g] ?? g);

  return (
    <Section eyebrow={`As of ${fmtDate(m.asOf)}`} title="ENG VS BIM DISTRIBUTION" subtitle="FTE + Temp staff on board">
      <div className="row-between">
        <div className="kpis">
          <Kpi accent label="Total" value={fmtInt(eng + bim)} onClick={() => open('Engineers + BIM', [...allEng, ...allBim], 'mixed')} />
          <Kpi label="Engineers" value={fmtInt(eng)} sub={fmtPct(eng / (eng + bim))} onClick={() => open('Engineers', allEng, 'mixed')} />
          <Kpi label="BIM" value={fmtInt(bim)} sub={fmtPct(bim / (eng + bim))} onClick={() => open('BIM', allBim, 'mixed')} />
        </div>
        <Toggle label="Site staff" value={site} onChange={setSite} options={[
          { value: false, label: 'Engineering disciplines' }, { value: true, label: 'Include Site Supervision' },
        ]} />
      </div>
      <div className="grid-1-1">
        <Card title="Engineer vs BIM by discipline">
          <Bars data={groups.map((g) => ({ name: label(g.group), Engineer: g.eng, BIM: g.bim, g }))} cat="name"
            onBarClick={(row, key) => open(`${row.name} – ${key === 'BIM' ? 'BIM' : 'Engineers'}`, key === 'BIM' ? row.g.bimList : row.g.engList, 'mixed')}
            series={[{ key: 'Engineer', label: 'Engineer', color: C.red }, { key: 'BIM', label: 'BIM', color: C.grey4 }]} height={320} />
        </Card>
        <div className="mini-tables">
          {groups.map((g) => (
            <Card key={g.group} className="mini">
              <DataTable dense columns={[
                { key: 'loc', label: label(g.group).toUpperCase() },
                { key: 'eng', label: 'ENG', num: true, render: (r) => (r.engList ? <Num kind="mixed" rows={r.engList} title={`${label(g.group)} · ${r.loc} – Engineers`}>{r.eng}</Num> : r.eng) },
                { key: 'bim', label: 'BIM', num: true, render: (r) => (r.bimList ? <Num kind="mixed" rows={r.bimList} title={`${label(g.group)} · ${r.loc} – BIM`}>{r.bim}</Num> : r.bim) },
                { key: 'total', label: 'TOTAL', num: true, render: (r) => (r.engList ? <Num kind="mixed" rows={[...r.engList, ...r.bimList]} title={`${label(g.group)} · ${r.loc}`}>{r.total}</Num> : r.total) },
              ]} rows={[
                ...g.rows.map((r) => ({ ...r, total: r.eng + r.bim })),
                { loc: 'Total', eng: g.eng, bim: g.bim, total: g.total, _total: true, engList: g.engList, bimList: g.bimList },
                { loc: '%', eng: fmtPct(g.eng / g.total), bim: fmtPct(g.bim / g.total), total: g.total ? '100%' : '—', _muted: true },
              ]} />
            </Card>
          ))}
        </div>
      </div>
    </Section>
  );
}
