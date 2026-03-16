import { useActor } from "@/hooks/useActor";
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

const SESSION_KEY = "alpha_session";
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

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
  });

  useEffect(() => {
    if (!actor) return;
    const init = async () => {
      try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (!raw) {
          setState({ user: null, isLoading: false });
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
          setState({ user: null, isLoading: false });
          return;
        }

        const result = await actor.validateSession(session.token);
        if (result.__kind__ === "ok") {
          const { name, role, email, phone } = result.ok;
          setState({
            user: { token: session.token, name, role, email, phone },
            isLoading: false,
          });
        } else {
          localStorage.removeItem(SESSION_KEY);
          setState({ user: null, isLoading: false });
        }
      } catch {
        localStorage.removeItem(SESSION_KEY);
        setState({ user: null, isLoading: false });
      }
    };
    init();
  }, [actor]);

  const login = (
    token: string,
    role: string,
    name: string,
    email = "",
    phone = "",
  ) => {
    const session = {
      token,
      role,
      name,
      expiresAt: Date.now() + SESSION_TTL_MS,
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    setState({ user: { token, role, name, email, phone }, isLoading: false });
  };

  const logout = async () => {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw && actor) {
      try {
        const { token } = JSON.parse(raw);
        await actor.logoutSession(token);
      } catch {}
    }
    localStorage.removeItem(SESSION_KEY);
    setState({ user: null, isLoading: false });
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
