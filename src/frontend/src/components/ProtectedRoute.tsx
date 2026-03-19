import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Clock, Lock, LogIn } from "lucide-react";
import { useEffect } from "react";

interface Props {
  children: React.ReactNode;
  requiredRole?: string;
}

export default function ProtectedRoute({ children, requiredRole }: Props) {
  const { user, isLoading, sessionExpired } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;
    if (!user && !sessionExpired) {
      navigate({ to: "/login" });
    }
  }, [user, isLoading, sessionExpired, navigate]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-muted-foreground font-mono">
            Authenticating...
          </span>
        </div>
      </div>
    );
  }

  // Session expired — show informative full-screen card
  if (sessionExpired) {
    return (
      <div className="flex h-screen items-center justify-center bg-background p-4">
        <div className="trading-card max-w-sm w-full p-8 flex flex-col items-center text-center gap-4">
          <div className="w-14 h-14 rounded-full bg-hold/10 border border-hold/30 flex items-center justify-center">
            <Clock className="w-7 h-7 text-hold" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground mb-1">
              Session Expired
            </h2>
            <p className="text-sm text-muted-foreground">
              Session expired. Please login again.
            </p>
          </div>
          <Button
            data-ocid="session_expired.login_button"
            onClick={() => navigate({ to: "/login" })}
            className="w-full gap-2"
          >
            <LogIn className="w-4 h-4" />
            Login Again
          </Button>
        </div>
      </div>
    );
  }

  if (!user) return null;

  // Role mismatch — show access denied (no silent redirect)
  if (requiredRole && user.role !== requiredRole) {
    return (
      <div className="flex h-screen items-center justify-center bg-background p-4">
        <div className="trading-card max-w-sm w-full p-8 flex flex-col items-center text-center gap-4">
          <div className="w-14 h-14 rounded-full bg-bear/10 border border-bear/30 flex items-center justify-center">
            <Lock className="w-7 h-7 text-bear" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground mb-1">
              Access denied.
            </h2>
            <p className="text-sm text-muted-foreground mb-3">
              Only users with the{" "}
              <span className="text-hold font-bold font-mono">
                {requiredRole}
              </span>{" "}
              role can access this page.
            </p>
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-muted/50 border border-border/40">
              <AlertTriangle className="w-3.5 h-3.5 text-hold" />
              <span className="text-xs font-mono text-muted-foreground">
                Your role:{" "}
                <span className="text-foreground font-bold">{user.role}</span>
              </span>
            </div>
          </div>
          <Button
            data-ocid="access_denied.back_button"
            variant="outline"
            onClick={() => navigate({ to: "/" })}
            className="w-full"
          >
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
