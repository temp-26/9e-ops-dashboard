// Keeps this browser tab signed in (cleared when the tab closes or on Lock).
import { b64, unb64 } from './vault.js';
const KEY = '9e-dashboard-session';
export const saveSession = (pwKey) => { try { sessionStorage.setItem(KEY, b64(pwKey)); } catch { /* storage blocked */ } };
export const readSession = () => { try { const s = sessionStorage.getItem(KEY); return s ? unb64(s) : null; } catch { return null; } };
export const lock = () => { try { sessionStorage.removeItem(KEY); } catch { /* ignore */ } window.location.reload(); };
