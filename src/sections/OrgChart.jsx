import { useState } from 'react';
import { GROUPS, GROUP_LONG } from '../lib/model.js';
import { fmtDate } from '../lib/data.js';
import { Section, Card, Toggle } from '../components/ui.jsx';
import { useDrill } from '../components/drill.jsx';

export default function OrgChart({ m }) {
  const ACTIVE = m.active;
  const open = useDrill();
  const [ent, setEnt] = useState('all');
  const people = ACTIVE.filter((p) => ent === 'all' || p.entity === ent);
  const directors = people.filter((p) => /director|management/i.test(p.role));
  return (
    <Section eyebrow={`As of ${fmtDate(m.asOf)}`} title="Organization Chart" subtitle="Active permanent staff by department and role level, highest grade first.">
      <div className="row-between">
        <Toggle label="Entity" value={ent} onChange={setEnt} options={[{ value: 'all', label: 'Dubai + India' }, { value: 'Dubai', label: 'Dubai' }, { value: 'India', label: 'India' }]} />
      </div>
      <Card title="Directors & Management" eyebrow="Operations leadership">
        <div className="org-people">
          {directors.sort((a, b) => (b.grading ?? 0) - (a.grading ?? 0)).map((p) => (
            <button type="button" className="org-person lead" key={p.payroll + p.name} onClick={() => open(p.name, [p], 'people')}><b>{p.name}</b><span>{p.title}</span></button>
          ))}
        </div>
      </Card>
      <div className="org-grid">
        {GROUPS.map((g) => {
          const set = people.filter((p) => p.group === g && !directors.includes(p));
          if (!set.length) return null;
          const roles = {};
          set.forEach((p) => { const k = p.role || p.title || 'Other'; (roles[k] ||= []).push(p); });
          const ordered = Object.entries(roles).sort((a, b) => Math.max(...b[1].map((p) => p.grading ?? 0)) - Math.max(...a[1].map((p) => p.grading ?? 0)));
          return (
            <Card key={g} title={<button className="name-link" onClick={() => open(GROUP_LONG[g], set, 'people')}>{GROUP_LONG[g]}</button>} eyebrow={`${set.length} ${set.length === 1 ? "person" : "people"}`} className="org-dept">
              {ordered.map(([role, ps]) => (
                <div className="org-role" key={role}>
                  <div className="org-role-name"><button className="name-link" onClick={() => open(`${GROUP_LONG[g]} – ${role}`, ps, 'people')}>{role}</button> <span className="muted">({ps.length})</span></div>
                  <div className="org-names">{ps.map((p) => <button type="button" key={p.payroll + p.name} title={`${p.title} · ${p.location}`} onClick={() => open(p.name, [p], 'people')}>{p.name}</button>)}</div>
                </div>
              ))}
            </Card>
          );
        })}
      </div>
    </Section>
  );
}
