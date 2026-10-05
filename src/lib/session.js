// Remembers the unlocked key for this browser tab only (cleared when the tab closes).
export const SESSION_KEY = '9e-dashboard-key';
export const saveSession = (k, salt) => { try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ k, salt })); } catch { /* storage blocked */ } };
export const readSession = (salt) => { try { const v = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); return v && v.salt === salt ? v.k : null; } catch { return null; } };
export const lock = () => { try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ } window.location.reload(); };
