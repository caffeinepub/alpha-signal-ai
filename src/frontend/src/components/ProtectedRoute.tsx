import { useAdminGate } from "@/hooks/useAdminGate";
import AdminGate from "./AdminGate";

interface Props {
  children: React.ReactNode;
  requiredRole?: string;
}

export default function ProtectedRoute({ children, requiredRole }: Props) {
  const { isAdminVerified } = useAdminGate();

  if (requiredRole === "admin" && !isAdminVerified) {
    return <AdminGate />;
  }

  return <>{children}</>;
}
