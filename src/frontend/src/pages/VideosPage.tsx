import { VideoDifficulty } from "@/backend";
import { useActor } from "@/hooks/useActor";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  Brain,
  Loader2,
  Play,
  Search,
  Shield,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type DifficultyLevel = "beginner" | "intermediate" | "advanced";
type Category =
  | "all"
  | "smart-money"
  | "trading-basics"
  | "psychology"
  | "strategy";

interface VideoItem {
  id: string;
  title: string;
  description: string;
  youtubeId: string;
  thumbnailUrl: string;
  difficulty: DifficultyLevel;
  category: Category;
  uploadedAt: number; // ms timestamp
  isLocal?: boolean; // stored in localStorage
}

// ─── YouTube helpers ──────────────────────────────────────────────────────────

function extractYouTubeId(url: string): string {
  const short = url.match(/youtu\.be\/([\w-]+)/);
  if (short) return short[1];
  const long = url.match(/[?&]v=([\w-]+)/);
  if (long) return long[1];
  const embed = url.match(/embed\/([\w-]+)/);
  if (embed) return embed[1];
  return "";
}

function getEmbedUrl(ytId: string): string {
  return `https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0`;
}

function getThumbnail(ytId: string): string {
  return `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
}

function isNewVideo(uploadedAt: number): boolean {
  return Date.now() - uploadedAt < 7 * 24 * 60 * 60 * 1000;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = "alpha_signal_videos_v2";

const CATEGORIES: { id: Category; label: string; icon: React.ReactNode }[] = [
  { id: "all", label: "All Videos", icon: <Play className="w-3.5 h-3.5" /> },
  {
    id: "smart-money",
    label: "Smart Money",
    icon: <Shield className="w-3.5 h-3.5" />,
  },
  {
    id: "trading-basics",
    label: "Trading Basics",
    icon: <BookOpen className="w-3.5 h-3.5" />,
  },
  {
    id: "psychology",
    label: "Psychology",
    icon: <Brain className="w-3.5 h-3.5" />,
  },
  {
    id: "strategy",
    label: "Strategy",
    icon: <Target className="w-3.5 h-3.5" />,
  },
];

const DIFFICULTY_OPTIONS: { id: DifficultyLevel | "all"; label: string }[] = [
  { id: "all", label: "All Levels" },
  { id: "beginner", label: "Beginner" },
  { id: "intermediate", label: "Intermediate" },
  { id: "advanced", label: "Advanced" },
];

const DIFFICULTY_STYLES: Record<DifficultyLevel, string> = {
  beginner: "bg-emerald-500/15 border-emerald-500/30 text-emerald-400",
  intermediate: "bg-amber-500/15 border-amber-500/30 text-amber-400",
  advanced: "bg-purple-500/15 border-purple-500/30 text-purple-400",
};

const SAMPLE_VIDEOS: VideoItem[] = [
  {
    id: "sample-1",
    title: "Smart Money Concepts (SMC) — Complete Beginner Guide",
    description:
      "Learn how institutional traders operate, including order blocks, fair value gaps, and liquidity sweeps.",
    youtubeId: "FjqjCr1RRWI",
    thumbnailUrl: getThumbnail("FjqjCr1RRWI"),
    difficulty: "beginner",
    category: "smart-money",
    uploadedAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
  },
  {
    id: "sample-2",
    title: "Order Blocks & Fair Value Gaps Explained",
    description:
      "Deep dive into SMC order blocks and fair value gaps — how to identify them and trade them with precision.",
    youtubeId: "M0XxLaBJfMc",
    thumbnailUrl: getThumbnail("M0XxLaBJfMc"),
    difficulty: "intermediate",
    category: "smart-money",
    uploadedAt: Date.now() - 4 * 24 * 60 * 60 * 1000,
  },
  {
    id: "sample-3",
    title: "EMA Strategy for Day Trading — 20/50/200 Setup",
    description:
      "Master the EMA crossover technique using the 20, 50, and 200 exponential moving averages for high-probability entries.",
    youtubeId: "BsM7-MNxDDI",
    thumbnailUrl: getThumbnail("BsM7-MNxDDI"),
    difficulty: "beginner",
    category: "trading-basics",
    uploadedAt: Date.now() - 8 * 24 * 60 * 60 * 1000,
  },
  {
    id: "sample-4",
    title: "Reading the Economic Calendar — Trading NFP & FOMC",
    description:
      "Learn how to trade high-impact news events like Non-Farm Payrolls and FOMC rate decisions without getting wrecked.",
    youtubeId: "MrVpxMzL_-0",
    thumbnailUrl: getThumbnail("MrVpxMzL_-0"),
    difficulty: "beginner",
    category: "trading-basics",
    uploadedAt: Date.now() - 12 * 24 * 60 * 60 * 1000,
  },
  {
    id: "sample-5",
    title: "Trading Psychology — How to Stay Disciplined",
    description:
      "Master your emotions in trading. Overcome FOMO, revenge trading, and emotional decision-making to trade like a professional.",
    youtubeId: "Kw5m5QQTHQI",
    thumbnailUrl: getThumbnail("Kw5m5QQTHQI"),
    difficulty: "beginner",
    category: "psychology",
    uploadedAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
  },
  {
    id: "sample-6",
    title: "Mental Performance for Traders — Advanced Mindset",
    description:
      "Elite-level psychological frameworks used by professional traders to maintain peak performance and consistency.",
    youtubeId: "Q7LX6bCPFq8",
    thumbnailUrl: getThumbnail("Q7LX6bCPFq8"),
    difficulty: "advanced",
    category: "psychology",
    uploadedAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
  },
  {
    id: "sample-7",
    title: "RSI + Supertrend Strategy — Advanced Crypto Scalping",
    description:
      "Combine RSI divergence with Supertrend confirmation for precision entries on BTC and ETH scalping setups.",
    youtubeId: "Kw5m5QQTHQI",
    thumbnailUrl: getThumbnail("Kw5m5QQTHQI"),
    difficulty: "advanced",
    category: "strategy",
    uploadedAt: Date.now() - 9 * 24 * 60 * 60 * 1000,
  },
  {
    id: "sample-8",
    title: "Gold (XAUUSD) Trading Strategy — Complete Breakdown",
    description:
      "Understand DXY correlation, safe-haven flows, and how to build a high-probability gold trading strategy.",
    youtubeId: "Q7LX6bCPFq8",
    thumbnailUrl: getThumbnail("Q7LX6bCPFq8"),
    difficulty: "intermediate",
    category: "strategy",
    uploadedAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
  },
];

// ─── localStorage helpers ─────────────────────────────────────────────────────

function loadLocalVideos(): VideoItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as VideoItem[];
  } catch {
    return [];
  }
}

function saveLocalVideos(videos: VideoItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(videos));
  } catch {}
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function VideosPage() {
  const { actor } = useActor();

  const [allVideos, setAllVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<Category>("all");
  const [activeDifficulty, setActiveDifficulty] = useState<
    DifficultyLevel | "all"
  >("all");
  const [playingVideo, setPlayingVideo] = useState<VideoItem | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    title: "",
    description: "",
    youtubeUrl: "",
    difficulty: "beginner" as DifficultyLevel,
    category: "trading-basics" as Category,
  });
  const [addError, setAddError] = useState("");
  const [adding, setAdding] = useState(false);
  const [previewId, setPreviewId] = useState("");

  // Load videos on mount
  const loadVideos = useCallback(async () => {
    setLoading(true);
    const local = loadLocalVideos();

    if (actor) {
      try {
        const backendVideos = await actor.getVideos();
        if (backendVideos.length > 0) {
          // Merge backend videos with any local metadata
          const merged = backendVideos.map((bv) => {
            const ytId = extractYouTubeId(bv.videoUrl);
            return {
              id: String(bv.id),
              title: bv.title,
              description: bv.description,
              youtubeId: ytId,
              thumbnailUrl: bv.thumbnailUrl || getThumbnail(ytId),
              difficulty: (bv.difficulty?.toLowerCase() ??
                "beginner") as DifficultyLevel,
              category: "trading-basics" as Category,
              uploadedAt: Number(bv.uploaded_at) / 1_000_000,
            };
          });
          // Combine: local admin-added + backend (avoid duplicates)
          const backendIds = new Set(merged.map((v) => v.id));
          const localOnly = local.filter((v) => !backendIds.has(v.id));
          const combined = [...merged, ...localOnly].sort(
            (a, b) => b.uploadedAt - a.uploadedAt,
          );
          setAllVideos(combined.length > 0 ? combined : SAMPLE_VIDEOS);
        } else {
          // No backend videos — show local + samples
          const combined = [
            ...local,
            ...SAMPLE_VIDEOS.filter((s) => !local.find((l) => l.id === s.id)),
          ].sort((a, b) => b.uploadedAt - a.uploadedAt);
          setAllVideos(combined);
        }
      } catch {
        const combined = [
          ...local,
          ...SAMPLE_VIDEOS.filter((s) => !local.find((l) => l.id === s.id)),
        ].sort((a, b) => b.uploadedAt - a.uploadedAt);
        setAllVideos(combined);
      }
    } else {
      const combined = [
        ...local,
        ...SAMPLE_VIDEOS.filter((s) => !local.find((l) => l.id === s.id)),
      ].sort((a, b) => b.uploadedAt - a.uploadedAt);
      setAllVideos(combined);
    }
    setLoading(false);
  }, [actor]);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  // Derived filter
  const filtered = allVideos.filter((v) => {
    const matchSearch =
      v.title.toLowerCase().includes(search.toLowerCase()) ||
      v.description.toLowerCase().includes(search.toLowerCase());
    const matchCat = activeCategory === "all" || v.category === activeCategory;
    const matchDiff =
      activeDifficulty === "all" || v.difficulty === activeDifficulty;
    return matchSearch && matchCat && matchDiff;
  });

  // YouTube URL preview
  useEffect(() => {
    const id = extractYouTubeId(addForm.youtubeUrl);
    setPreviewId(id);
  }, [addForm.youtubeUrl]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError("");
    if (!addForm.title.trim()) {
      setAddError("Title is required.");
      return;
    }
    if (!addForm.youtubeUrl.trim()) {
      setAddError("YouTube URL is required.");
      return;
    }
    const ytId = extractYouTubeId(addForm.youtubeUrl);
    if (!ytId) {
      setAddError("Could not extract YouTube video ID. Please check the URL.");
      return;
    }

    setAdding(true);
    const newVideo: VideoItem = {
      id: `local-${Date.now()}`,
      title: addForm.title.trim(),
      description: addForm.description.trim(),
      youtubeId: ytId,
      thumbnailUrl: getThumbnail(ytId),
      difficulty: addForm.difficulty,
      category:
        addForm.category === "all"
          ? "trading-basics"
          : (addForm.category as Exclude<Category, "all">),
      uploadedAt: Date.now(),
      isLocal: true,
    };

    // Also try to persist in backend
    if (actor) {
      try {
        const difficulty =
          addForm.difficulty === "advanced"
            ? VideoDifficulty.advanced
            : VideoDifficulty.beginner;
        await actor.addVideo(
          newVideo.title,
          newVideo.description,
          `https://www.youtube.com/watch?v=${ytId}`,
          newVideo.thumbnailUrl,
          difficulty,
        );
      } catch {
        // Backend save failed, still save locally
      }
    }

    // Save locally
    const existing = loadLocalVideos();
    const updated = [newVideo, ...existing];
    saveLocalVideos(updated);

    setAllVideos((prev) => [newVideo, ...prev]);
    setShowAddModal(false);
    setAddForm({
      title: "",
      description: "",
      youtubeUrl: "",
      difficulty: "beginner",
      category: "trading-basics",
    });
    setAdding(false);
  };

  const handleDelete = async (video: VideoItem) => {
    // Remove from local storage
    const existing = loadLocalVideos();
    saveLocalVideos(existing.filter((v) => v.id !== video.id));

    // Try backend delete
    if (actor && !video.isLocal) {
      try {
        await actor.deleteVideo(BigInt(video.id));
      } catch {}
    }

    setAllVideos((prev) => prev.filter((v) => v.id !== video.id));
    if (playingVideo?.id === video.id) setPlayingVideo(null);
  };

  const categoryCounts = CATEGORIES.reduce(
    (acc, cat) => {
      acc[cat.id] =
        cat.id === "all"
          ? allVideos.length
          : allVideos.filter((v) => v.category === cat.id).length;
      return acc;
    },
    {} as Record<Category, number>,
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-b border-white/5">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-transparent to-purple-500/5" />
        <div className="relative px-6 py-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-5 h-5 text-cyan-400" />
                <span className="text-xs font-medium text-cyan-400 uppercase tracking-widest">
                  Alpha Signal AI
                </span>
              </div>
              <h1 className="text-2xl font-bold text-white">Learning Center</h1>
              <p className="text-sm text-slate-400 mt-1">
                {allVideos.length} professional trading videos
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/30 transition-all text-sm font-medium"
            >
              <Sparkles className="w-4 h-4" />
              Add Video
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 space-y-6">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search videos by title or topic..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-800/60 border border-white/8 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/40 focus:bg-slate-800 transition-all"
          />
        </div>

        {/* Category Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap border transition-all",
                activeCategory === cat.id
                  ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-400"
                  : "bg-slate-800/60 border-white/8 text-slate-400 hover:text-white hover:border-white/15",
              )}
            >
              {cat.icon}
              {cat.label}
              <span
                className={cn(
                  "ml-0.5 px-1.5 py-0.5 rounded-full text-[10px]",
                  activeCategory === cat.id
                    ? "bg-cyan-500/30 text-cyan-300"
                    : "bg-slate-700 text-slate-400",
                )}
              >
                {categoryCounts[cat.id]}
              </span>
            </button>
          ))}
        </div>

        {/* Difficulty Filter */}
        <div className="flex gap-2 flex-wrap">
          {DIFFICULTY_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setActiveDifficulty(opt.id)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                activeDifficulty === opt.id
                  ? opt.id === "beginner"
                    ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                    : opt.id === "intermediate"
                      ? "bg-amber-500/20 border-amber-500/40 text-amber-400"
                      : opt.id === "advanced"
                        ? "bg-purple-500/20 border-purple-500/40 text-purple-400"
                        : "bg-cyan-500/20 border-cyan-500/40 text-cyan-400"
                  : "bg-slate-800/60 border-white/8 text-slate-400 hover:text-white",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Results count */}
        {!loading && (
          <p className="text-xs text-slate-500">
            Showing{" "}
            <span className="text-slate-300 font-medium">
              {filtered.length}
            </span>{" "}
            video{filtered.length !== 1 ? "s" : ""}
            {activeCategory !== "all" &&
              ` in ${CATEGORIES.find((c) => c.id === activeCategory)?.label}`}
          </p>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          </div>
        )}

        {/* Empty */}
        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-slate-500">
            <div className="w-16 h-16 rounded-full bg-slate-800 border border-white/8 flex items-center justify-center">
              <Play className="w-7 h-7 text-slate-600" />
            </div>
            <div className="text-center">
              <p className="font-medium text-slate-300">No videos found</p>
              <p className="text-sm mt-1">
                Try adjusting your search or filters.
              </p>
            </div>
          </div>
        )}

        {/* Video Grid */}
        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((video) => (
              <VideoCard
                key={video.id}
                video={video}
                onPlay={() => setPlayingVideo(video)}
                onDelete={() => handleDelete(video)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Player Modal */}
      {playingVideo && (
        <PlayerModal
          video={playingVideo}
          onClose={() => setPlayingVideo(null)}
        />
      )}

      {/* Add Video Modal */}
      {showAddModal && (
        <AddVideoModal
          form={addForm}
          previewId={previewId}
          error={addError}
          adding={adding}
          onChange={(patch) => setAddForm((p) => ({ ...p, ...patch }))}
          onSubmit={handleAdd}
          onClose={() => {
            setShowAddModal(false);
            setAddError("");
          }}
        />
      )}
    </div>
  );
}

