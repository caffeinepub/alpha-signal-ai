import { hashPassword } from "../hooks/useAuth";

const USERS_KEY = "alpha_users_db";
const BACKUP_KEY = "alpha_users_backup";
const LOG_KEY = "alpha_auth_log";
const ADMIN_EMAIL = "prakash.brjn01@gmail.com";
const ADMIN_PASSWORD = "admin123";

export interface StoredUser {
  id: number;
  name: string;
  email: string;
  phone: string;
  passwordHash: string;
  role: string;
  createdAt: number;
}

interface OtpEntry {
  phone: string;
  otp: string;
  expiresAt: number;
}

interface AuthLogEntry {
  type:
    | "user_created"
    | "login_attempt"
    | "login_success"
    | "login_failure"
    | "error";
  timestamp: number;
  detail: string;
}

// ─── Logging ────────────────────────────────────────────────────────────────

function writeLog(type: AuthLogEntry["type"], detail: string): void {
  try {
    const logs = getLogs();
    logs.push({ type, timestamp: Date.now(), detail });
    // Keep only last 200 entries
    const trimmed = logs.slice(-200);
    localStorage.setItem(LOG_KEY, JSON.stringify(trimmed));
  } catch {
    // never throw from logging
  }
}

export function getLogs(): AuthLogEntry[] {
  try {
    return JSON.parse(localStorage.getItem(LOG_KEY) || "[]") as AuthLogEntry[];
  } catch {
    return [];
  }
}

// ─── User DB helpers ─────────────────────────────────────────────────────────

function getUsers(): StoredUser[] {
  try {
    const data = localStorage.getItem(USERS_KEY);
    if (!data) {
      // Try to restore from backup
      const backup = localStorage.getItem(BACKUP_KEY);
      if (backup) {
        const restored = JSON.parse(backup) as StoredUser[];
        if (restored.length > 0) {
          localStorage.setItem(USERS_KEY, backup);
          writeLog("error", "Main DB was missing — restored from backup");
          return restored;
        }
      }
      return [];
    }
    return JSON.parse(data) as StoredUser[];
  } catch {
    // Attempt recovery from backup
    try {
      const backup = localStorage.getItem(BACKUP_KEY);
      if (backup) {
        const restored = JSON.parse(backup) as StoredUser[];
        if (restored.length > 0) {
          localStorage.setItem(USERS_KEY, backup);
          writeLog("error", "DB corrupted — restored from backup");
          return restored;
        }
      }
    } catch {
      /* ignore */
    }
    return [];
  }
}

function saveUsers(users: StoredUser[]): void {
  const json = JSON.stringify(users);
  localStorage.setItem(USERS_KEY, json);
  // Always keep an up-to-date backup
  localStorage.setItem(BACKUP_KEY, json);
}

function encodeToken(user: StoredUser): string {
  return btoa(
    JSON.stringify({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
    }),
  );
}

function decodeToken(token: string): {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: string;
} | null {
  try {
    return JSON.parse(atob(token)) as {
      id: number;
      name: string;
      email: string;
      phone: string;
      role: string;
    };
  } catch {
    return null;
  }
}

// ─── Admin seeding ───────────────────────────────────────────────────────────

/**
 * Ensures the permanent admin account always exists in localStorage.
 * Called once at app startup. Safe to call multiple times.
 */
export async function ensureAdminExists(): Promise<void> {
  try {
    const users = getUsers();
    const existing = users.find(
      (u) => u.email.toLowerCase() === ADMIN_EMAIL.toLowerCase(),
    );
    if (existing) {
      // Make sure role is correct and password is up to date
      const hash = await hashPassword(ADMIN_PASSWORD);
      let changed = false;
      if (existing.role !== "admin") {
        existing.role = "admin";
        changed = true;
      }
      if (existing.passwordHash !== hash) {
        existing.passwordHash = hash;
        changed = true;
      }
      if (changed) {
        saveUsers(users);
        writeLog(
          "user_created",
          "Admin account corrected (role/password updated)",
        );
      }
      return;
    }
    // Admin does not exist — create it
    const hash = await hashPassword(ADMIN_PASSWORD);
    const admin: StoredUser = {
      id: 1,
      name: "Admin",
      email: ADMIN_EMAIL,
      phone: "",
      passwordHash: hash,
      role: "admin",
      createdAt: Date.now(),
    };
    users.unshift(admin); // keep admin at index 0
    saveUsers(users);
    writeLog("user_created", `Admin account seeded: ${ADMIN_EMAIL}`);
  } catch (err) {
    writeLog("error", `ensureAdminExists failed: ${String(err)}`);
  }
}

// ─── AuthService ─────────────────────────────────────────────────────────────

