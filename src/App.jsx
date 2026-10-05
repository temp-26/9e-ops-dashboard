import { useEffect, useState } from 'react';
import { EXCEL_AS_OF, makeModel } from './lib/model.js';
import { META, fmtDate } from './lib/data.js';
import logo from './assets/9e-logo.png';
import { DrillProvider } from './components/drill.jsx';
import { lock } from './lib/session.js';
import Overview from './sections/Overview.jsx';
import Headcount from './sections/Headcount.jsx';
import Joiners from './sections/Joiners.jsx';
import Leavers from './sections/Leavers.jsx';
import EngBim from './sections/EngBim.jsx';
import People from './sections/People.jsx';
import Salaries from './sections/Salaries.jsx';
import Cost from './sections/Cost.jsx';
import OrgChart from './sections/OrgChart.jsx';

const TABS = [
  { id: 'overview', label: 'Overview', C: Overview },
  { id: 'headcount', label: 'Headcount', C: Headcount },
  { id: 'joiners', label: 'New Joiners', C: Joiners },
  { id: 'leavers', label: 'Leavers', C: Leavers },
  { id: 'eng-bim', label: 'ENG vs BIM', C: EngBim },
  { id: 'gender', label: 'Gender & Nationality', C: People },
  { id: 'salaries', label: 'Salaries', C: Salaries },
  { id: 'cost', label: 'Cost Projection', C: Cost },
  { id: 'org', label: 'Org Chart', C: OrgChart },
];

const fromHash = () => {
  const h = window.location.hash.replace('#', '');
  return TABS.some((t) => t.id === h) ? h : 'overview';
};
const iso = (d) => d.toISOString().slice(0, 10);
const minDate = `${EXCEL_AS_OF.getUTCFullYear()}-01-01`;

export default function App() {
  const [tab, setTab] = useState(fromHash);
  const [asOfStr, setAsOfStr] = useState(iso(EXCEL_AS_OF));
  useEffect(() => {
    const on = () => setTab(fromHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  const parsed = new Date(`${asOfStr}T00:00:00Z`);
  const asOf = Number.isNaN(parsed.getTime()) ? EXCEL_AS_OF : new Date(Math.min(Math.max(parsed, new Date(`${minDate}T00:00:00Z`)), EXCEL_AS_OF));
  const m = makeModel(asOf);
  const Active = TABS.find((t) => t.id === tab).C;
  const isLatest = asOf.getTime() === EXCEL_AS_OF.getTime();

  return (
    <DrillProvider>
    <div className="app">
      <header className="top">
        <div className="top-inner">
          <div className="brand">
            <img src={logo} alt="9E Global" className="logo" />
            <div>
              <div className="eyebrow">People &amp; Culture · HR Dashboard</div>
              <h1>Operations Board Meeting</h1>
            </div>
          </div>
          <div className="asof">
            <label htmlFor="asof">As of date</label>
            <div className="asof-row">
              <input id="asof" type="date" value={iso(asOf)} min={minDate} max={iso(EXCEL_AS_OF)} onChange={(e) => e.target.value && setAsOfStr(e.target.value)} />
              {!isLatest && <button className="link" onClick={() => setAsOfStr(iso(EXCEL_AS_OF))}>Latest</button>}
              <button className="lock-btn" onClick={lock} title="Lock the dashboard">Lock</button>
            </div>
          </div>
        </div>
        <nav className="tabs" aria-label="Sections">
          {TABS.map((t) => (
            <a key={t.id} href={`#${t.id}`} className={t.id === tab ? 'on' : ''} aria-current={t.id === tab ? 'page' : undefined}>{t.label}</a>
          ))}
        </nav>
      </header>
      <main><Active m={m} /></main>
      <footer className="foot">
        <div className="foot-inner">
          <span><b>9E Global</b> &nbsp;|&nbsp; Engineering a Better World</span>
          <span>Data: {META.sourceFile} · as of {fmtDate(asOf)}</span>
        </div>
      </footer>
    </div>
    </DrillProvider>
  );
}
