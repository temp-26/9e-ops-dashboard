import { Num } from './drill.jsx';
import { C } from './charts.jsx';

/** Tiny trend line: area + 2px line, last point marked in 9E red. */
export function Sparkline({ values, width = 150, height = 34 }) {
  const n = values.length;
  if (!n) return null;
  const max = Math.max(...values), min = Math.min(...values);
  const span = max - min || 1;
  const pad = 4;
  const x = (i) => (n === 1 ? width / 2 : pad + (i * (width - pad * 2)) / (n - 1));
  const y = (v) => pad + (height - pad * 2) * (1 - (v - min) / span);
  const line = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L${x(n - 1).toFixed(1)},${height - 1} L${x(0).toFixed(1)},${height - 1} Z`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Trend from ${values[0]} to ${values[n - 1]}`}>
      <path d={area} fill="rgba(17,17,17,0.06)" />
      <path d={line} fill="none" stroke={C.ink2} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(n - 1)} cy={y(values[n - 1])} r="3.5" fill={C.red} stroke="#fff" strokeWidth="1.5" />
    </svg>
  );
}

/**
 * Department list: name · trend · first month · latest · change, with a bar
 * showing each department's size relative to the largest.
 */
export function DeptTrend({ rows, keys, labels = {}, fmt, firstLabel, lastLabel, totalKey = 'Total', neutral = false, onRow, masked = false }) {
  if (masked) fmt = () => '******';
  const items = keys.map((k) => {
    const vals = rows.map((r) => r[k] || 0);
    return { k, vals, first: vals[0], last: vals[vals.length - 1] };
  }).filter((i) => i.vals.some((v) => v)).sort((a, b) => b.last - a.last);
  const max = Math.max(1, ...items.map((i) => i.last));
  const tv = rows.map((r) => r[totalKey] || 0);
  const total = { k: totalKey, vals: tv, first: tv[0], last: tv[tv.length - 1] };
  const change = (i) => {
    const d = i.last - i.first;
    const pct = i.first ? d / i.first : null;
    const cls = neutral ? 'flat-ink' : d > 0 ? 'up' : d < 0 ? 'down' : 'flat';
    return (
      <span className={`chg ${cls}`}>
        {masked ? '******' : <>{d > 0 ? '▲' : d < 0 ? '▼' : '–'} {fmt(Math.abs(d))}{pct !== null && d !== 0 ? <small> ({Math.round(Math.abs(pct) * 100)}%)</small> : null}</>}
      </span>
    );
  };
  return (
    <div className="table-wrap">
      <table className="trend-table">
        <thead>
          <tr>
            <th>Department</th><th>Trend</th><th className="num">{firstLabel}</th>
            <th className="num">{lastLabel}</th><th className="num">Change</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.k}>
              <td className="dept-cell">{onRow ? <button className="name-link" onClick={() => onRow(i.k)}>{labels[i.k] ?? i.k}</button> : (labels[i.k] ?? i.k)}</td>
              <td className="spark-cell">{masked ? <span className="muted">hidden</span> : <Sparkline values={i.vals} />}</td>
              <td className="num muted">{fmt(i.first)}</td>
              <td className="num now-cell">
                {!masked && <span className="now-bar" style={{ width: `${(i.last / max) * 100}%` }} />}
                <b>{fmt(i.last)}</b>
              </td>
              <td className="num">{change(i)}</td>
            </tr>
          ))}
          <tr className="total">
            <td>Total</td>
            <td className="spark-cell">{masked ? <span className="muted">hidden</span> : <Sparkline values={total.vals} />}</td>
            <td className="num">{fmt(total.first)}</td>
            <td className="num">{fmt(total.last)}</td>
            <td className="num">{change(total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/**
 * Headcount bridge from 1 January: opening + joined − left − serving notice = now.
 * Every number opens the list of people behind it.
 */
export function HeadcountBridge({ bridge, monthly, labels = {}, openLabel, nowLabel }) {
  const { rows, tempOpening, tempNow } = bridge;
  const showNotice = rows.some((r) => r.notice.length);
  const sum = (k) => rows.flatMap((r) => r[k]);
  const sorted = [...rows].sort((a, b) => b.now.length - a.now.length);
  const max = Math.max(1, ...rows.map((r) => r.now.length));
  const spark = (k) => monthly.map((m) => m[k] || 0);
  const net = (a, b) => {
    const d = b - a;
    return <span className={`chg ${d > 0 ? 'up' : d < 0 ? 'down' : 'flat'}`}>{d > 0 ? '▲' : d < 0 ? '▼' : '–'} {Math.abs(d)}{a && d ? <small> ({Math.round(Math.abs(d / a) * 100)}%)</small> : null}</span>;
  };
  const cell = (list, title, kind, sign = '') => (
    <Num rows={list} title={title} kind={kind}>{list.length ? `${sign}${list.length}` : '0'}</Num>
  );
  return (
    <div className="table-wrap">
      <table className="trend-table bridge">
        <thead>
          <tr>
            <th>Department</th><th>Trend</th>
            <th className="num">{openLabel}</th><th className="num">Joined</th><th className="num">Left</th>
            {showNotice && <th className="num">Serving notice</th>}
            <th className="num">{nowLabel}</th><th className="num">Net change</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const name = labels[r.group] ?? r.group;
            return (
              <tr key={r.group}>
                <td className="dept-cell">{name}</td>
                <td className="spark-cell"><Sparkline values={spark(r.group)} /></td>
                <td className="num muted">{cell(r.opening, `${name} – on board ${openLabel}`, 'people')}</td>
                <td className="num plus">{cell(r.joined, `${name} – joined since ${openLabel}`, 'people', '+')}</td>
                <td className="num minus">{cell(r.left, `${name} – left since ${openLabel}`, 'leavers', '−')}</td>
                {showNotice && <td className="num minus">{cell(r.notice, `${name} – serving notice`, 'leavers', '−')}</td>}
                <td className="num now-cell">
                  <span className="now-bar" style={{ width: `${(r.now.length / max) * 100}%` }} />
                  <b>{cell(r.now, `${name} – on board ${nowLabel}`, 'people')}</b>
                </td>
                <td className="num">{net(r.opening.length, r.now.length)}</td>
              </tr>
            );
          })}
          <tr className="total">
            <td>Total FTE</td>
            <td className="spark-cell"><Sparkline values={spark('FTE')} /></td>
            <td className="num">{cell(sum('opening'), `All FTE – on board ${openLabel}`, 'people')}</td>
            <td className="num plus">{cell(sum('joined'), `All joiners since ${openLabel}`, 'people', '+')}</td>
            <td className="num minus">{cell(sum('left'), `All leavers since ${openLabel}`, 'leavers', '−')}</td>
            {showNotice && <td className="num minus">{cell(sum('notice'), 'Serving notice', 'leavers', '−')}</td>}
            <td className="num">{cell(sum('now'), `All FTE – on board ${nowLabel}`, 'people')}</td>
            <td className="num">{net(sum('opening').length, sum('now').length)}</td>
          </tr>
          <tr>
            <td className="dept-cell">Temp Staff</td>
            <td className="spark-cell"><Sparkline values={spark('Temp Staff')} /></td>
            <td className="num muted">{cell(tempOpening, `Temp staff – on board ${openLabel}`, 'temps')}</td>
            <td className="num muted">—</td><td className="num muted">—</td>
            {showNotice && <td className="num muted">—</td>}
            <td className="num"><b>{cell(tempNow, `Temp staff – on board ${nowLabel}`, 'temps')}</b></td>
            <td className="num">{net(tempOpening.length, tempNow.length)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
