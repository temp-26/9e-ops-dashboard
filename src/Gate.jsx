import { useCallback, useEffect, useMemo, useState } from 'react';
import logo from './assets/9e-logo.png';
import App from './App.jsx';
import { AuthCtx } from './lib/auth.jsx';
import { signIn, loadWith, AccessError } from './lib/loader.js';
import { saveSession, readSession, lock } from './lib/session.js';
import { rebuild } from './lib/model.js';

export default function Gate() {
  const [pwKey, setPwKey] = useState(null);
  const [version, setVersion] = useState(0); // goes up on every (re)load so everything re-renders
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [showSalary, setShowSalary] = useState(false); // always hidden on first load
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(() => !!readSession());

  // Re-open an existing session in this tab (e.g. after the page was reloaded).
  useEffect(() => {
    const saved = readSession();
    if (!saved) return;
    let alive = true;
    (async () => {
      try {
        await loadWith(saved);
        if (!alive) return;
        setPwKey(saved);
        setLastRefreshed(new Date());
        setVersion((v) => v + 1);
      } catch (e) {
        if (alive) setError(e instanceof AccessError ? e.message : '');
      } finally {
        if (alive) setChecking(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!pw) return;
    setBusy(true); setError('');
    try {
      const r = await signIn(pw);
      saveSession(r.pwKey);
      setPwKey(r.pwKey);
      setLastRefreshed(new Date());
      setVersion((v) => v + 1);
      setPw('');
    } catch (err) {
      setError(err instanceof AccessError ? err.message : `Couldn't open the dashboard: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const refresh = useCallback(async () => {
    if (!pwKey) return { ok: false };
    try {
      await loadWith(pwKey);
      setLastRefreshed(new Date());
      setVersion((v) => v + 1);
      return { ok: true };
    } catch (err) {
      if (err instanceof AccessError) { lock(); }
      return { ok: false, message: err.message };
    }
  }, [pwKey]);

  // Midnight passed while the page was open: recalculate everything for the new day.
  const newDay = useCallback(() => { rebuild(); setVersion((v) => v + 1); }, []);

  const ctx = useMemo(() => (pwKey && version ? {
    version, showSalary, setShowSalary, refresh, lastRefreshed, newDay,
  } : null), [pwKey, version, showSalary, refresh, lastRefreshed, newDay]);

  if (ctx) return <AuthCtx.Provider value={ctx}><App /></AuthCtx.Provider>;
  if (checking) return <div className="gate"><p className="muted">Opening…</p></div>;

  return (
    <div className="gate">
      <form className="gate-card" onSubmit={submit}>
        <img src={logo} alt="9E Global" className="logo" />
        <div className="eyebrow">9E Global · People &amp; Culture</div>
        <h1>HR Workforce Intelligence</h1>
        <p className="muted">This dashboard holds confidential staff data. Enter the password to open it.</p>
        <label htmlFor="pw">Password</label>
        <input id="pw" type="password" autoFocus autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} disabled={busy} />
        {error && <p className="gate-error" role="alert">{error}</p>}
        <button type="submit" className="gate-btn" disabled={busy || !pw}>{busy ? 'Opening…' : 'Open dashboard'}</button>
      </form>
    </div>
  );
}
