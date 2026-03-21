const GEMINI_API_KEY = "AIzaSyCL69JXmjihYJkB0nuUu8zfmo-4gURNNkE";
const GEMINI_MODEL = "gemini-1.5-flash";
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

function extractSection(text: string, ...headers: string[]): string {
  for (const header of headers) {
    const regex = new RegExp(
      `(?:#{1,3}\\s*)?${header}[:\s*]*\\n([\\s\\S]*?)(?=\n(?:#{1,3}\\s*)?(?:Executive Summary|Market Context|Technical Analysis|Trade Bias|Trade Setup|Entry|Stop Loss|$))`,
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

  const response = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 1500 },
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    console.error(`[Gemini] HTTP ${response.status}:`, errBody);
    throw new Error(
      `Gemini API error ${response.status}: ${response.statusText}`,
    );
  }

  const data = await response.json();

  // Log raw response for debugging
  console.log("[Gemini] Raw response:", JSON.stringify(data, null, 2));

  const rawText: string =
    data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  if (!rawText) {
    const finishReason = data?.candidates?.[0]?.finishReason;
    console.error("[Gemini] Empty response, finishReason:", finishReason, data);
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
Return ONLY a valid JSON object with these exact fields:
{
  "trend": "bullish" or "bearish" or "neutral",
  "confidence": number between 0-100,
  "signal": "BUY" or "SELL" or "HOLD",
  "support_level": "price level as string",
  "resistance_level": "price level as string", 
  "bias": "BULLISH" or "BEARISH" or "NEUTRAL",
  "insight": "2 sentence professional analysis",
  "summary": "brief summary"
}`;

  try {
    const response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3 },
      }),
    });
    const data = await response.json();
    const text = data.candidates[0].content.parts[0].text;
    // Strip markdown code fences if present
    const clean = text.replace(/```json?\n?|```/g, "").trim();
    return JSON.parse(clean);
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
    const response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3 },
      }),
    });
    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error("[Gemini] callGeminiRaw failed:", error);
    return "";
  }
}
