import { useEffect, useState } from 'react';
import { EXCEL_AS_OF, makeModel, todayDate } from './lib/model.js';
import { META, fmtDate } from './lib/data.js';
import logo from './assets/9e-logo.png';
import { DrillProvider } from './components/drill.jsx';
import { lock } from './lib/session.js';
import { useAuth } from './lib/auth.jsx';
import Overview from './sections/Overview.jsx';
import Headcount from './sections/Headcount.jsx';
import Joiners from './sections/Joiners.jsx';
import Leavers from './sections/Leavers.jsx';
import EngBim from './sections/EngBim.jsx';
import People from './sections/People.jsx';
import Salaries from './sections/Salaries.jsx';
import OrgChart from './sections/OrgChart.jsx';

const TABS = [
  { id: 'overview', label: 'Overview', C: Overview },
  { id: 'headcount', label: 'Headcount', C: Headcount },
  { id: 'joiners', label: 'New Joiners', C: Joiners },
  { id: 'leavers', label: 'Leavers', C: Leavers },
  { id: 'eng-bim', label: 'ENG vs BIM', C: EngBim },
  { id: 'gender', label: 'Gender & Nationality', C: People },
  { id: 'salaries', label: 'Salaries', C: Salaries },
  { id: 'org', label: 'Org Chart', C: OrgChart },
];

const iso = (d) => d.toISOString().slice(0, 10);
const time = (d) => (d ? `${fmtDate(d)} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : '—');

export default function App() {
  const auth = useAuth();
  const tabs = TABS;
  const fromHash = () => {
    const raw = window.location.hash.replace('#', '');
    const h = raw === 'cost' ? 'salaries' : raw; // Cost Projection now sits at the bottom of Salaries
    return tabs.some((t) => t.id === h) ? h : 'overview';
  };
  const [tab, setTab] = useState(fromHash);
  useEffect(() => {
    const on = () => setTab(fromHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  });

  // The dashboard always shows TODAY (the viewer's computer date) unless a date is picked.
  // If the page stays open past midnight it moves on to the new day by itself.
  const TODAY = EXCEL_AS_OF; // = today, set when the data was (re)loaded
  const minDate = `${TODAY.getUTCFullYear()}-01-01`;
  const [picked, setPicked] = useState(null); // null = follow today
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState('');
  const { newDay } = auth;
  useEffect(() => {
    const id = setInterval(() => { if (todayDate().getTime() !== EXCEL_AS_OF.getTime()) newDay(); }, 60000);
    return () => clearInterval(id);
  }, [newDay]);

  const pick = (v) => {
    const d = new Date(`${v}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return;
    setPicked(d.getTime() >= TODAY.getTime() ? null : v);
  };
  const parsed = picked ? new Date(`${picked}T00:00:00Z`) : TODAY;
  const asOf = new Date(Math.min(Math.max(parsed, new Date(`${minDate}T00:00:00Z`)), TODAY));
  const m = makeModel(asOf);
  const current = tabs.find((t) => t.id === tab) ?? tabs[0];
  const Active = current.C;
  const isLatest = asOf.getTime() === TODAY.getTime();

  const doRefresh = async () => {
    setRefreshing(true); setRefreshMsg('');
    const r = await auth.refresh();
    setRefreshing(false);
    setRefreshMsg(r?.ok ? 'Updated' : `Couldn't refresh: ${r?.message ?? 'try again'}`);
    setTimeout(() => setRefreshMsg(''), 4000);
  };

  return (
    <DrillProvider>
    <div className="app">
      <header className="top">
        <div className="top-inner">
          <div className="brand">
            <img src={logo} alt="9E Global" className="logo" />
            <div>
              <div className="eyebrow">9E Global · People &amp; Culture</div>
              <h1>HR Workforce Intelligence</h1>
            </div>
          </div>
          <div className="header-tools">
            <div className="refresh">
              <button className="tool-btn" onClick={doRefresh} disabled={refreshing}>{refreshing ? 'Refreshing…' : '↻ Refresh data'}</button>
              <span className="muted small-inline">{refreshMsg || <>Last refreshed: <b>{time(auth.lastRefreshed)}</b></>}</span>
            </div>
            <label className={`salary-switch${auth.showSalary ? ' on' : ''}`} title="Salaries and costs are hidden (******) until you switch this on">
              <input type="checkbox" checked={auth.showSalary} onChange={(e) => auth.setShowSalary(e.target.checked)} />
              <span className="knob" aria-hidden="true" />
              <span>Show salary</span>
            </label>
            <div className="asof">
              <label htmlFor="asof">As of date</label>
              <div className="asof-row">
                <input id="asof" type="date" value={iso(asOf)} min={minDate} max={iso(TODAY)} onChange={(e) => e.target.value && pick(e.target.value)} />
                {!isLatest && <button className="link" onClick={() => setPicked(null)}>Today</button>}
              </div>
            </div>
            <button className="lock-btn" onClick={lock} title="Sign out and lock the dashboard">Lock</button>
          </div>
        </div>
        <nav className="tabs" aria-label="Sections">
          {tabs.map((t) => (
            <a key={t.id} href={`#${t.id}`} className={t.id === current.id ? 'on' : ''} aria-current={t.id === current.id ? 'page' : undefined}>{t.label}</a>
          ))}
        </nav>
      </header>
      <main><Active m={m} /></main>
      <footer className="foot">
        <div className="foot-inner">
          <span><b>9E Global</b> &nbsp;|&nbsp; Engineering a Better World</span>
          <span>Data: {META.sourceFile} · last updated {time(META.convertedAt ? new Date(META.convertedAt) : null)} · showing {fmtDate(asOf)}{isLatest ? ' (today)' : ''}</span>
        </div>
      </footer>
    </div>
    </DrillProvider>
  );
}
