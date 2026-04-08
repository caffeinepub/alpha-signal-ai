// Gemini 1.5 Flash — routed through backend proxy (never called directly from frontend)
// Backend route: POST /api/gemini
// This avoids CORS issues and keeps the API key secure on the backend.

import { GEMINI_CONFIG } from "../config";

export interface GeminiAnalysisResult {
  trend: string;
  confidence: number;
  signal: string;
  support_level: string;
  resistance_level: string;
  bias: string;
  insight: string;
  summary: string;
  diagnostic?: string;
}

export interface GeminiResearchResult {
  rawText: string;
  executiveSummary: string;
  marketContext: string;
  technicalAnalysis: string;
  tradeBias: string;
  tradeSetup: string;
  overallRating: string;
  diagnostic?: string;
}

export interface GeminiInstitutionalBias {
  bias: "BULLISH" | "BEARISH" | "NEUTRAL";
  confidence: number;
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

/**
 * Core proxy call — routes ALL Gemini requests through the backend proxy at /api/gemini.
 * No retry loop. On failure returns null and logs the error.
 */
async function callBackendProxy(prompt: string): Promise<string | null> {
  console.log("Gemini request sent", { promptLength: prompt.length });
  try {
    const res = await fetch(GEMINI_CONFIG.API_ROUTE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      if (
        res.status === 403 ||
        errText.includes("API_KEY") ||
        errText.includes("INVALID_ARGUMENT") ||
        errText.includes("PERMISSION_DENIED")
      ) {
        console.error("Gemini error", "API key missing or invalid");
        return "__API_NOT_CONFIGURED__";
      }
      console.error("Gemini error", `HTTP ${res.status}: ${errText}`);
      return null;
    }
    const rawResponse: string = await res.text();
    console.log("Gemini response received", {
      length: rawResponse?.length ?? 0,
    });
    if (rawResponse?.startsWith("ERROR:")) {
      const errMsg = rawResponse.slice(6);
      if (
        errMsg.includes("403") ||
        errMsg.includes("API_KEY") ||
        errMsg.includes("INVALID_ARGUMENT") ||
        errMsg.includes("PERMISSION_DENIED")
      ) {
        console.error("Gemini error", "API key missing or invalid");
        return "__API_NOT_CONFIGURED__";
      }
      console.error("Gemini error", errMsg);
      return null;
    }
    return rawResponse;
  } catch (err) {
    console.error("Gemini error", err);
    return null;
  }
}

/**
 * Extract text from raw Gemini JSON response returned by the backend
 */
function extractTextFromRawJson(rawJson: string): string {
  try {
    const parsed = JSON.parse(rawJson);
    const candidates = parsed?.candidates as
      | Array<Record<string, unknown>>
      | undefined;
    const text = (
      (candidates?.[0]?.content as Record<string, unknown>)?.parts as Array<
        Record<string, unknown>
      >
    )?.[0]?.text as string;
    return text ?? "";
  } catch {
    // If it's not JSON, it might already be plain text from an older response path
    return rawJson;
  }
}

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

  const rawJson = await callBackendProxy(prompt);

  if (rawJson === "__API_NOT_CONFIGURED__") {
    return {
      bias: "NEUTRAL",
      confidence: 50,
      alignsWithSFI: true,
      reasoning: "AI not configured properly",
    };
  }

  if (!rawJson) {
    return {
      bias: "NEUTRAL",
      confidence: 50,
      alignsWithSFI: true,
      reasoning: "AI temporarily unavailable",
    };
  }

  const text = extractTextFromRawJson(rawJson);
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

  const rawJson = await callBackendProxy(prompt);

  if (rawJson === "__API_NOT_CONFIGURED__") {
    throw new Error("AI not configured properly");
  }

  if (!rawJson) {
    throw new Error("AI temporarily unavailable");
  }

  const rawText = extractTextFromRawJson(rawJson);

  if (!rawText) {
    throw new Error("AI temporarily unavailable");
  }

  const executiveSummary = extractSection(rawText, "Executive Summary");
  const marketContext = extractSection(rawText, "Market Context");
  const technicalAnalysis = extractSection(rawText, "Technical Analysis");
  const tradeSetup = extractSection(rawText, "Trade Setup", "Trade Setup:");
  const tradeBias = parseTradeBias(
    extractSection(rawText, "Trade Bias", "Trade Bias:") || rawText,
  );

  return {
    rawText,
    executiveSummary: executiveSummary || rawText.substring(0, 400),
    marketContext: marketContext || "",
    technicalAnalysis: technicalAnalysis || "",
    tradeBias,
    tradeSetup: tradeSetup || "",
    overallRating: tradeBias,
  };
}

export async function callGeminiAnalysis(
  symbol: string,
  marketType: string,
): Promise<GeminiAnalysisResult> {
  const prompt = `You are a professional market analyst.
Analyze ${symbol} for ${marketType} market.
Provide a brief analysis. Include your overall bias (BULLISH/BEARISH/NEUTRAL), a confidence percentage (0-100), a signal (BUY/SELL/HOLD), approximate support and resistance levels, and a 2-sentence insight.`;

  const rawJson = await callBackendProxy(prompt);

  if (rawJson === "__API_NOT_CONFIGURED__") {
    return {
      trend: "neutral",
      confidence: 50,
      signal: "HOLD",
      support_level: "N/A",
      resistance_level: "N/A",
      bias: "NEUTRAL",
      insight: "AI not configured properly",
      summary: "AI not configured properly",
      diagnostic: "AI not configured properly",
    };
  }

  if (!rawJson) {
    return {
      trend: "neutral",
      confidence: 50,
      signal: "HOLD",
      support_level: "N/A",
      resistance_level: "N/A",
      bias: "NEUTRAL",
      insight: "AI temporarily unavailable",
      summary: "AI temporarily unavailable",
      diagnostic: "AI temporarily unavailable",
    };
  }

  const text = extractTextFromRawJson(rawJson);
  const biasMatch = text.match(/\b(BULLISH|BEARISH|NEUTRAL)\b/i);
  const confMatch = text.match(/(\d{1,3})\s*%?\s*confidence/i);
  const signalMatch = text.match(/\b(STRONG BUY|STRONG SELL|BUY|SELL|HOLD)\b/i);
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
}

export async function callGeminiRaw(prompt: string): Promise<string> {
  const rawJson = await callBackendProxy(prompt);
  if (rawJson === "__API_NOT_CONFIGURED__") return "AI not configured properly";
  if (!rawJson) return "AI temporarily unavailable";
  return extractTextFromRawJson(rawJson) || "AI temporarily unavailable";
}
