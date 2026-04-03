import { useCallback, useState } from "react";

const ADMIN_EMAIL = "prakash.brjn01@gmail.com";
const ADMIN_SECRET_KEY = "AlphaSignal2024!";
const SESSION_KEY = "alpha_admin_verified";

export function useAdminGate() {
  const [isAdminVerified, setIsAdminVerified] = useState<boolean>(() => {
    return sessionStorage.getItem(SESSION_KEY) === "true";
  });

  const verifyAdmin = useCallback(
    (email: string, secretKey: string): boolean => {
      const emailMatch =
        email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
      const keyMatch = secretKey === ADMIN_SECRET_KEY;
      if (emailMatch && keyMatch) {
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

  return { isAdminVerified, verifyAdmin, lockAdmin };
}
