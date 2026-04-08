import { useCallback, useState } from "react";

const ADMIN_EMAIL = "prakash.brjn01@gmail.com";
const STORAGE_KEY = "isAdmin";

const VALID_PASSWORDS = [
  "Admin@1166",
  "Admin@123",
  "AlphaSignal2024!",
  "AlphaSignal2026#",
];

export { ADMIN_EMAIL };

export function useAdminGate() {
  const [isAdminVerified, setIsAdminVerified] = useState<boolean>(() => {
    const val = localStorage.getItem(STORAGE_KEY);
    console.log("[Admin] Page load - isAdmin state:", val === "true");
    return val === "true";
  });

  const verifyAdmin = useCallback(
    (email: string, credential: string): boolean => {
      const emailMatch =
        email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
      const credentialMatch = VALID_PASSWORDS.includes(credential);
      if (emailMatch && credentialMatch) {
        localStorage.setItem(STORAGE_KEY, "true");
        setIsAdminVerified(true);
        console.log("[Admin] Login success - isAdmin set to true");
        return true;
      }
      console.log("[Admin] Login failed - invalid credentials");
      return false;
    },
    [],
  );

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setIsAdminVerified(false);
    console.log("[Admin] Logged out");
  }, []);

  // Legacy alias
  const lockAdmin = logout;

  return { isAdminVerified, verifyAdmin, logout, lockAdmin, ADMIN_EMAIL };
}
