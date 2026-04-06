import { useAdminGate } from "@/hooks/useAdminGate";
import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Eye, EyeOff, Shield, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export default function LoginPage() {
  const navigate = useNavigate();
  const { isAdminVerified, verifyAdmin } = useAdminGate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [shaking, setShaking] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [lockedSecondsLeft, setLockedSecondsLeft] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const lockTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isLocked = lockedUntil !== null && Date.now() < lockedUntil;

  // If already verified, redirect to dashboard
  useEffect(() => {
    if (isAdminVerified) {
      navigate({ to: "/" });
    }
  }, [isAdminVerified, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked || isLoading) return;

    setIsLoading(true);
    setError("");

    // Small delay for UX feel
    await new Promise((r) => setTimeout(r, 400));

    const ok = verifyAdmin(email.trim(), password);
    setIsLoading(false);

    if (ok) {
      navigate({ to: "/" });
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setShaking(true);
      setTimeout(() => setShaking(false), 700);

      if (newAttempts >= 3) {
        const until = Date.now() + 30_000;
        setLockedUntil(until);
        setLockedSecondsLeft(30);
        setError("");

        if (lockTimerRef.current) clearInterval(lockTimerRef.current);
        lockTimerRef.current = setInterval(() => {
          const remaining = Math.ceil((until - Date.now()) / 1000);
          if (remaining <= 0) {
            if (lockTimerRef.current) clearInterval(lockTimerRef.current);
            setLockedUntil(null);
            setLockedSecondsLeft(0);
            setAttempts(0);
            setError("");
          } else {
            setLockedSecondsLeft(remaining);
          }
        }, 500);
      } else {
        setError(
          "Invalid login credentials. Please check your email and password.",
        );
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative">
      {/* Background grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:60px_60px] pointer-events-none" />

      {/* Ambient glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-500/4 rounded-full blur-3xl pointer-events-none" />

      <div
        className={`relative w-full max-w-md z-10 transition-all ${
          shaking ? "animate-bounce" : ""
        }`}
        style={{
          animation: shaking ? "shake 0.5s ease-in-out" : undefined,
        }}
      >
        {/* Card */}
        <div className="bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl shadow-black/60">
          {/* Top cyan stripe */}
          <div className="h-1 bg-gradient-to-r from-cyan-600 via-cyan-400 to-cyan-600" />

          <div className="px-8 py-8 space-y-6">
            {/* Logo + Title */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-cyan-500/20 blur-xl scale-150" />
                <div className="relative w-16 h-16 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center">
                  <Zap className="w-8 h-8 text-cyan-400" fill="currentColor" />
                </div>
              </div>
              <div className="text-center">
                <h1 className="text-xl font-bold text-white tracking-tight">
                  Alpha Signal AI
                </h1>
                <p className="text-sm text-slate-400 mt-1">
                  Sign in to access your trading dashboard
                </p>
              </div>
            </div>

            {/* Admin badge */}
            <div className="flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
              <Shield className="w-3 h-3 text-cyan-400" />
              <span className="text-[11px] font-mono text-cyan-400 font-semibold tracking-widest uppercase">
                Master Admin Portal
              </span>
            </div>

            {/* Error message */}
            {error && !isLocked && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-500/15 border border-red-500/30">
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span className="text-xs text-red-400 font-medium">
                  {error}
                </span>
              </div>
            )}

            {/* Locked message */}
            {isLocked && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-900/30 border border-red-500/40">
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span className="text-xs text-red-400 font-medium">
                  🚨 Too many failed attempts. Locked for {lockedSecondsLeft}s.
                </span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="login-email"
                  className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider"
                >
                  Email Address
                </label>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  autoComplete="email"
                  disabled={isLocked || isLoading}
                  required
                  className="w-full px-4 py-3 bg-slate-800/80 border border-white/10 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 focus:bg-slate-800 transition-all disabled:opacity-40"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="login-password"
                  className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    disabled={isLocked || isLoading}
                    required
                    className="w-full px-4 py-3 pr-11 bg-slate-800/80 border border-white/10 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 focus:bg-slate-800 transition-all disabled:opacity-40"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLocked || !email || !password || isLoading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 font-semibold text-sm hover:bg-cyan-500/30 hover:border-cyan-500/60 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <svg
                      role="img"
                      aria-label="Loading"
                      className="animate-spin w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v8z"
                      />
                    </svg>
                    Signing In...
                  </>
                ) : isLocked ? (
                  `Locked (${lockedSecondsLeft}s)`
                ) : (
                  <>
                    <Shield className="w-4 h-4" />
                    Sign In
                  </>
                )}
              </button>
            </form>

            {/* Attempts indicator */}
            {attempts > 0 && attempts < 3 && !isLocked && (
              <p className="text-center text-[10px] text-slate-500">
                {3 - attempts} attempt{3 - attempts !== 1 ? "s" : ""} remaining
                before lockout
              </p>
            )}

            {/* Footer */}
            <div className="text-center pt-1">
              <a
                href="/privacy-policy"
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors underline underline-offset-2"
              >
                Privacy Policy
              </a>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}
