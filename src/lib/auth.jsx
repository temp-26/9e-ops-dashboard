import { createContext, useContext } from 'react';
import { fmtInt } from '../components/ui.jsx';

export const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export const MASK = '******';

/** Salary visibility: hidden (******) until "Show salary" is switched on. Off on every load. */
export function useSalary() {
  const a = useAuth();
  const visible = !!a?.showSalary;
  return { visible, money: (v, f = fmtInt) => (visible ? f(v) : MASK) };
}
