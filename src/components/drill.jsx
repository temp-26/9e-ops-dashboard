import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { fmtDate } from '../lib/data.js';
import { DetailTable, Pill, fmtInt, tenure } from './ui.jsx';

// ---- Click-through lists ("who are these people?") ------------------------
const DrillCtx = createContext(() => {});
export const useDrill = () => useContext(DrillCtx);

const d = (v) => (v ? fmtDate(v) : '—');
const startCell = (p) => (p.start ? fmtDate(p.start) : String(p.startRaw ?? 'TBC'));

// Column presets. `kind` decides which one a list uses.
const COLS = {
  people: [
    { key: 'payroll', label: 'Payroll No.' }, { key: 'name', label: 'Employee Name' },
    { key: 'entity', label: 'Entity' }, { key: 'location', label: 'Location' }, { key: 'dept', label: 'Department' },
    { key: 'title', label: 'Job Title' }, { key: 'gender', label: 'Gender', render: (p) => p.gender ?? '—' },
    { key: 'start', label: 'Start Date', render: startCell, text: startCell },
  ],
  leavers: [
    { key: 'payroll', label: 'Payroll No.' }, { key: 'name', label: 'Employee Name' },
    { key: 'entity', label: 'Entity' }, { key: 'dept', label: 'Department' }, { key: 'title', label: 'Job Title' },
    { key: 'start', label: 'Start Date', render: (p) => d(p.start), text: (p) => d(p.start) },
    { key: 'lwd', label: 'Last Working Day', render: (p) => (p.lwd ? fmtDate(p.lwd) : String(p.lwdRaw ?? '—')), text: (p) => d(p.lwd) },
    { key: 'tenure', label: 'Tenure', render: (p) => tenure(p.start, p.lwd), text: (p) => tenure(p.start, p.lwd) },
    { key: 'type', label: 'Type', render: (p) => <Pill tone={p.type === 'Termination' ? 'red' : 'muted'}>{p.type}</Pill>, text: (p) => p.type },
  ],
  temps: [
    { key: 'name', label: 'Name' }, { key: 'location', label: 'Location' }, { key: 'dept', label: 'Department' },
    { key: 'title', label: 'Designation' }, { key: 'company', label: 'Company' }, { key: 'contract', label: 'Contract' },
    { key: 'start', label: 'Start', render: startCell, text: startCell },
    { key: 'cost', label: 'Monthly Cost (AED)', num: true, render: (t) => (t.costMissing ? '—' : fmtInt(t.cost)) },
  ],
  mixed: [
    { key: 'kind', label: 'Type', render: (p) => <Pill tone={p.kind === 'Temp' ? 'muted' : 'good'}>{p.kind}</Pill>, text: (p) => p.kind },
    { key: 'name', label: 'Name' }, { key: 'location', label: 'Location' }, { key: 'dept', label: 'Department' },
    { key: 'title', label: 'Job Title' }, { key: 'start', label: 'Start Date', render: startCell, text: startCell },
  ],
  salary: [
    { key: 'payroll', label: 'Payroll No.' }, { key: 'name', label: 'Employee Name' }, { key: 'entity', label: 'Entity' },
    { key: 'dept', label: 'Department' }, { key: 'title', label: 'Job Title' },
    { key: 'amount', label: 'Monthly Salary (AED)', num: true, render: (p) => (p.amount === null || p.amount === undefined ? '—' : fmtInt(p.amount)) },
  ],
};

/** Mark FTE/temp for the "mixed" list. */
export const asMixed = (people = [], temps = []) => [
  ...people.map((p) => ({ ...p, kind: 'FTE' })),
  ...temps.map((t) => ({ ...t, kind: 'Temp', entity: t.country, payroll: '' })),
];

const PROFILE = [
  ['Payroll No.', 'payroll'], ['Entity', 'entity'], ['Location', 'location'], ['Department', 'dept'],
  ['Job Title', 'title'], ['Role', 'role'], ['Grade', 'grading'], ['Gender', 'gender'], ['Nationality', 'nationality'],
  ['Age', 'age'], ['Total experience (yrs)', 'exp'], ['Line manager', 'manager'], ['Company', 'company'], ['Contract', 'contract'],
];

function Profile({ p, onBack }) {
  const rows = PROFILE.filter(([, k]) => p[k] !== undefined && p[k] !== null && p[k] !== '');
  return (
    <div className="profile">
      <button className="link" onClick={onBack}>← Back to list</button>
      <h3>{p.name}</h3>
      <dl>
        {rows.map(([label, k]) => (
          <div key={k}><dt>{label}</dt><dd>{typeof p[k] === 'number' && k === 'exp' ? p[k].toFixed(1) : String(p[k])}</dd></div>
        ))}
        <div><dt>Start date</dt><dd>{startCell(p)}</dd></div>
        {p.lwd !== undefined && <div><dt>Last working day</dt><dd>{p.lwd ? fmtDate(p.lwd) : String(p.lwdRaw ?? '—')}</dd></div>}
        {p.type && <div><dt>Leaving type</dt><dd>{p.type}</dd></div>}
        {p.amount !== undefined && <div><dt>Monthly salary (AED)</dt><dd>{p.amount === null ? '—' : fmtInt(p.amount)}</dd></div>}
        {p.cost !== undefined && p.kind !== 'FTE' && p.entity !== 'Dubai' && p.entity !== 'India' && <div><dt>Monthly cost (AED)</dt><dd>{p.costMissing ? '—' : fmtInt(p.cost)}</dd></div>}
      </dl>
    </div>
  );
}

function Drawer({ view, onClose }) {
  const [person, setPerson] = useState(null);
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  if (!view) return null;
  const cols = (COLS[view.kind] ?? COLS.people).map((c, i) => (i === 1 || (view.kind === 'temps' && i === 0)
    ? { ...c, render: (r) => <button className="name-link" onClick={() => setPerson(r)}>{r.name}</button>, text: (r) => r.name }
    : c));
  return (
    <div className="drawer-back" onClick={onClose}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={view.title} onClick={(e) => e.stopPropagation()}>
        <header className="drawer-head">
          <div>
            {view.eyebrow && <div className="eyebrow">{view.eyebrow}</div>}
            <h2>{view.title}</h2>
            <p className="muted">{view.rows.length} {view.rows.length === 1 ? 'record' : 'records'}{view.note ? ` · ${view.note}` : ''}</p>
          </div>
          <button className="close" onClick={onClose} aria-label="Close">✕</button>
        </header>
        <div className="drawer-body">
          {person ? <Profile p={person} onBack={() => setPerson(null)} />
            : <DetailTable columns={cols} rows={view.rows} maxHeight="none" empty="Nobody in this group." />}
        </div>
      </aside>
    </div>
  );
}

export function DrillProvider({ children }) {
  const [view, setView] = useState(null);
  const open = useCallback((title, rows, kind = 'people', extra = {}) => setView({ title, rows, kind, ...extra, id: Date.now() }), []);
  const close = useCallback(() => setView(null), []);
  return (
    <DrillCtx.Provider value={open}>
      {children}
      <Drawer key={view?.id ?? 0} view={view} onClose={close} />
    </DrillCtx.Provider>
  );
}

/** A number that opens a list when clicked. */
export function Num({ rows, title, kind, extra, children, className = '' }) {
  const open = useDrill();
  if (!rows || !rows.length) return <span className={className}>{children}</span>;
  return <button className={`num-link ${className}`} onClick={() => open(title, rows, kind, extra)}>{children}</button>;
}
