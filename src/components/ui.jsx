import { useMemo, useState } from 'react';

export const fmtInt = (n) => (n === null || n === undefined || Number.isNaN(n) ? '—' : Math.round(n).toLocaleString('en-US'));
export const fmtNum = (n, d = 1) => (n === null || n === undefined ? '—' : n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }));
export const fmtAed = (n) => (n === null || n === undefined ? '—' : `AED ${fmtInt(n)}`);
export const fmtPct = (n, d = 0) => (n === null || n === undefined || !Number.isFinite(n) ? '—' : `${(n * 100).toFixed(d)}%`);
export const fmtCompact = (n) => {
  const a = Math.abs(n);
  if (a >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return String(Math.round(n));
};

export function Section({ id, eyebrow, title, subtitle, children }) {
  return (
    <section className="section" id={id}>
      <header className="section-head">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h2>{title}</h2>
        {subtitle && <p className="muted">{subtitle}</p>}
      </header>
      {children}
    </section>
  );
}

export function Card({ title, eyebrow, aside, children, className = '' }) {
  return (
    <div className={`card ${className}`}>
      {(title || aside) && (
        <div className="card-head">
          <div>
            {eyebrow && <div className="eyebrow">{eyebrow}</div>}
            {title && <h3>{title}</h3>}
          </div>
          {aside}
        </div>
      )}
      {children}
    </div>
  );
}

export function Kpi({ label, value, sub, accent, onClick }) {
  const body = (
    <>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
      {onClick && <div className="kpi-more">View list →</div>}
    </>
  );
  return onClick
    ? <button type="button" className={`kpi kpi-click ${accent ? 'kpi-accent' : ''}`} onClick={onClick}>{body}</button>
    : <div className={`kpi ${accent ? 'kpi-accent' : ''}`}>{body}</div>;
}


export function DataTable({ columns, rows, dense, maxHeight, footer }) {
  return (
    <div className="table-wrap" style={maxHeight ? { maxHeight } : undefined}>
      <table className={dense ? 'dense' : ''}>
        <thead>
          <tr>{columns.map((c) => <th key={c.key} className={c.num ? 'num' : ''}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={r._total ? 'total' : r._sub ? 'sub-row' : r._muted ? 'muted-row' : ''}>
              {columns.map((c) => (
                <td key={c.key} className={c.num ? 'num' : ''}>{c.render ? c.render(r) : r[c.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer && <tfoot>{footer}</tfoot>}
      </table>
    </div>
  );
}

export function Toggle({ options, value, onChange, label }) {
  return (
    <div className="toggle" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export function ShowTable({ children, label = 'Show data table' }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="show-table">
      <button className="link" onClick={() => setOpen(!open)}>{open ? 'Hide data table' : label}</button>
      {open && children}
    </div>
  );
}

export function Legend({ items }) {
  return (
    <ul className="legend">
      {items.map((i) => (
        <li key={i.label}><span className={`swatch ${i.hatch ? 'hatch' : ''}`} style={{ background: i.hatch ? undefined : i.color }} />{i.label}</li>
      ))}
    </ul>
  );
}

/** A searchable detail table with optional filter controls. */
export function DetailTable({ columns, rows, controls, maxHeight = 460, placeholder = 'Search name, department, title…', empty = 'No records for this selection.' }) {
  const [q, setQ] = useState('');
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((r) => columns.some((c) => String(c.text ? c.text(r) : r[c.key] ?? '').toLowerCase().includes(t)));
  }, [q, rows, columns]);
  return (
    <div className="detail">
      <div className="detail-bar">
        <input type="search" className="search" placeholder={placeholder} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search table" />
        {controls}
        <span className="muted count">{shown.length} of {rows.length}</span>
      </div>
      {shown.length ? <DataTable dense columns={columns} rows={shown} maxHeight={maxHeight} /> : <p className="muted small">{empty}</p>}
    </div>
  );
}

export function Select({ label, value, onChange, options, id }) {
  return (
    <label className="select-inline" htmlFor={id}>{label}
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

export function Pill({ tone = 'neutral', children }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

export const tenure = (start, end) => {
  if (!start || !end) return '—';
  const months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth()) - (end.getUTCDate() < start.getUTCDate() ? 1 : 0);
  if (months < 12) return `${Math.max(months, 0)} mo`;
  return `${Math.floor(months / 12)} yr ${months % 12} mo`;
};
