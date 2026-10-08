import { useEffect, useState } from 'react';
import enc from './data/data.enc.json';
import logo from './assets/9e-logo.png';
import { setRaw } from './lib/store.js';
import { deriveKey, decryptWithKey, exportKey, importKey } from './lib/crypto.js';
import { saveSession, readSession } from './lib/session.js';


export default function Gate() {
  const [App, setApp] = useState(null);
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);

  const openWith = async (key) => {
    const data = await decryptWithKey(key, enc);
    setRaw(data);
    const mod = await import('./App.jsx');
    setApp(() => mod.default);
  };

  useEffect(() => {
    const saved = readSession(enc.salt);
    if (!saved) { setChecking(false); return; }
    importKey(saved).then(openWith).catch(() => setChecking(false));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!pw) return;
    setBusy(true); setError('');
    try {
      const key = await deriveKey(pw, enc);
      await openWith(key);
      saveSession(await exportKey(key), enc.salt);
    } catch {
      setError('That password is not correct. Try again.');
      setBusy(false);
    }
  };

  if (App) return <App />;
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
        <button type="submit" className="gate-btn" disabled={busy || !pw}>{busy ? 'Unlocking…' : 'Unlock dashboard'}</button>
      </form>
    </div>
  );
}
