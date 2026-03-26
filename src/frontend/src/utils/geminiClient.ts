// Gemini 1.5 Pro — frontend-only calls
// API Key: AIzaSyCywdVJUptlhXCvLn3qpxsqm2mSpYd6QpQ (Master Signal Sync key)
const GEMINI_API_KEY = "AIzaSyCywdVJUptlhXCvLn3qpxsqm2mSpYd6QpQ";
const GEMINI_MODEL = "gemini-1.5-pro";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

export interface GeminiAnalysisResult {
  trend: string;
  confidence: number;
  signal: string;
  support_level: string;
  resistance_level: string;
  bias: string;
  insight: string;
  summary: string;
}

export interface GeminiResearchResult {
  rawText: string;
  executiveSummary: string;
  marketContext: string;
  technicalAnalysis: string;
  tradeBias: string;
  tradeSetup: string;
  overallRating: string;
}

export interface GeminiInstitutionalBias {
  bias: "BULLISH" | "BEARISH" | "NEUTRAL";
  confidence: number; // 0–100
  reasoning: string;
  alignsWithSFI: boolean;
}

function extractSection(text: string, ...headers: string[]): string {
  for (const header of headers) {
    const regex = new RegExp(
      `(?:#{1,3}\\s*)?${header}[:\\s*]*\\n([\\s\\S]*?)(?=\n(?:#{1,3}\\s*)?(?:Executive Summary|Market Context|Technical Analysis|Trade Bias|Trade Setup|Entry|Stop Loss|$))`,
      "i",
    );
    const m = text.match(regex);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  return "";
}

function parseTradeBias(text: string): string {
  if (/STRONG\s*BUY/i.test(text)) return "STRONG BUY";
  if (/STRONG\s*SELL/i.test(text)) return "STRONG SELL";
  if (/\bBUY\b/i.test(text)) return "BUY";
  if (/\bSELL\b/i.test(text)) return "SELL";
  if (/BULLISH/i.test(text)) return "BUY";
  if (/BEARISH/i.test(text)) return "SELL";
  return "HOLD";
}

async function fetchGemini(body: object, retries = 2): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(GEMINI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok || attempt === retries) return res;
      await new Promise((r) => setTimeout(r, 1000));
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error("Gemini fetch failed after retries");
}

// ── Institutional Bias Confirmation ──────────────────────────────────────────
// Used by the SFI signal cards to confirm institutional alignment BEFORE
// the signal is shown. This is DISPLAY/CONFIRMATION only — the SFI state
// machine remains the sole signal authority.

export async function callGeminiInstitutionalBias(
  asset: string,
  sfiSignal: "BUY" | "SELL" | "WAIT",
  currentPrice: number,
  rsi: number,
): Promise<GeminiInstitutionalBias> {
  const prompt = `You are an institutional trading desk analyst.
Asset: ${asset}
Current Price: ${currentPrice}
RSI: ${rsi.toFixed(1)}
SFI Engine Signal: ${sfiSignal}

Briefly assess the institutional bias for ${asset} right now.
Respond in exactly this format (no extra text):
BIAS: BULLISH or BEARISH or NEUTRAL
CONFIDENCE: number 0-100
ALIGNS_WITH_SFI: YES or NO
REASONING: one sentence only`;

  try {
    const response = await fetchGemini({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 150 },
    });
    const data = await response.json();
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    const biasMatch = text.match(/BIAS:\s*(BULLISH|BEARISH|NEUTRAL)/i);
    const confMatch = text.match(/CONFIDENCE:\s*(\d+)/i);
    const alignsMatch = text.match(/ALIGNS_WITH_SFI:\s*(YES|NO)/i);
    const reasoningMatch = text.match(/REASONING:\s*(.+)/i);

    return {
      bias:
        (biasMatch?.[1]?.toUpperCase() as GeminiInstitutionalBias["bias"]) ??
        "NEUTRAL",
      confidence: confMatch ? Math.min(100, Number.parseInt(confMatch[1])) : 50,
      alignsWithSFI: alignsMatch?.[1]?.toUpperCase() === "YES",
      reasoning:
        reasoningMatch?.[1]?.trim() ?? "No additional context available.",
    };
  } catch (err) {
    console.error("[Gemini] callGeminiInstitutionalBias failed:", err);
    return {
      bias: "NEUTRAL",
      confidence: 50,
      alignsWithSFI: true,
      reasoning: "Confirmation unavailable.",
    };
  }
}

