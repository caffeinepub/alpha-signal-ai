import { useAdminGate } from "@/hooks/useAdminGate";
import { useNavigate } from "@tanstack/react-router";
import {
  Brain,
  Globe,
  LogOut,
  Megaphone,
  Shield,
  Trash2,
  Video,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";

type SignalOverride = "AUTO" | "BUY" | "SELL" | "WAIT";
type MarketStatus = "Trending" | "Sideways" | "Volatile";

interface VideoEntry {
  id: string;
  title: string;
  description: string;
  url: string;
  addedAt: number;
}

function loadVideos(): VideoEntry[] {
  try {
    return JSON.parse(localStorage.getItem("adminVideos") || "[]");
  } catch {
    return [];
  }
}

function saveVideos(videos: VideoEntry[]) {
  localStorage.setItem("adminVideos", JSON.stringify(videos));
}

export default function AdminDashboard() {
  const { isAdminVerified, logout } = useAdminGate();
  const navigate = useNavigate();

  useEffect(() => {
    const isAdmin = localStorage.getItem("isAdmin") === "true";
    console.log("[Admin] Admin state on panel load:", isAdmin);
    if (!isAdmin) {
      navigate({ to: "/admin-login" });
    }
  }, [navigate]);

  // Signal Control
  const [signalOverride, setSignalOverride] = useState<SignalOverride>(
    () =>
      (localStorage.getItem("adminSignalOverride") as SignalOverride) || "AUTO",
  );

  // Market Control
  const [marketStatus, setMarketStatus] = useState<MarketStatus>(
    () => (localStorage.getItem("marketStatus") as MarketStatus) || "Trending",
  );

  // AI Control
  const [geminiEnabled, setGeminiEnabled] = useState<boolean>(
    () => localStorage.getItem("geminiEnabled") !== "false",
  );

  // Broadcast
  const [broadcastInput, setBroadcastInput] = useState(
    () => localStorage.getItem("broadcastMessage") || "",
  );
  const [broadcastSaved, setBroadcastSaved] = useState(false);

  // Videos
  const [videos, setVideos] = useState<VideoEntry[]>(loadVideos);
  const [videoTitle, setVideoTitle] = useState("");
  const [videoDesc, setVideoDesc] = useState("");
  const [videoUrl, setVideoUrl] = useState("");

  const handleSignalOverride = (val: SignalOverride) => {
    setSignalOverride(val);
    localStorage.setItem("adminSignalOverride", val);
    console.log("[Admin] Signal override set to:", val);
  };

  const handleMarketStatus = (val: MarketStatus) => {
    setMarketStatus(val);
    localStorage.setItem("marketStatus", val);
  };

  const handleGeminiToggle = (val: boolean) => {
    setGeminiEnabled(val);
    localStorage.setItem("geminiEnabled", val ? "true" : "false");
  };

  const handleBroadcast = () => {
    localStorage.setItem("broadcastMessage", broadcastInput);
    setBroadcastSaved(true);
    setTimeout(() => setBroadcastSaved(false), 2000);
  };

  const handleClearBroadcast = () => {
    setBroadcastInput("");
    localStorage.removeItem("broadcastMessage");
  };

  const handleAddVideo = () => {
    if (!videoTitle.trim() || !videoUrl.trim()) return;
    const newVideo: VideoEntry = {
      id: Date.now().toString(),
      title: videoTitle.trim(),
      description: videoDesc.trim(),
      url: videoUrl.trim(),
      addedAt: Date.now(),
    };
    const updated = [newVideo, ...videos];
    setVideos(updated);
    saveVideos(updated);
    setVideoTitle("");
    setVideoDesc("");
    setVideoUrl("");
  };

  const handleDeleteVideo = (id: string) => {
    const updated = videos.filter((v) => v.id !== id);
    setVideos(updated);
    saveVideos(updated);
  };

  const handleLogout = () => {
    logout();
    navigate({ to: "/" });
  };

  if (!isAdminVerified) return null;

  const signalOptions: { val: SignalOverride; label: string; color: string }[] =
    [
      {
        val: "AUTO",
        label: "AUTO",
        color: "text-cyan-400 border-cyan-500/40 bg-cyan-500/10",
      },
      {
        val: "BUY",
        label: "BUY 🟢",
        color: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
      },
      {
        val: "SELL",
        label: "SELL 🔴",
        color: "text-red-400 border-red-500/40 bg-red-500/10",
      },
      {
        val: "WAIT",
        label: "WAIT ⚠️",
        color: "text-amber-400 border-amber-500/40 bg-amber-500/10",
      },
    ];

  const marketOptions: { val: MarketStatus; label: string }[] = [
    { val: "Trending", label: "📈 Trending" },
    { val: "Sideways", label: "⚠️ Sideways" },
    { val: "Volatile", label: "🔥 Volatile" },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-400" />
            Admin Control Panel
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-bold font-mono uppercase tracking-wider">
              ADMIN LOCKED
            </span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Full control system — changes apply instantly
          </p>
        </div>
        <button
          type="button"
          data-ocid="admin.logout.button"
          onClick={handleLogout}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 transition-colors text-xs font-mono"
        >
          <LogOut className="w-3 h-3" /> Logout
        </button>
      </div>

      {/* 1. Signal Control */}
      <section className="trading-card p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-border/40 pb-3">
          <Zap className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-bold text-foreground">Signal Control</h3>
          <span className="text-xs text-muted-foreground ml-auto">
            {signalOverride === "AUTO"
              ? "System auto-generating signals"
              : `⚠️ Manual override active: ${signalOverride}`}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {signalOptions.map(({ val, label, color }) => (
            <button
              key={val}
              type="button"
              data-ocid={`admin.signal_override.${val.toLowerCase()}.button`}
              onClick={() => handleSignalOverride(val)}
              className={`px-3 py-2.5 rounded-lg border text-xs font-bold font-mono transition-all ${
                signalOverride === val
                  ? color
                  : "text-muted-foreground border-border/40 hover:border-border bg-transparent"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {signalOverride !== "AUTO" && (
          <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
            ⚠️ Manual override is active. All signals are showing{" "}
            <strong>{signalOverride}</strong> globally. Set to AUTO to restore
            normal operation.
          </div>
        )}
      </section>

      {/* 2. Market Status Control */}
      <section className="trading-card p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-border/40 pb-3">
          <Globe className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-bold text-foreground">
            Market Status Control
          </h3>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {marketOptions.map(({ val, label }) => (
            <button
              key={val}
              type="button"
              data-ocid={`admin.market_status.${val.toLowerCase()}.button`}
              onClick={() => handleMarketStatus(val)}
              className={`px-3 py-2.5 rounded-lg border text-xs font-bold transition-all ${
                marketStatus === val
                  ? val === "Sideways"
                    ? "text-amber-400 border-amber-500/40 bg-amber-500/10"
                    : val === "Volatile"
                      ? "text-red-400 border-red-500/40 bg-red-500/10"
                      : "text-emerald-400 border-emerald-500/40 bg-emerald-500/10"
                  : "text-muted-foreground border-border/40 hover:border-border bg-transparent"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Dashboard will show:{" "}
          <strong className="text-foreground">
            Market Status: {marketStatus}{" "}
            {marketStatus === "Sideways"
              ? "⚠️"
              : marketStatus === "Volatile"
                ? "🔥"
                : "📈"}
          </strong>
        </p>
      </section>

      {/* 3. AI (Gemini) Control */}
      <section className="trading-card p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-border/40 pb-3">
          <Brain className="w-4 h-4 text-violet-400" />
          <h3 className="text-sm font-bold text-foreground">
            AI Control (Gemini)
          </h3>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            <button
              type="button"
              data-ocid="admin.gemini.on.toggle"
              onClick={() => handleGeminiToggle(true)}
              className={`px-4 py-2 rounded-lg border text-xs font-bold transition-all ${
                geminiEnabled
                  ? "text-emerald-400 border-emerald-500/40 bg-emerald-500/10"
                  : "text-muted-foreground border-border/40"
              }`}
            >
              ON ✅
            </button>
            <button
              type="button"
              data-ocid="admin.gemini.off.toggle"
              onClick={() => handleGeminiToggle(false)}
              className={`px-4 py-2 rounded-lg border text-xs font-bold transition-all ${
                !geminiEnabled
                  ? "text-red-400 border-red-500/40 bg-red-500/10"
                  : "text-muted-foreground border-border/40"
              }`}
            >
              OFF ❌
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            {geminiEnabled
              ? "Gemini AI analysis is active and working."
              : "AI prediction section is hidden from users."}
          </p>
        </div>
      </section>

      {/* 4. Broadcast Message */}
      <section className="trading-card p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-border/40 pb-3">
          <Megaphone className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-bold text-foreground">
            Broadcast Message
          </h3>
        </div>
        <textarea
          data-ocid="admin.broadcast.textarea"
          value={broadcastInput}
          onChange={(e) => setBroadcastInput(e.target.value)}
          placeholder="e.g. ⚠️ Avoid trading, market sideways"
          rows={3}
          className="w-full px-3 py-2 bg-background/50 border border-border/40 rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
        />
        <div className="flex gap-2">
          <button
            type="button"
            data-ocid="admin.broadcast.submit_button"
            onClick={handleBroadcast}
            className="px-4 py-2 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs font-bold hover:bg-amber-500/30 transition-colors"
          >
            {broadcastSaved ? "✅ Saved!" : "📢 Send Broadcast"}
          </button>
          <button
            type="button"
            data-ocid="admin.broadcast.cancel_button"
            onClick={handleClearBroadcast}
            className="px-4 py-2 rounded-lg border border-border/40 text-muted-foreground text-xs font-bold hover:border-border transition-colors"
          >
            Clear
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Message shows as a banner on all pages for all users.
        </p>
      </section>

      {/* 5. Video Upload */}
      <section className="trading-card p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-border/40 pb-3">
          <Video className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-bold text-foreground">Video Upload</h3>
        </div>
        <div className="space-y-3">
          <input
            type="text"
            data-ocid="admin.video.input"
            value={videoTitle}
            onChange={(e) => setVideoTitle(e.target.value)}
            placeholder="Video Title"
            className="w-full px-3 py-2 bg-background/50 border border-border/40 rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
          />
          <textarea
            value={videoDesc}
            onChange={(e) => setVideoDesc(e.target.value)}
            placeholder="Description (optional)"
            rows={2}
            className="w-full px-3 py-2 bg-background/50 border border-border/40 rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
          />
          <input
            type="url"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="YouTube URL (e.g. https://www.youtube.com/watch?v=...)"
            className="w-full px-3 py-2 bg-background/50 border border-border/40 rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
          />
          <button
            type="button"
            data-ocid="admin.video.primary_button"
            onClick={handleAddVideo}
            disabled={!videoTitle.trim() || !videoUrl.trim()}
            className="px-4 py-2 rounded-lg bg-blue-500/20 border border-blue-500/40 text-blue-400 text-xs font-bold hover:bg-blue-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            + Add Video
          </button>
        </div>

        {videos.length > 0 && (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
              {videos.length} video{videos.length !== 1 ? "s" : ""} added
            </p>
            {videos.map((v, idx) => (
              <div
                key={v.id}
                data-ocid={`admin.video.item.${idx + 1}`}
                className="flex items-center gap-3 p-2 rounded-lg bg-background/30 border border-border/20"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">
                    {v.title}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {v.url}
                  </p>
                </div>
                <button
                  type="button"
                  data-ocid={`admin.video.delete_button.${idx + 1}`}
                  onClick={() => handleDeleteVideo(v.id)}
                  className="text-red-400/60 hover:text-red-400 transition-colors flex-shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
