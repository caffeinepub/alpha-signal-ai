import { Minus, TrendingDown, TrendingUp, Zap } from "lucide-react";
import { motion } from "motion/react";
import type {
  TFDirection,
  TimeframeData,
  TimeframeMatrix,
} from "../hooks/useMultiTimeframe";
import { useMultiTimeframe } from "../hooks/useMultiTimeframe";

// ─────────────────────────────────────────────────────────────────────────────
// Direction helpers
// ─────────────────────────────────────────────────────────────────────────────

function directionClass(dir: TFDirection): string {
  if (dir === "BULLISH") return "text-bull";
  if (dir === "BEARISH") return "text-bear";
  return "text-hold";
}

function directionBgClass(dir: TFDirection): string {
  if (dir === "BULLISH") return "bg-bull/10 border-bull/25";
  if (dir === "BEARISH") return "bg-bear/10 border-bear/25";
  return "bg-hold/10 border-hold/25";
}

function DirectionIcon({
  dir,
  size = "w-3.5 h-3.5",
}: {
  dir: TFDirection;
  size?: string;
}) {
  if (dir === "BULLISH") return <TrendingUp className={`${size} text-bull`} />;
  if (dir === "BEARISH")
    return <TrendingDown className={`${size} text-bear`} />;
  return <Minus className={`${size} text-hold`} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Single timeframe cell
// ─────────────────────────────────────────────────────────────────────────────

function TimeframeCell({
  tf,
  delay,
}: {
  tf: TimeframeData;
  delay: number;
}) {
  const textCls = directionClass(tf.direction);
  const bgCls = directionBgClass(tf.direction);

  return (
    <motion.div
      className={`flex flex-col items-center gap-1 rounded-md p-2 border ${bgCls} transition-all duration-300`}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, delay }}
    >
      {/* Timeframe label */}
      <span className="text-[9px] font-bold font-mono text-muted-foreground uppercase tracking-widest">
        {tf.label}
      </span>

      {/* Direction icon + text */}
      <div className={`flex items-center gap-1 ${textCls}`}>
        <DirectionIcon dir={tf.direction} size="w-3 h-3" />
        <span className="text-[10px] font-bold font-mono">
          {tf.direction === "NEUTRAL" ? "WAIT" : tf.direction.slice(0, 4)}
        </span>
      </div>

      {/* Strength bar */}
      <div className="w-full h-1 bg-secondary rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${
            tf.direction === "BULLISH"
              ? "bg-bull"
              : tf.direction === "BEARISH"
                ? "bg-bear"
                : "bg-hold"
          }`}
          initial={{ width: 0 }}
          animate={{ width: `${tf.strength}%` }}
          transition={{ duration: 0.6, delay: delay + 0.1, ease: "easeOut" }}
        />
      </div>

      {/* Detail text */}
      <span className="text-[8px] text-muted-foreground font-mono text-center leading-tight truncate w-full text-center">
        {tf.detail}
      </span>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Alignment score dots
// ─────────────────────────────────────────────────────────────────────────────

function AlignmentDots({
  score,
  dir,
}: {
  score: number;
  dir: TFDirection;
}) {
  const activeCls =
    dir === "BULLISH" ? "bg-bull" : dir === "BEARISH" ? "bg-bear" : "bg-hold";

  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${
            i < score ? activeCls : "bg-secondary"
          }`}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Single asset matrix card
// ─────────────────────────────────────────────────────────────────────────────

function MatrixCard({
  matrix,
  index,
}: {
  matrix: TimeframeMatrix;
  index: number;
}) {
  const isAligned = matrix.alignmentAllowed;
  const dir = matrix.dominantDirection;

  const alignBadgeCls = isAligned
    ? dir === "BULLISH"
      ? "bg-bull/15 border-bull/40 text-bull"
      : "bg-bear/15 border-bear/40 text-bear"
    : "bg-hold/15 border-hold/40 text-hold";

  const alignLabel = isAligned
    ? `${dir} ALIGNED · SIGNAL ALLOWED`
    : "MISALIGNED · SIGNAL BLOCKED";

  return (
    <motion.div
      className="trading-card p-4"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.12 }}
      data-ocid={`mtf.${matrix.symbol.toLowerCase()}.card`}
    >
      {/* Asset name row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <span className="text-[10px] font-bold font-mono text-primary">
              {matrix.symbol === "GOLD" ? "AU" : matrix.symbol.slice(0, 2)}
            </span>
          </div>
          <div>
            <span className="text-sm font-bold font-mono text-foreground">
              {matrix.symbol}
            </span>
            <span className="text-[10px] text-muted-foreground ml-1.5">
              {matrix.symbol === "BTC" ? "Bitcoin" : "Gold"}
            </span>
          </div>
        </div>

        {/* Dominant direction badge */}
        {dir !== "NEUTRAL" && (
          <div
            className={`flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full border font-bold font-mono ${alignBadgeCls}`}
          >
            <DirectionIcon dir={dir} size="w-2.5 h-2.5" />
            {dir}
          </div>
        )}
      </div>

      {/* 4-column grid */}
      <div className="grid grid-cols-4 gap-1.5 mb-3">
        <TimeframeCell tf={matrix.tf15m} delay={0.05 + index * 0.12} />
        <TimeframeCell tf={matrix.tf5m} delay={0.1 + index * 0.12} />
        <TimeframeCell tf={matrix.tf3m} delay={0.15 + index * 0.12} />
        <TimeframeCell tf={matrix.tf1m} delay={0.2 + index * 0.12} />
      </div>

      {/* Alignment footer */}
      <div className="flex items-center justify-between pt-2 border-t border-border/40">
        {/* Score dots + label */}
        <div className="flex items-center gap-2">
          <AlignmentDots score={matrix.alignmentScore} dir={dir} />
          <span className="text-[10px] text-muted-foreground font-mono">
            {matrix.alignmentScore}/4 Timeframes Aligned
          </span>
        </div>

        {/* Allowed/Blocked badge */}
        <motion.div
          className={`text-[9px] font-bold font-mono px-2 py-0.5 rounded-full border ${alignBadgeCls}`}
          animate={{
            scale: isAligned ? [1, 1.04, 1] : 1,
          }}
          transition={{
            duration: 1.5,
            repeat: isAligned ? Number.POSITIVE_INFINITY : 0,
            ease: "easeInOut",
          }}
          data-ocid={`mtf.${matrix.symbol.toLowerCase()}.${isAligned ? "success_state" : "error_state"}`}
        >
          {alignLabel}
        </motion.div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel
// ─────────────────────────────────────────────────────────────────────────────

export function TrendMatrixPanel() {
  const matrices = useMultiTimeframe();

  if (matrices.length === 0) {
    return (
      <div className="trading-card p-4" data-ocid="mtf.loading_state">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Zap className="w-3.5 h-3.5 animate-pulse" />
          Loading timeframe data…
        </div>
      </div>
    );
  }

  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 gap-4"
      data-ocid="mtf.panel"
    >
      {matrices.map((matrix, i) => (
        <MatrixCard key={matrix.symbol} matrix={matrix} index={i} />
      ))}
    </div>
  );
}