export async function callGeminiResearch(
  symbol: string,
  marketType: string,
): Promise<GeminiResearchResult> {
  const prompt = `Generate a professional institutional-level trading analysis for ${symbol} (${marketType}) including:

## Executive Summary
Provide a concise overview of the current market position and key drivers.

## Market Context
Describe the broader market environment, macro factors, and how they affect ${symbol}.

## Technical Analysis
Analyze trend structure, key support/resistance levels, EMA alignment, RSI momentum, volume profile, and Smart Money concepts.

## Trade Bias
State clearly: STRONG BUY, BUY, HOLD, SELL, or STRONG SELL — with detailed reasoning.

## Trade Setup
Entry: [price level]
Stop Loss: [price level]
Target 1: [price level]
Target 2: [price level]

Be specific, data-driven, and professional. Write as an institutional analyst.`;

  const response = await fetchGemini({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.4, maxOutputTokens: 1500 },
  });

  if (!response.ok) {
    const errBody = await response.text();
    console.error(`[Gemini] HTTP ${response.status}:`, errBody);
    throw new Error(
      `Gemini API error ${response.status}: ${response.statusText}`,
    );
  }

  const data = await response.json();
  console.log("[Gemini] Raw response:", JSON.stringify(data, null, 2));

  const rawText: string =
    data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  if (!rawText) {
    const finishReason = data?.candidates?.[0]?.finishReason;
    throw new Error(
      `Gemini returned empty response (finishReason: ${finishReason ?? "unknown"})`,
    );
  }

  const executiveSummary = extractSection(rawText, "Executive Summary");
  const marketContext = extractSection(rawText, "Market Context");
  const technicalAnalysis = extractSection(rawText, "Technical Analysis");
  const tradeSetup = extractSection(rawText, "Trade Setup", "Trade Setup:");
  const tradeBias = parseTradeBias(
    extractSection(rawText, "Trade Bias", "Trade Bias:") || rawText,
  );
  const overallRating = tradeBias;

  return {
    rawText,
    executiveSummary: executiveSummary || rawText.substring(0, 400),
    marketContext: marketContext || "",
    technicalAnalysis: technicalAnalysis || "",
    tradeBias,
    tradeSetup: tradeSetup || "",
    overallRating,
  };
}

export async function callGeminiAnalysis(
  symbol: string,
  marketType: string,
): Promise<GeminiAnalysisResult> {
  const prompt = `You are a professional market analyst.
Analyze ${symbol} for ${marketType} market.
Provide a brief analysis. Include your overall bias (BULLISH/BEARISH/NEUTRAL), a confidence percentage (0-100), a signal (BUY/SELL/HOLD), approximate support and resistance levels, and a 2-sentence insight.`;

  try {
    const response = await fetchGemini({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3 },
    });
    const data = await response.json();
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    const biasMatch = text.match(/\b(BULLISH|BEARISH|NEUTRAL)\b/i);
    const confMatch = text.match(/(\d{1,3})\s*%?\s*confidence/i);
    const signalMatch = text.match(
      /\b(STRONG BUY|STRONG SELL|BUY|SELL|HOLD)\b/i,
    );
    const supportMatch = text.match(/support[^\d]*(\d[\d,\.]+)/i);
    const resistanceMatch = text.match(/resistance[^\d]*(\d[\d,\.]+)/i);

    return {
      trend: biasMatch ? biasMatch[1].toLowerCase() : "neutral",
      confidence: confMatch ? Math.min(100, Number.parseInt(confMatch[1])) : 55,
      signal: signalMatch ? signalMatch[1].toUpperCase() : "HOLD",
      support_level: supportMatch ? supportMatch[1] : "N/A",
      resistance_level: resistanceMatch ? resistanceMatch[1] : "N/A",
      bias: biasMatch ? biasMatch[1].toUpperCase() : "NEUTRAL",
      insight: text.substring(0, 200).replace(/\n/g, " "),
      summary: text.substring(0, 100),
    };
  } catch (error) {
    console.error("[Gemini] callGeminiAnalysis failed:", error);
    return {
      trend: "neutral",
      confidence: 50,
      signal: "HOLD",
      support_level: "N/A",
      resistance_level: "N/A",
      bias: "NEUTRAL",
      insight: "Analysis unavailable. Please retry.",
      summary: "Retry in a moment",
    };
  }
}

export async function callGeminiRaw(prompt: string): Promise<string> {
  try {
    const response = await fetchGemini({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3 },
    });
    const data = await response.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  } catch (error) {
    console.error("[Gemini] callGeminiRaw failed:", error);
    return "";
  }
}
