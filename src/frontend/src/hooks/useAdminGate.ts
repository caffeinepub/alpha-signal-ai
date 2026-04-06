import { useCallback, useState } from "react";

const ADMIN_EMAIL = "prakash.brjn01@gmail.com";
const ADMIN_PASSWORD = "Admin@123";
const ADMIN_SECRET_KEY = "AlphaSignal2024!";
const ADMIN_NEW_KEY = "AlphaSignal2026#";
const SESSION_KEY = "alpha_admin_verified";

export function useAdminGate() {
  const [isAdminVerified, setIsAdminVerified] = useState<boolean>(() => {
    return sessionStorage.getItem(SESSION_KEY) === "true";
  });

  // Supports password login, legacy secret key, and new 2026 key
  const verifyAdmin = useCallback(
    (email: string, credential: string): boolean => {
      const emailMatch =
        email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
      const credentialMatch =
        credential === ADMIN_PASSWORD ||
        credential === ADMIN_SECRET_KEY ||
        credential === ADMIN_NEW_KEY;
      if (emailMatch && credentialMatch) {
        sessionStorage.setItem(SESSION_KEY, "true");
        setIsAdminVerified(true);
        return true;
      }
      return false;
    },
    [],
  );

  const lockAdmin = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    setIsAdminVerified(false);
  }, []);

  return { isAdminVerified, verifyAdmin, lockAdmin, ADMIN_EMAIL };
}