export class AuthService {
  private _unused: unknown;
  constructor(actor?: unknown) {
    this._unused = actor;
  }

  async login(
    email: string,
    password: string,
  ): Promise<{
    token: string;
    role: string;
    name: string;
    email: string;
    phone: string;
  }> {
    writeLog("login_attempt", `Login attempt: ${email}`);
    // Ensure admin always exists before any login attempt
    await ensureAdminExists();

    const hash = await hashPassword(password);
    const users = getUsers();
    const byEmail = users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase(),
    );

    if (!byEmail) {
      writeLog("login_failure", `User not found: ${email}`);
      throw Object.assign(new Error("No account found with this email."), {
        code: "USER_NOT_FOUND",
      });
    }

    if (byEmail.passwordHash !== hash) {
      writeLog("login_failure", `Wrong password for: ${email}`);
      throw Object.assign(new Error("Incorrect password."), {
        code: "WRONG_PASSWORD",
      });
    }

    // Always enforce admin role for admin email
    if (
      byEmail.email.toLowerCase() === ADMIN_EMAIL.toLowerCase() &&
      byEmail.role !== "admin"
    ) {
      byEmail.role = "admin";
      saveUsers(users);
    }

    writeLog("login_success", `Login success: ${email} (${byEmail.role})`);
    return {
      token: encodeToken(byEmail),
      role: byEmail.role,
      name: byEmail.name,
      email: byEmail.email,
      phone: byEmail.phone,
    };
  }

  async register(
    name: string,
    email: string,
    phone: string,
    password: string,
  ): Promise<{
    token: string;
    role: string;
    name: string;
    email: string;
    phone: string;
  }> {
    await ensureAdminExists();
    const hash = await hashPassword(password);
    const users = getUsers();
    if (users.find((u) => u.email.toLowerCase() === email.toLowerCase())) {
      throw new Error("An account with this email already exists.");
    }
    const role =
      email.toLowerCase() === ADMIN_EMAIL.toLowerCase() ? "admin" : "user";
    const newUser: StoredUser = {
      id: Date.now(),
      name,
      email,
      phone,
      passwordHash: hash,
      role,
      createdAt: Date.now(),
    };
    users.push(newUser);
    saveUsers(users);
    writeLog("user_created", `New user registered: ${email} (${role})`);
    return {
      token: encodeToken(newUser),
      role: newUser.role,
      name: newUser.name,
      email: newUser.email,
      phone: newUser.phone,
    };
  }

  async logout(_token: string): Promise<void> {
    // localStorage-based — token cleared by useAuth
  }

  async requestOTP(phone: string): Promise<string> {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const entry: OtpEntry = {
      phone,
      otp,
      expiresAt: Date.now() + 60_000,
    };
    localStorage.setItem(`alpha_otp_${phone}`, JSON.stringify(entry));
    writeLog("login_attempt", `OTP requested for phone: ${phone}`);
    return otp;
  }

  async verifyOTP(
    phone: string,
    otp: string,
  ): Promise<{
    token: string;
    role: string;
    name: string;
    email: string;
    phone: string;
  }> {
    const raw = localStorage.getItem(`alpha_otp_${phone}`);
    if (!raw) throw new Error("No OTP found. Please request a new one.");
    const entry = JSON.parse(raw) as OtpEntry;
    if (Date.now() > entry.expiresAt) {
      localStorage.removeItem(`alpha_otp_${phone}`);
      throw new Error("OTP has expired. Please request a new one.");
    }
    if (entry.otp !== otp) throw new Error("Invalid OTP.");
    localStorage.removeItem(`alpha_otp_${phone}`);

    const users = getUsers();
    let user = users.find((u) => u.phone === phone);
    if (!user) {
      user = {
        id: Date.now(),
        name: "User",
        email: "",
        phone,
        passwordHash: "",
        role: "user",
        createdAt: Date.now(),
      };
      users.push(user);
      saveUsers(users);
      writeLog("user_created", `New user via OTP phone: ${phone}`);
    }
    writeLog("login_success", `OTP login success: ${phone}`);
    return {
      token: encodeToken(user),
      role: user.role,
      name: user.name,
      email: user.email,
      phone: user.phone,
    };
  }

  async validateSession(token: string): Promise<{
    token: string;
    role: string;
    name: string;
    email: string;
    phone: string;
  }> {
    const decoded = decodeToken(token);
    if (!decoded) throw new Error("Session invalid.");
    // Enforce admin role on session validate as well
    const role =
      decoded.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()
        ? "admin"
        : decoded.role;
    return {
      token,
      role,
      name: decoded.name,
      email: decoded.email,
      phone: decoded.phone,
    };
  }
}
