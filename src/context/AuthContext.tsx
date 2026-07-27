import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { Session, Role } from '../types';
import * as api from '../services/api';
import { db } from '../lib/db';

interface AuthContextType {
  session: Session | null;
  loading: boolean;
  login: (email: string, password: string, remember?: boolean) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
  refresh: () => void;
  hasRole: (...roles: Role[]) => boolean;
  isAdmin: boolean;
  isHR: boolean;
  isManager: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const s = api.getCurrentSession();
    setSession(s);
    setLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string, remember = false) => {
    const res = await api.login(email, password, remember);
    if (res.success && res.data) {
      setSession(res.data);
    }
    return { success: res.success, message: res.message };
  }, []);

  // Auto-heal session.employeeId after login
  useEffect(() => {
    if (session?.employeeId) {
      // Trigger auto-heal by calling enrollFace with empty descriptor
      // This will update session.employeeId if there's a mismatch
      const employee = db.getEmployeeById(session.employeeId);
      if (!employee && session.email) {
        const empByEmail = db.getEmployees().find(e => e.email.toLowerCase() === session.email.toLowerCase());
        if (empByEmail) {
          console.log(`[AuthContext] Session employeeId mismatch: "${session.employeeId}" vs "${empByEmail.id}"`);
        }
      }
    }
  }, [session]);

  const logout = useCallback(async () => {
    await api.logout();
    setSession(null);
  }, []);

  const refresh = useCallback(() => {
    setSession(api.getCurrentSession());
  }, []);

  const hasRole = useCallback(
    (...roles: Role[]) => {
      if (!session) return false;
      if (session.role === 'Administrator') return true;
      return roles.includes(session.role);
    },
    [session]
  );

  return (
    <AuthContext.Provider
      value={{
        session,
        loading,
        login,
        logout,
        refresh,
        hasRole,
        isAdmin: session?.role === 'Administrator',
        isHR: session?.role === 'HR' || session?.role === 'Administrator',
        isManager: session?.role === 'Manager' || session?.role === 'Administrator',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
