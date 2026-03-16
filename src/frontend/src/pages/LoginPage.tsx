import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useActor } from "@/hooks/useActor";
import { hashPassword, useAuth } from "@/hooks/useAuth";
import { useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Phone,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

export default function LoginPage() {
  const { login } = useAuth();
  const { actor } = useActor();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);

  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [demoOtp, setDemoOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [otpExpiry, setOtpExpiry] = useState(60);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actor) return;
    setEmailError("");
    setEmailLoading(true);
    try {
      const hash = await hashPassword(password);
      const result = await actor.loginWithEmail(email, hash);
      if (result.__kind__ === "ok") {
        const { token, role, name } = result.ok;
        login(token, role, name, email);
        navigate({ to: role === "admin" ? "/admin" : "/" });
      } else {
        setEmailError(result.err);
      }
    } catch {
      setEmailError("Connection error. Please try again.");
    } finally {
      setEmailLoading(false);
    }
  };

  const handleSendOtp = async () => {
    if (!actor) return;
    if (!phone.trim()) {
      setOtpError("Please enter a valid phone number.");
      return;
    }
    setOtpError("");
    setSendLoading(true);
    try {
      const result = await actor.requestOTP(phone.trim());
      if (result.__kind__ === "ok") {
        setDemoOtp(result.ok);
        setOtpSent(true);
        let secs = 60;
        setOtpExpiry(secs);
        const timer = setInterval(() => {
          secs -= 1;
          setOtpExpiry(secs);
          if (secs <= 0) clearInterval(timer);
        }, 1000);
      } else {
        setOtpError(result.err);
      }
    } catch {
      setOtpError("Failed to send OTP. Try again.");
    } finally {
      setSendLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actor) return;
    setOtpError("");
    setOtpLoading(true);
    try {
      const result = await actor.verifyOTP(phone.trim(), otp.trim());
      if (result.__kind__ === "ok") {
        const { token, role, name } = result.ok;
        login(token, role, name, "", phone);
        navigate({ to: role === "admin" ? "/admin" : "/" });
      } else {
        setOtpError(result.err);
      }
    } catch {
      setOtpError("Verification failed. Try again.");
    } finally {
      setOtpLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background grid-pattern flex items-center justify-center px-4">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full bg-cyan/5 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md relative"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-3">
            <div className="w-9 h-9 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center glow-cyan">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <span className="text-xl font-bold text-foreground tracking-tight">
              Alpha Signal AI
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Sign in to your trading account
          </p>
        </div>

        <div className="trading-card p-6 shadow-2xl">
          <Tabs defaultValue="email">
            <TabsList className="w-full mb-6 bg-muted/50 border border-border">
              <TabsTrigger
                value="email"
                data-ocid="login.email_tab"
                className="flex-1 text-xs font-semibold"
              >
                <Mail className="w-3.5 h-3.5 mr-1.5" /> Email Login
              </TabsTrigger>
              <TabsTrigger
                value="otp"
                data-ocid="login.otp_tab"
                className="flex-1 text-xs font-semibold"
              >
                <Phone className="w-3.5 h-3.5 mr-1.5" /> Mobile OTP
              </TabsTrigger>
            </TabsList>

            <TabsContent value="email">
              <form onSubmit={handleEmailLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
                    Email Address
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="trader@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      data-ocid="login.email_input"
                      className="pl-9 bg-input/50 border-border/60 focus:border-primary/60 placeholder:text-muted-foreground/40 text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
                    Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      data-ocid="login.password_input"
                      className="pl-9 pr-10 bg-input/50 border-border/60 focus:border-primary/60 placeholder:text-muted-foreground/40 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <AnimatePresence>
                  {emailError && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      data-ocid="login.error_state"
                      className="flex items-center gap-2 text-bear text-xs bg-bear/10 border border-bear/30 rounded-md px-3 py-2"
                    >
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      {emailError}
                    </motion.div>
                  )}
                </AnimatePresence>

                <Button
                  type="submit"
                  disabled={emailLoading || !actor}
                  data-ocid="login.submit_button"
                  className="w-full bg-primary/90 hover:bg-primary text-primary-foreground font-semibold text-sm h-10 glow-cyan transition-all duration-200"
                >
                  {emailLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Signing
                      In...
                    </>
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="otp">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
                    Mobile Number
                  </Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        type="tel"
                        placeholder="+1 234 567 8900"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        disabled={otpSent}
                        autoComplete="tel"
                        data-ocid="otp.phone_input"
                        className="pl-9 bg-input/50 border-border/60 focus:border-primary/60 placeholder:text-muted-foreground/40 text-sm"
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={sendLoading || otpSent || !actor}
                      data-ocid="otp.send_button"
                      variant="outline"
                      className="border-primary/40 text-primary hover:bg-primary/10 text-xs px-3 whitespace-nowrap"
                    >
                      {sendLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : otpSent ? (
                        "Sent ✓"
                      ) : (
                        "Send OTP"
                      )}
                    </Button>
                  </div>
                </div>

                <AnimatePresence>
                  {demoOtp && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      className="rounded-lg border border-hold/40 bg-hold/10 p-3"
                    >
                      <p className="text-[10px] text-hold font-mono uppercase tracking-widest mb-1">
                        📱 Demo OTP (SMS Simulation)
                      </p>
                      <div className="flex items-center gap-3">
                        <span className="text-2xl font-black font-mono text-foreground tracking-[0.25em]">
                          {demoOtp}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          expires in {otpExpiry}s
                        </span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {otpSent && (
                    <motion.form
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      onSubmit={handleVerifyOtp}
                      className="space-y-3"
                    >
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
                          Enter OTP
                        </Label>
                        <Input
                          type="text"
                          placeholder="6-digit code"
                          value={otp}
                          onChange={(e) =>
                            setOtp(
                              e.target.value.replace(/\D/g, "").slice(0, 6),
                            )
                          }
                          maxLength={6}
                          required
                          data-ocid="otp.input"
                          className="bg-input/50 border-border/60 focus:border-primary/60 text-center text-lg font-mono tracking-[0.3em] placeholder:tracking-normal placeholder:text-sm"
                        />
                      </div>

                      {otpError && (
                        <div
                          data-ocid="otp.error_state"
                          className="flex items-center gap-2 text-bear text-xs bg-bear/10 border border-bear/30 rounded-md px-3 py-2"
                        >
                          <AlertCircle className="w-3.5 h-3.5" />
                          {otpError}
                        </div>
                      )}

                      <Button
                        type="submit"
                        disabled={otpLoading || otp.length < 6 || !actor}
                        data-ocid="otp.verify_button"
                        className="w-full bg-primary/90 hover:bg-primary text-primary-foreground font-semibold text-sm h-10 glow-cyan"
                      >
                        {otpLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />{" "}
                            Verifying...
                          </>
                        ) : (
                          "Verify & Sign In"
                        )}
                      </Button>
                    </motion.form>
                  )}
                </AnimatePresence>

                {!otpSent && otpError && (
                  <div className="flex items-center gap-2 text-bear text-xs bg-bear/10 border border-bear/30 rounded-md px-3 py-2">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {otpError}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <div className="mt-6 pt-5 border-t border-border/40 text-center">
            <span className="text-xs text-muted-foreground">
              Don't have an account?{" "}
              <a
                href="/signup"
                data-ocid="login.signup_link"
                className="text-primary hover:text-primary/80 font-semibold transition-colors"
              >
                Create account
              </a>
            </span>
          </div>
        </div>

        <p className="text-center text-[10px] text-muted-foreground/40 mt-6 font-mono">
          © {new Date().getFullYear()}. Built with love using{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-muted-foreground transition-colors"
          >
            caffeine.ai
          </a>
        </p>
      </motion.div>
    </div>
  );
}
