import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LabelList,
} from 'recharts';
import { fmtInt, fmtCompact, Legend } from './ui.jsx';
import { useSalary } from '../lib/auth.jsx';

// Categorical colours (validated CVD-safe order) + brand neutrals.
export const C = {
  s1: '#2a78d6', s2: '#eb6834', s3: '#1baf7a', s4: '#eda100', s5: '#e87ba4', s6: '#008300', s7: '#4a3aa7',
  red: '#D6242F', ink: '#111111', ink2: '#3A3A3A', grey: '#7E7E7E', grey4: '#BFBFBF', grid: '#E8E8E8',
};

// Department series for monthly stacks. PM, AOR and Geotech are small, so they share
// one colour ("PM / AOR / Geotech") — the tooltip and data table still show each one.
export const DEPT_SERIES = [
  { key: 'STR', label: 'STR', color: C.s1 },
  { key: 'MEP', label: 'MEP', color: C.s2 },
  { key: 'Site Supervision', label: 'Site Supervision', color: C.s3 },
  { key: 'Buss. Support', label: 'Buss. Support', color: C.s4 },
  { key: 'Infra', label: 'Infra', color: C.s5 },
  { key: 'AVIT', label: 'AVIT', color: C.s6 },
  { key: 'Small', label: 'PM / AOR / Geotech', color: C.s7, parts: ['PM', 'AOR', 'Geotech'] },
];
export const TEMP_SERIES = { key: 'Temp Staff', label: 'Temp Staff', color: C.grey4, hatch: true };

export const withSmall = (rows) => rows.map((r) => ({ ...r, Small: (r.PM || 0) + (r.AOR || 0) + (r.Geotech || 0) }));

const axisProps = { tick: { fill: C.grey, fontSize: 12 }, axisLine: { stroke: C.grid }, tickLine: false };

function MonthTip({ active, payload, label, fmt, detailKeys, totalKey }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="tip">
      <div className="tip-title">{label}{row.partial ? ' · to as-of date' : ''}</div>
      {detailKeys.filter((k) => row[k]).map((k) => (
        <div className="tip-row" key={k}><span>{k}</span><b>{fmt(row[k])}</b></div>
      ))}
      <div className="tip-row tip-total"><span>Total</span><b>{fmt(row[totalKey])}</b></div>
      {row.missing ? <div className="tip-note">{row.missing} person(s) with no salary in Excel</div> : null}
    </div>
  );
}

/** Stacked monthly columns with the total printed on top. Projected months are faded. */
export function MonthlyStack({ data, series, totalKey = 'Total', detailKeys, money, height = 340 }) {
  const fmt = (v) => fmtInt(v);
  const { visible } = useSalary();
  if (money && !visible) return <SalaryHidden height={height} />; // money charts never draw while hidden
  // The total label sits on the highest non-empty segment of each column.
  const topKey = (row) => [...series].reverse().find((s) => row[s.key])?.key;
  return (
    <>
      <div className="chart" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 24, right: 8, left: 4, bottom: 0 }} barCategoryGap="22%">
            <defs>
              <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="6" height="6" fill="#E8E8E8" />
                <line x1="0" y1="0" x2="0" y2="6" stroke="#9a9a9a" strokeWidth="2" />
              </pattern>
            </defs>
            <CartesianGrid vertical={false} stroke={C.grid} />
            <XAxis dataKey="label" {...axisProps} />
            <YAxis {...axisProps} width={money ? 52 : 36} tickFormatter={money ? fmtCompact : undefined} />
            <Tooltip cursor={{ fill: 'rgba(17,17,17,0.04)' }} content={<MonthTip fmt={fmt} detailKeys={detailKeys} totalKey={totalKey} />} />
            {series.map((s) => (
              <Bar key={s.key} dataKey={s.key} stackId="a" fill={s.hatch ? 'url(#hatch)' : s.color} stroke="#fff" strokeWidth={1} isAnimationActive={false}>
                <LabelList dataKey="label" position="top" content={(p) => { const row = data.find((d) => d.label === p.value) ?? data[p.index]; return (!row || topKey(row) !== s.key ? null : (
                    <text x={p.x + p.width / 2} y={p.y - 6} textAnchor="middle" fontSize={11} fontWeight={600} fill={C.ink}>
                      {money ? fmtCompact(row[totalKey]) : fmtInt(row[totalKey])}
                    </text>
                  )); }} />
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <Legend items={[...series.map((s) => ({ label: s.label, color: s.color, hatch: s.hatch }))]} />
    </>
  );
}

function SimpleTip({ active, payload, label, fmt = fmtInt }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="tip">
      <div className="tip-title">{label}</div>
      {payload.map((p) => <div className="tip-row" key={p.dataKey}><span>{p.name}</span><b>{fmt(p.value)}</b></div>)}
    </div>
  );
}

