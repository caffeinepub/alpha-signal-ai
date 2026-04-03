import { useAdminGate } from "@/hooks/useAdminGate";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Eye, EyeOff, Lock, Shield } from "lucide-react";
import { motion } from "motion/react";
import { useRef, useState } from "react";

export default function AdminGate() {
  const { verifyAdmin } = useAdminGate();

  const [email, setEmail] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState("");
  const [shaking, setShaking] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [lockedSecondsLeft, setLockedSecondsLeft] = useState(0);
  const lockTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isLocked = lockedUntil !== null && Date.now() < lockedUntil;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) return;

    const ok = verifyAdmin(email, secretKey);
    if (ok) {
      setError("");
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
        setError("❌ Access Denied. Invalid credentials.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      {/* Background grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:60px_60px] pointer-events-none" />

      {/* Ambient glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={
          shaking
            ? { x: [-8, 8, -8, 8, -4, 4, 0] }
            : { opacity: 1, y: 0, scale: 1 }
        }
        transition={
          shaking ? { duration: 0.5 } : { duration: 0.4, ease: "easeOut" }
        }
        className="relative w-full max-w-md z-10"
      >
        {/* Card */}
        <div className="bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl shadow-black/60">
          {/* Top amber stripe */}
          <div className="h-1 bg-gradient-to-r from-amber-600 via-amber-400 to-amber-600" />

          <div className="px-8 py-8 space-y-6">
            {/* Shield icon */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-amber-500/20 blur-xl scale-150" />
                <div className="relative w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                  <Shield className="w-8 h-8 text-amber-400" />
                </div>
              </div>
              <div className="text-center">
                <h1 className="text-xl font-bold text-white tracking-tight">
                  Admin Access Required
                </h1>
                <p className="text-sm text-slate-400 mt-1">
                  This area is restricted to authorized personnel only.
                </p>
              </div>
            </div>

            {/* Lock status badge */}
            <div className="flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <Lock className="w-3 h-3 text-amber-400" />
              <span className="text-[11px] font-mono text-amber-400 font-semibold tracking-widest uppercase">
                🔒 Secured Admin Zone
              </span>
            </div>

            {/* Error message */}
            {error && !isLocked && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-500/15 border border-red-500/30"
              >
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span className="text-xs text-red-400 font-medium">
                  {error}
                </span>
              </motion.div>
            )}

            {/* Locked message */}
            {isLocked && (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-900/30 border border-red-500/40"
              >
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span className="text-xs text-red-400 font-medium">
                  🚨 Too many attempts. Access locked for {lockedSecondsLeft}s.
                </span>
              </motion.div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="admin-email"
                  className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider"
                >
                  Admin Email
                </label>
                <input
                  id="admin-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Admin Email"
                  autoComplete="email"
                  disabled={isLocked}
                  className="w-full px-4 py-3 bg-slate-800/80 border border-white/10 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 focus:bg-slate-800 transition-all disabled:opacity-40"
                  data-ocid="admin_gate.input"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="admin-secret"
                  className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider"
                >
                  Admin Secret Key
                </label>
                <div className="relative">
                  <input
                    id="admin-secret"
                    type={showKey ? "text" : "password"}
                    value={secretKey}
                    onChange={(e) => setSecretKey(e.target.value)}
                    placeholder="Admin Secret Key"
                    autoComplete="current-password"
                    disabled={isLocked}
                    className="w-full px-4 py-3 pr-11 bg-slate-800/80 border border-white/10 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 focus:bg-slate-800 transition-all disabled:opacity-40"
                    data-ocid="admin_gate.textarea"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    tabIndex={-1}
                  >
                    {showKey ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLocked || !email || !secretKey}
                data-ocid="admin_gate.submit_button"
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 font-semibold text-sm hover:bg-amber-500/30 hover:border-amber-500/60 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Shield className="w-4 h-4" />
                {isLocked
                  ? `Locked (${lockedSecondsLeft}s)`
                  : "Verify Identity"}
              </button>
            </form>

            {/* Return link */}
            <div className="text-center pt-1">
              <Link
                to="/"
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                data-ocid="admin_gate.link"
              >
                ← Return to Dashboard
              </Link>
            </div>
          </div>
        </div>

        {/* Attempts indicator */}
        {attempts > 0 && attempts < 3 && !isLocked && (
          <p className="text-center text-[10px] text-slate-500 mt-3">
            {3 - attempts} attempt{3 - attempts !== 1 ? "s" : ""} remaining
            before lockout
          </p>
        )}
      </motion.div>
    </div>
  );
}
