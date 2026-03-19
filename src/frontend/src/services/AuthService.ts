import type { backendInterface } from "../backend";
import { hashPassword } from "../hooks/useAuth";

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;

export class AuthService {
  private actor: backendInterface;

  constructor(actor: backendInterface | null) {
    if (!actor)
      throw new Error("Authentication server unavailable. Please try again.");
    this.actor = actor;
  }

  /**
   * Retry with exponential backoff.
   * Delays: 1s, 2s, 4s, 8s (capped at MAX_RETRIES attempts)
   */
  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastErr: Error = new Error(
      "Authentication server unavailable. Please try again.",
    );
    for (let i = 0; i < MAX_RETRIES; i++) {
      try {
        return await fn();
      } catch (e) {
        lastErr =
          e instanceof Error
            ? e
            : new Error("Authentication server unavailable. Please try again.");
        if (i < MAX_RETRIES - 1) {
          const delay = BASE_DELAY_MS * 2 ** i;
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }
    throw lastErr;
  }

  async login(email: string, password: string) {
    return this.withRetry(async () => {
      const hash = await hashPassword(password);
      const result = await this.actor.loginWithEmail(email, hash);
      if (result.__kind__ === "ok") return result.ok;
      throw new Error(result.err);
    });
  }

  async register(name: string, email: string, phone: string, password: string) {
    return this.withRetry(async () => {
      const hash = await hashPassword(password);
      const result = await this.actor.registerUser(name, email, phone, hash);
      if (result.__kind__ === "ok") return result.ok;
      throw new Error(result.err);
    });
  }

  async logout(token: string) {
    try {
      await this.actor.logoutSession(token);
    } catch {
      // Silent logout is fine
    }
  }

  async requestOTP(phone: string) {
    return this.withRetry(async () => {
      const result = await this.actor.requestOTP(phone);
      if (result.__kind__ === "ok") return result.ok;
      throw new Error(result.err);
    });
  }

  async verifyOTP(phone: string, otp: string) {
    return this.withRetry(async () => {
      const result = await this.actor.verifyOTP(phone, otp);
      if (result.__kind__ === "ok") return result.ok;
      throw new Error(result.err);
    });
  }

  async validateSession(token: string) {
    return this.withRetry(async () => {
      const result = await this.actor.validateSession(token);
      if (result.__kind__ === "ok") return result.ok;
      throw new Error(result.err);
    });
  }
}
