import { useEffect, useState } from "react";

/**
 * Monitors authentication service availability.
 * Since auth is localStorage-based, the service is always
 * online. This hook provides the interface expected by LoginPage.
 */
export function useCanisterHealth() {
  const [isOnline, setIsOnline] = useState<boolean | null>(null);

  useEffect(() => {
    // Short delay to simulate a check, then mark online
    const timer = setTimeout(() => setIsOnline(true), 600);
    return () => clearTimeout(timer);
  }, []);

  return { isOnline };
}
