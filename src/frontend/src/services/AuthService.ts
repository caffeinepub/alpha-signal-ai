import type { backendInterface } from "../backend";
import { hashPassword } from "../hooks/useAuth";

export class AuthService {
  private actor: backendInterface;

  constructor(actor: backendInterface | null) {
    if (!actor)
      throw new Error("Authentication server unavailable. Please try again.");
    this.actor = actor;
  }

  async login(email: string, password: string) {
    try {
      const hash = await hashPassword(password);
      const result = await this.actor.loginWithEmail(email, hash);
      if (result.__kind__ === "ok") return result.ok;
      throw new Error(result.err);
    } catch (e) {
      if (e instanceof Error) throw e;
      throw new Error("Authentication server unavailable. Please try again.");
    }
  }

  async register(name: string, email: string, phone: string, password: string) {
    try {
      const hash = await hashPassword(password);
      const result = await this.actor.registerUser(name, email, phone, hash);
      if (result.__kind__ === "ok") return result.ok;
      throw new Error(result.err);
    } catch (e) {
      if (e instanceof Error) throw e;
      throw new Error("Authentication server unavailable. Please try again.");
    }
  }

  async logout(token: string) {
    try {
      await this.actor.logoutSession(token);
    } catch {
      // Silent logout is fine
    }
  }

  async requestOTP(phone: string) {
    try {
      const result = await this.actor.requestOTP(phone);
      if (result.__kind__ === "ok") return result.ok;
      throw new Error(result.err);
    } catch (e) {
      if (e instanceof Error) throw e;
      throw new Error("Authentication server unavailable. Please try again.");
    }
  }

  async verifyOTP(phone: string, otp: string) {
    try {
      const result = await this.actor.verifyOTP(phone, otp);
      if (result.__kind__ === "ok") return result.ok;
      throw new Error(result.err);
    } catch (e) {
      if (e instanceof Error) throw e;
      throw new Error("Authentication server unavailable. Please try again.");
    }
  }

  async validateSession(token: string) {
    try {
      const result = await this.actor.validateSession(token);
      if (result.__kind__ === "ok") return result.ok;
      throw new Error(result.err);
    } catch (e) {
      if (e instanceof Error) throw e;
      throw new Error("Authentication server unavailable. Please try again.");
    }
  }
}