/** Generic bar chart: grouped or stacked, vertical or horizontal. */
export function Bars({ data, cat, series, stacked, horizontal, height = 300, labels = true, catWidth = 120, money, onBarClick }) {
  const vfmt = money ? fmtCompact : fmtInt;
  const { visible } = useSalary();
  if (money && !visible) return <SalaryHidden height={height} />; // money charts never draw while hidden
  const topKey = (row) => [...series].reverse().find((x) => row[x.key])?.key;
  return (
    <>
      <div className="chart" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 20, right: 28, left: 4, bottom: 0 }} barCategoryGap="24%" barGap={2}>
            <CartesianGrid vertical={horizontal} horizontal={!horizontal} stroke={C.grid} />
            {horizontal ? (
              <>
                <XAxis type="number" {...axisProps} allowDecimals={false} tickFormatter={money ? fmtCompact : undefined} />
                <YAxis type="category" dataKey={cat} {...axisProps} width={catWidth} />
              </>
            ) : (
              <>
                <XAxis dataKey={cat} {...axisProps} interval={0} />
                <YAxis {...axisProps} width={money ? 52 : 32} allowDecimals={false} tickFormatter={money ? fmtCompact : undefined} />
              </>
            )}
            <Tooltip cursor={{ fill: 'rgba(17,17,17,0.04)' }} content={<SimpleTip />} />
            {series.map((s) => (
              <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} stackId={stacked ? 'a' : undefined}
                onClick={onBarClick ? (entry, idx) => onBarClick(data[idx] ?? entry?.payload, s.key) : undefined}
                style={onBarClick ? { cursor: 'pointer' } : undefined}
                stroke="#fff" strokeWidth={stacked ? 1 : 0} radius={stacked ? 0 : horizontal ? [0, 3, 3, 0] : [3, 3, 0, 0]} isAnimationActive={false}>
                {labels && (
                  <LabelList dataKey={cat} position={horizontal ? 'right' : 'top'} content={(p) => {
                    const row = data.find((d) => d[cat] === p.value) ?? data[p.index];
                    if (!row) return null;
                    if (stacked && topKey(row) !== s.key) return null;
                    const v = stacked ? series.reduce((a, x) => a + (row[x.key] || 0), 0) : row[s.key];
                    if (!v) return null;
                    const x = horizontal ? p.x + p.width + 5 : p.x + p.width / 2;
                    const y = horizontal ? p.y + p.height / 2 + 4 : p.y - 6;
                    return <text x={x} y={y} textAnchor={horizontal ? 'start' : 'middle'} fontSize={11} fontWeight={600} fill={C.ink}>{vfmt(v)}</text>;
                  }} />
                )}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      {series.length > 1 && <Legend items={series.map((s) => ({ label: s.label, color: s.color }))} />}
      {onBarClick && <p className="hint">Click a bar to see the people.</p>}
    </>
  );
}

/** 100% split bar (e.g. Female / Male) with counts and shares. */
export function SplitBar({ label, parts, onPart }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  return (
    <div className="split">
      <div className="split-head"><span>{label}</span><span className="muted">{fmtInt(total)} people</span></div>
      <div className="split-bar">
        {parts.map((p) => (
          <div key={p.label} style={{ width: `${total ? (p.value / total) * 100 : 0}%`, background: p.color, cursor: onPart ? 'pointer' : undefined }} title={`${p.label}: ${p.value}`} onClick={onPart ? () => onPart(p) : undefined} />
        ))}
      </div>
      <div className="split-legend">
        {parts.map((p) => (
          <span key={p.label}><i style={{ background: p.color }} />{p.label} {onPart ? <button className="num-link" onClick={() => onPart(p)}>{fmtInt(p.value)}</button> : <b>{fmtInt(p.value)}</b>} ({total ? Math.round((p.value / total) * 100) : 0}%)</span>
        ))}
      </div>
    </div>
  );
}

/** Shown instead of a pay chart while salaries are hidden (bar heights would give amounts away). */
export function SalaryHidden({ height = 280 }) {
  return (
    <div className="salary-hidden" style={{ height }}>
      <div><b>******</b><span>Salary figures are hidden. Switch on "Show salary" at the top of the page to see them.</span></div>
    </div>
  );
}
