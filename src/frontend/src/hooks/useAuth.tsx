import { useActor } from "@/hooks/useActor";
import { AuthService } from "@/services/AuthService";
import { createContext, useContext, useEffect, useState } from "react";

export interface AuthUser {
  name: string;
  email: string;
  phone: string;
  role: string;
  token: string;
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  sessionExpired: boolean;
}

interface AuthContextValue extends AuthState {
  login: (
    token: string,
    role: string,
    name: string,
    email?: string,
    phone?: string,
  ) => void;
  logout: () => Promise<void>;
}

export const SESSION_KEY = "alpha_session";
export const ADMIN_EMAIL = "prakash.brjn01@gmail.com";
const ADMIN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const USER_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;

const AuthContext = createContext<AuthContextValue | null>(null);

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function AuthProviderInner({ children }: { children: React.ReactNode }) {
  const { actor } = useActor();
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    sessionExpired: false,
  });

  useEffect(() => {
    if (!actor) return;
    const init = async () => {
      try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (!raw) {
          setState({ user: null, isLoading: false, sessionExpired: false });
          return;
        }
        const session = JSON.parse(raw) as {
          token: string;
          role: string;
          name: string;
          expiresAt: number;
        };

        if (Date.now() > session.expiresAt) {
          localStorage.removeItem(SESSION_KEY);
          setState({ user: null, isLoading: false, sessionExpired: true });
          return;
        }

        try {
          const service = new AuthService(actor);
          const { name, role, email, phone } = await service.validateSession(
            session.token,
          );
          // Enforce admin email on session restore as a second layer
          const effectiveRole = email === ADMIN_EMAIL ? "admin" : role;
          setState({
            user: {
              token: session.token,
              name,
              role: effectiveRole,
              email,
              phone,
            },
            isLoading: false,
            sessionExpired: false,
          });
        } catch {
          localStorage.removeItem(SESSION_KEY);
          setState({ user: null, isLoading: false, sessionExpired: false });
        }
      } catch {
        localStorage.removeItem(SESSION_KEY);
        setState({ user: null, isLoading: false, sessionExpired: false });
      }
    };
    init();
  }, [actor]);

  // Auto-refresh session token every 24 hours
  useEffect(() => {
    const interval = setInterval(() => {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return;
      try {
        const session = JSON.parse(raw);
        if (Date.now() > session.expiresAt) {
          // Expired - clear and mark expired
          localStorage.removeItem(SESSION_KEY);
          setState((prev) => ({ ...prev, user: null, sessionExpired: true }));
          return;
        }
        // Refresh: extend expiry based on role
        const ttl = session.role === "admin" ? ADMIN_TTL_MS : USER_TTL_MS;
        const refreshed = { ...session, expiresAt: Date.now() + ttl };
        localStorage.setItem(SESSION_KEY, JSON.stringify(refreshed));
      } catch {
        // ignore
      }
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const login = (
    token: string,
    role: string,
    name: string,
    email = "",
    phone = "",
  ) => {
    // Always enforce admin role for the admin email — dual-layer security
    const effectiveRole = email === ADMIN_EMAIL ? "admin" : role;
    const ttl = effectiveRole === "admin" ? ADMIN_TTL_MS : USER_TTL_MS;
    const session = {
      token,
      role: effectiveRole,
      name,
      expiresAt: Date.now() + ttl,
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    setState({
      user: { token, role: effectiveRole, name, email, phone },
      isLoading: false,
      sessionExpired: false,
    });
  };

  const logout = async () => {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw && actor) {
      try {
        const { token } = JSON.parse(raw);
        const service = new AuthService(actor);
        await service.logout(token);
      } catch {}
    }
    localStorage.removeItem(SESSION_KEY);
    setState({ user: null, isLoading: false, sessionExpired: false });
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <AuthProviderInner>{children}</AuthProviderInner>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