// ─── VideoCard ────────────────────────────────────────────────────────────────

function VideoCard({
  video,
  onPlay,
  onDelete,
}: {
  video: VideoItem;
  onPlay: () => void;
  onDelete: () => void;
}) {
  const [thumbError, setThumbError] = useState(false);
  const isNew = isNewVideo(video.uploadedAt);

  return (
    <div className="group relative bg-slate-800/60 border border-white/8 rounded-xl overflow-hidden hover:border-cyan-500/30 hover:shadow-lg hover:shadow-cyan-500/5 transition-all duration-300 cursor-pointer">
      {/* Thumbnail */}
      <button
        type="button"
        className="relative w-full aspect-video bg-slate-900 overflow-hidden focus:outline-none"
        onClick={onPlay}
        aria-label={`Play ${video.title}`}
      >
        {!thumbError ? (
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={() => setThumbError(true)}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
            <Play className="w-10 h-10 text-slate-600" />
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all duration-300 flex items-center justify-center">
          <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all duration-300">
            <Play className="w-6 h-6 text-white ml-0.5" fill="currentColor" />
          </div>
        </div>

        {/* New badge */}
        {isNew && (
          <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            NEW
          </div>
        )}

        {/* Category pill */}
        <div className="absolute bottom-2 left-2">
          <span className="px-2 py-0.5 rounded-full bg-black/60 backdrop-blur text-[10px] text-slate-300 border border-white/10">
            {CATEGORIES.find((c) => c.id === video.category)?.label ??
              video.category}
          </span>
        </div>
      </button>

      {/* Card body */}
      <div className="p-3.5 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-white line-clamp-2 flex-1 leading-snug">
            {video.title}
          </h3>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="flex-shrink-0 p-1 rounded-md text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Delete video"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <p className="text-xs text-slate-400 line-clamp-2">
          {video.description}
        </p>

        <div className="flex items-center justify-between pt-0.5">
          <span
            className={cn(
              "px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide border",
              DIFFICULTY_STYLES[video.difficulty],
            )}
          >
            {video.difficulty}
          </span>
          <span className="text-[10px] text-slate-500">
            {formatDate(video.uploadedAt)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── PlayerModal ──────────────────────────────────────────────────────────────

function PlayerModal({
  video,
  onClose,
}: { video: VideoItem; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="w-full max-w-4xl bg-slate-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span
              className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide border flex-shrink-0",
                DIFFICULTY_STYLES[video.difficulty],
              )}
            >
              {video.difficulty}
            </span>
            <h2 className="text-sm font-semibold text-white truncate">
              {video.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-3 flex-shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Player */}
        <div className="bg-black aspect-video">
          <iframe
            src={getEmbedUrl(video.youtubeId)}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            className="w-full h-full"
          />
        </div>

        {/* Footer */}
        <div className="px-5 py-4 space-y-1.5 bg-slate-800/50">
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span className="px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
              {CATEGORIES.find((c) => c.id === video.category)?.label}
            </span>
            <span>·</span>
            <span>{formatDate(video.uploadedAt)}</span>
          </div>
          {video.description && (
            <p className="text-sm text-slate-400">{video.description}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── AddVideoModal ────────────────────────────────────────────────────────────

interface AddFormState {
  title: string;
  description: string;
  youtubeUrl: string;
  difficulty: DifficultyLevel;
  category: Category;
}

function AddVideoModal({
  form,
  previewId,
  error,
  adding,
  onChange,
  onSubmit,
  onClose,
}: {
  form: AddFormState;
  previewId: string;
  error: string;
  adding: boolean;
  onChange: (patch: Partial<AddFormState>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="w-full max-w-lg bg-slate-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <h2 className="text-base font-semibold text-white">
            Add YouTube Video
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={onSubmit}
          className="p-5 space-y-4 max-h-[80vh] overflow-y-auto"
        >
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
              {error}
            </div>
          )}

          {/* YouTube URL */}
          <div className="space-y-1.5">
            <label
              htmlFor="add-youtube-url"
              className="text-xs font-medium text-slate-400 uppercase tracking-wide"
            >
              YouTube URL <span className="text-red-400">*</span>
            </label>
            <input
              id="add-youtube-url"
              type="text"
              value={form.youtubeUrl}
              onChange={(e) => onChange({ youtubeUrl: e.target.value })}
              placeholder="https://youtube.com/watch?v=... or youtu.be/..."
              className="w-full px-3 py-2.5 bg-slate-800 border border-white/8 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
            />
            {/* Auto thumbnail preview */}
            {previewId && (
              <div className="mt-2 rounded-lg overflow-hidden border border-white/8 aspect-video bg-slate-800">
                <img
                  src={getThumbnail(previewId)}
                  alt="Thumbnail preview"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.opacity = "0";
                  }}
                />
              </div>
            )}
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <label
              htmlFor="add-title"
              className="text-xs font-medium text-slate-400 uppercase tracking-wide"
            >
              Title <span className="text-red-400">*</span>
            </label>
            <input
              id="add-title"
              type="text"
              value={form.title}
              onChange={(e) => onChange({ title: e.target.value })}
              placeholder="e.g. Smart Money Concepts Explained"
              className="w-full px-3 py-2.5 bg-slate-800 border border-white/8 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label
              htmlFor="add-description"
              className="text-xs font-medium text-slate-400 uppercase tracking-wide"
            >
              Description
            </label>
            <textarea
              id="add-description"
              value={form.description}
              onChange={(e) => onChange({ description: e.target.value })}
              placeholder="What will viewers learn?"
              rows={3}
              className="w-full px-3 py-2.5 bg-slate-800 border border-white/8 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50 transition-colors resize-none"
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            {/* biome-ignore lint/a11y/noLabelWithoutControl: button group */}
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
              Category
            </label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.filter((c) => c.id !== "all").map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => onChange({ category: cat.id })}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg text-xs border transition-all",
                    form.category === cat.id
                      ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-400"
                      : "bg-slate-800 border-white/8 text-slate-400 hover:text-white",
                  )}
                >
                  {cat.icon}
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty */}
          <div className="space-y-1.5">
            {/* biome-ignore lint/a11y/noLabelWithoutControl: button group */}
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
              Difficulty
            </label>
            <div className="flex gap-2">
              {(
                ["beginner", "intermediate", "advanced"] as DifficultyLevel[]
              ).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => onChange({ difficulty: d })}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-xs font-medium border capitalize transition-all",
                    form.difficulty === d
                      ? DIFFICULTY_STYLES[d].replace("15", "20")
                      : "bg-slate-800 border-white/8 text-slate-400 hover:text-white",
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-white/8 text-sm text-slate-400 hover:text-white hover:border-white/15 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={adding}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/30 transition-all text-sm font-medium disabled:opacity-50"
            >
              {adding ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {adding ? "Adding..." : "Add Video"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
