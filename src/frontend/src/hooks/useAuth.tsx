import { createContext, useContext } from "react";

export interface AuthUser {
  name: string;
  email: string;
  phone: string;
  role: string;
  token: string;
}

interface AuthContextValue {
  user: AuthUser;
  isLoading: boolean;
  sessionExpired: boolean;
  login: () => void;
  logout: () => void;
}

const ADMIN_USER: AuthUser = {
  name: "Admin",
  email: "prakash.brjn01@gmail.com",
  phone: "",
  role: "admin",
  token: "no-auth",
};

export const SESSION_KEY = "alpha_session";
export const ADMIN_EMAIL = "prakash.brjn01@gmail.com";

const AuthContext = createContext<AuthContextValue>({
  user: ADMIN_USER,
  isLoading: false,
  sessionExpired: false,
  login: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <AuthContext.Provider
      value={{
        user: ADMIN_USER,
        isLoading: false,
        sessionExpired: false,
        login: () => {},
        logout: () => {},
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
