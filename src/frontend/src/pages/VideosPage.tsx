import { VideoDifficulty } from "@/backend";
import { useActor } from "@/hooks/useActor";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Loader2,
  Play,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const ADMIN_EMAIL = "prakash.brjn01@gmail.com";

type DifficultyFilter = "all" | "beginner" | "advanced";

interface VideoItem {
  id: bigint;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl: string;
  difficulty: string;
  uploaded_at: bigint;
}

function formatDate(nanos: bigint): string {
  const ms = Number(nanos / 1_000_000n);
  return new Date(ms).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function isYouTube(url: string): boolean {
  return url.includes("youtube.com") || url.includes("youtu.be");
}

function getYouTubeEmbedUrl(url: string): string {
  const shortMatch = url.match(/youtu\.be\/([\w-]+)/);
  if (shortMatch) return `https://www.youtube.com/embed/${shortMatch[1]}`;
  const longMatch = url.match(/[?&]v=([\w-]+)/);
  if (longMatch) return `https://www.youtube.com/embed/${longMatch[1]}`;
  if (url.includes("/embed/")) return url;
  return url;
}

function ThumbnailPlaceholder({
  difficulty,
  title,
}: {
  difficulty: string;
  title: string;
}) {
  const isAdvanced = difficulty === "advanced";
  return (
    <div
      className={cn(
        "w-full h-full flex items-center justify-center pointer-events-none",
        isAdvanced
          ? "bg-gradient-to-br from-purple-900/60 to-purple-700/20"
          : "bg-gradient-to-br from-cyan-900/60 to-cyan-700/20",
      )}
    >
      <div className="text-center px-4">
        <Play
          className={cn(
            "w-10 h-10 mx-auto mb-2 opacity-40",
            isAdvanced ? "text-purple-400" : "text-cyan-400",
          )}
        />
        <p className="text-xs text-muted-foreground line-clamp-2 opacity-60">
          {title}
        </p>
      </div>
    </div>
  );
}

const SAMPLE_VIDEOS: VideoItem[] = [
  {
    id: 1n,
    title: "Smart Money Concepts (SMC) — Complete Beginner Guide",
    description:
      "Learn how institutional traders operate, including order blocks, fair value gaps, and liquidity sweeps.",
    videoUrl: "https://www.youtube.com/watch?v=FjqjCr1RRWI",
    thumbnailUrl: "https://img.youtube.com/vi/FjqjCr1RRWI/maxresdefault.jpg",
    difficulty: "beginner",
    uploaded_at: BigInt(Date.now() - 2 * 24 * 60 * 60 * 1000) * 1_000_000n,
  },
  {
    id: 2n,
    title: "EMA Strategy for Day Trading — 20/50/200 Setup",
    description:
      "Master the EMA crossover technique using the 20, 50, and 200 exponential moving averages for high-probability entries.",
    videoUrl: "https://www.youtube.com/watch?v=BsM7-MNxDDI",
    thumbnailUrl: "https://img.youtube.com/vi/BsM7-MNxDDI/maxresdefault.jpg",
    difficulty: "beginner",
    uploaded_at: BigInt(Date.now() - 5 * 24 * 60 * 60 * 1000) * 1_000_000n,
  },
  {
    id: 3n,
    title: "RSI + Supertrend Strategy — Advanced Crypto Scalping",
    description:
      "Combine RSI divergence with Supertrend confirmation for precision entries on BTC and ETH scalping setups.",
    videoUrl: "https://www.youtube.com/watch?v=Kw5m5QQTHQI",
    thumbnailUrl: "https://img.youtube.com/vi/Kw5m5QQTHQI/maxresdefault.jpg",
    difficulty: "advanced",
    uploaded_at: BigInt(Date.now() - 7 * 24 * 60 * 60 * 1000) * 1_000_000n,
  },
  {
    id: 4n,
    title: "Reading the Economic Calendar — Trading NFP & FOMC",
    description:
      "Learn how to trade high-impact news events like Non-Farm Payrolls and FOMC rate decisions without getting wrecked.",
    videoUrl: "https://www.youtube.com/watch?v=MrVpxMzL_-0",
    thumbnailUrl: "https://img.youtube.com/vi/MrVpxMzL_-0/maxresdefault.jpg",
    difficulty: "beginner",
    uploaded_at: BigInt(Date.now() - 10 * 24 * 60 * 60 * 1000) * 1_000_000n,
  },
  {
    id: 5n,
    title: "Order Flow & Liquidity Sweeps — Institutional Trading",
    description:
      "Advanced breakdown of how market makers hunt liquidity, set traps, and move price before the real move.",
    videoUrl: "https://www.youtube.com/watch?v=M0XxLaBJfMc",
    thumbnailUrl: "https://img.youtube.com/vi/M0XxLaBJfMc/maxresdefault.jpg",
    difficulty: "advanced",
    uploaded_at: BigInt(Date.now() - 14 * 24 * 60 * 60 * 1000) * 1_000_000n,
  },
  {
    id: 6n,
    title: "Gold (XAUUSD) Trading — Complete Fundamentals",
    description:
      "Understand what drives gold prices, safe-haven flows, DXY correlation, and how to trade gold like a professional.",
    videoUrl: "https://www.youtube.com/watch?v=Q7LX6bCPFq8",
    thumbnailUrl: "https://img.youtube.com/vi/Q7LX6bCPFq8/maxresdefault.jpg",
    difficulty: "beginner",
    uploaded_at: BigInt(Date.now() - 18 * 24 * 60 * 60 * 1000) * 1_000_000n,
  },
];

export default function VideosPage() {
  const { user } = useAuth();
  const { actor, isFetching } = useActor();
  const isAdmin = user?.role === "admin" || user?.email === ADMIN_EMAIL;

  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [difficultyFilter, setDifficultyFilter] =
    useState<DifficultyFilter>("all");

  const [playingVideo, setPlayingVideo] = useState<VideoItem | null>(null);

  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadForm, setUploadForm] = useState({
    title: "",
    description: "",
    videoUrl: "",
    thumbnailUrl: "",
    difficulty: "beginner" as "beginner" | "advanced",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchVideos = useCallback(async () => {
    if (!actor) {
      setVideos(SAMPLE_VIDEOS);
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const result = await actor.getVideos();
      const sorted = [...result].sort((a, b) =>
        b.uploaded_at > a.uploaded_at ? 1 : -1,
      );
      // Show sample videos if backend has none
      setVideos(sorted.length > 0 ? sorted : SAMPLE_VIDEOS);
    } catch (e) {
      console.error(e);
      // Fall back to sample videos on error
      setVideos(SAMPLE_VIDEOS);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, [actor]);

  useEffect(() => {
    if (!actor || isFetching) return;
    setLoading(true);
    fetchVideos();
  }, [actor, isFetching, fetchVideos]);

  const filteredVideos = videos.filter((v) => {
    const matchesSearch = v.title.toLowerCase().includes(search.toLowerCase());
    const matchesDifficulty =
      difficultyFilter === "all" || v.difficulty === difficultyFilter;
    return matchesSearch && matchesDifficulty;
  });

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actor) return;
    if (!uploadForm.title.trim() || !uploadForm.description.trim()) {
      setUploadError("Title and description are required.");
      return;
    }
    if (!uploadForm.videoUrl.trim()) {
      setUploadError("Please provide a video URL.");
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const difficulty =
        uploadForm.difficulty === "advanced"
          ? VideoDifficulty.advanced
          : VideoDifficulty.beginner;
      await actor.addVideo(
        uploadForm.title.trim(),
        uploadForm.description.trim(),
        uploadForm.videoUrl.trim(),
        uploadForm.thumbnailUrl.trim(),
        difficulty,
      );
      setShowUpload(false);
      setUploadForm({
        title: "",
        description: "",
        videoUrl: "",
        thumbnailUrl: "",
        difficulty: "beginner",
      });
      setLoading(true);
      await fetchVideos();
    } catch (err) {
      console.error(err);
      setUploadError("Failed to upload video. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: bigint) => {
    if (!actor) return;
    try {
      await actor.deleteVideo(id);
      setVideos((prev) => prev.filter((v) => v.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const closePlayerOnBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) setPlayingVideo(null);
  };
  const closePlayerOnKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") setPlayingVideo(null);
  };
  const closeUploadOnBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) setShowUpload(false);
  };
  const closeUploadOnKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") setShowUpload(false);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Video Learning</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Educational content for traders and analysts
          </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            data-ocid="videos.open_modal_button"
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/20 border border-primary/40 text-primary hover:bg-primary/30 transition-all text-sm font-medium"
          >
            <Upload className="w-4 h-4" />
            Upload Video
          </button>
        )}
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            id="video-search"
            type="text"
            placeholder="Search videos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-ocid="videos.search_input"
            className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
          />
        </div>
        <div className="flex gap-2" data-ocid="videos.tab">
          {(["all", "beginner", "advanced"] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDifficultyFilter(d)}
              className={cn(
                "px-3 py-2 rounded-lg text-xs font-medium capitalize border transition-all",
                difficultyFilter === d
                  ? d === "advanced"
                    ? "bg-purple-500/20 border-purple-500/40 text-purple-400"
                    : d === "beginner"
                      ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                      : "bg-primary/20 border-primary/40 text-primary"
                  : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-border/60",
              )}
            >
              {d === "all" ? "All" : d.charAt(0).toUpperCase() + d.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          data-ocid="videos.error_state"
          className="flex items-center gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm"
        >
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div
          data-ocid="videos.loading_state"
          className="flex items-center justify-center py-20"
        >
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filteredVideos.length === 0 && (
        <div
          data-ocid="videos.empty_state"
          className="flex flex-col items-center justify-center py-20 gap-4 text-muted-foreground"
        >
          <div className="w-16 h-16 rounded-full bg-card border border-border flex items-center justify-center">
            <Play className="w-8 h-8 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="font-medium text-foreground">No videos yet</p>
            <p className="text-sm mt-1">
              {isAdmin
                ? "Upload your first video to get started."
                : "Check back soon for educational content."}
            </p>
          </div>
        </div>
      )}

      {/* Video Grid */}
      {!loading && filteredVideos.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredVideos.map((video, idx) => (
            <div
              key={String(video.id)}
              data-ocid={`videos.item.${idx + 1}`}
              className="group bg-card/80 backdrop-blur border border-border rounded-xl overflow-hidden hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5"
            >
              {/* Thumbnail — use a button for semantics */}
              <button
                type="button"
                className="relative w-full aspect-video bg-card overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                onClick={() => setPlayingVideo(video)}
                aria-label={`Play ${video.title}`}
              >
                {video.thumbnailUrl ? (
                  <img
                    src={video.thumbnailUrl}
                    alt={video.title}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <ThumbnailPlaceholder
                    difficulty={video.difficulty}
                    title={video.title}
                  />
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-all duration-300">
                  <div className="w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transform scale-75 group-hover:scale-100 transition-all duration-300 shadow-lg shadow-primary/30">
                    <Play
                      className="w-5 h-5 text-background ml-0.5"
                      fill="currentColor"
                    />
                  </div>
                </div>
              </button>

              {/* Card Body */}
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground line-clamp-2 flex-1">
                    {video.title}
                  </h3>
                  {isAdmin && (
                    <button
                      type="button"
                      data-ocid={`videos.delete_button.${idx + 1}`}
                      onClick={() => handleDelete(video.id)}
                      className="flex-shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Delete video"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <p className="text-xs text-muted-foreground line-clamp-2">
                  {video.description}
                </p>

                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide border",
                      video.difficulty === "advanced"
                        ? "bg-purple-500/15 border-purple-500/30 text-purple-400"
                        : "bg-emerald-500/15 border-emerald-500/30 text-emerald-400",
                    )}
                  >
                    {video.difficulty}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {formatDate(video.uploaded_at)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Video Player Modal */}
      {playingVideo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          data-ocid="videos.modal"
          onClick={closePlayerOnBackdrop}
          onKeyDown={closePlayerOnKey}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: backdrop dismiss
          tabIndex={0}
        >
          <div className="w-full max-w-4xl bg-card border border-border rounded-2xl overflow-hidden shadow-2xl shadow-black/60">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-foreground truncate pr-4">
                {playingVideo.title}
              </h2>
              <button
                type="button"
                data-ocid="videos.close_button"
                onClick={() => setPlayingVideo(null)}
                className="flex-shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-black aspect-video">
              {isYouTube(playingVideo.videoUrl) ? (
                <iframe
                  src={getYouTubeEmbedUrl(playingVideo.videoUrl)}
                  title={playingVideo.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full"
                />
              ) : (
                // biome-ignore lint/a11y/useMediaCaption: user-uploaded educational video
                <video
                  src={playingVideo.videoUrl}
                  controls
                  autoPlay
                  className="w-full h-full"
                />
              )}
            </div>

            <div className="px-5 py-4 space-y-2">
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide border",
                    playingVideo.difficulty === "advanced"
                      ? "bg-purple-500/15 border-purple-500/30 text-purple-400"
                      : "bg-emerald-500/15 border-emerald-500/30 text-emerald-400",
                  )}
                >
                  {playingVideo.difficulty}
                </span>
                <span className="text-xs text-muted-foreground font-mono">
                  {formatDate(playingVideo.uploaded_at)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {playingVideo.description}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          data-ocid="videos.dialog"
          onClick={closeUploadOnBackdrop}
          onKeyDown={closeUploadOnKey}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: backdrop dismiss
          tabIndex={0}
        >
          <div className="w-full max-w-lg bg-card border border-border rounded-2xl overflow-hidden shadow-2xl shadow-black/60">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-foreground">
                Upload Video
              </h2>
              <button
                type="button"
                data-ocid="videos.cancel_button"
                onClick={() => setShowUpload(false)}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleUpload}
              className="p-5 space-y-4 max-h-[80vh] overflow-y-auto"
            >
              {uploadError && (
                <div
                  data-ocid="videos.error_state"
                  className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs"
                >
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {uploadError}
                </div>
              )}

              <div className="space-y-1.5">
                <label
                  htmlFor="upload-title"
                  className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
                >
                  Title <span className="text-red-400">*</span>
                </label>
                <input
                  id="upload-title"
                  type="text"
                  value={uploadForm.title}
                  onChange={(e) =>
                    setUploadForm((p) => ({ ...p, title: e.target.value }))
                  }
                  data-ocid="videos.input"
                  placeholder="e.g. Introduction to Smart Money Concepts"
                  required
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="upload-description"
                  className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
                >
                  Description <span className="text-red-400">*</span>
                </label>
                <textarea
                  id="upload-description"
                  value={uploadForm.description}
                  onChange={(e) =>
                    setUploadForm((p) => ({
                      ...p,
                      description: e.target.value,
                    }))
                  }
                  data-ocid="videos.textarea"
                  placeholder="Describe what viewers will learn..."
                  rows={3}
                  required
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="upload-video-url"
                  className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
                >
                  Video URL
                </label>
                <input
                  id="upload-video-url"
                  type="text"
                  value={uploadForm.videoUrl}
                  onChange={(e) =>
                    setUploadForm((p) => ({ ...p, videoUrl: e.target.value }))
                  }
                  placeholder="https://youtube.com/watch?v=... or direct MP4 URL"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
                />
                <div className="flex items-center gap-3 my-2">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">OR</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <input
                  ref={fileInputRef}
                  id="upload-file"
                  type="file"
                  accept="video/mp4"
                  data-ocid="videos.upload_button"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const objectUrl = URL.createObjectURL(file);
                      setUploadForm((p) => ({ ...p, videoUrl: objectUrl }));
                    }
                  }}
                  className="w-full text-xs text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-primary/20 file:text-primary hover:file:bg-primary/30 cursor-pointer"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="upload-thumbnail"
                  className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
                >
                  Thumbnail URL{" "}
                  <span className="text-muted-foreground/60 normal-case">
                    (optional)
                  </span>
                </label>
                <input
                  id="upload-thumbnail"
                  type="text"
                  value={uploadForm.thumbnailUrl}
                  onChange={(e) =>
                    setUploadForm((p) => ({
                      ...p,
                      thumbnailUrl: e.target.value,
                    }))
                  }
                  placeholder="https://... (leave blank for auto-generated)"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="upload-difficulty"
                  className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
                >
                  Difficulty
                </label>
                <select
                  id="upload-difficulty"
                  value={uploadForm.difficulty}
                  onChange={(e) =>
                    setUploadForm((p) => ({
                      ...p,
                      difficulty: e.target.value as "beginner" | "advanced",
                    }))
                  }
                  data-ocid="videos.select"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary/50 transition-colors"
                >
                  <option value="beginner">Beginner</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  data-ocid="videos.cancel_button"
                  onClick={() => setShowUpload(false)}
                  className="flex-1 px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:border-border/60 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-ocid="videos.submit_button"
                  disabled={uploading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary/20 border border-primary/40 text-primary hover:bg-primary/30 transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Add Video
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
