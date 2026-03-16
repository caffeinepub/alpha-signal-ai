const GEMINI_API_KEY = "AIzaSyDPrQUkncKjaT6DcthPtdlzJCp9qb5-zOA";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

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
        generationConfig: {
          temperature: 0.3,
          responseMimeType: "application/json",
        },
      }),
    });
    const data = await response.json();
    const text = data.candidates[0].content.parts[0].text;
    return JSON.parse(text);
  } catch (error) {
    console.error("[Gemini Frontend] Analysis failed:", error);
    return {
      trend: "neutral",
      confidence: 50,
      signal: "HOLD",
      support_level: "N/A",
      resistance_level: "N/A",
      bias: "NEUTRAL",
      insight: "Analysis temporarily unavailable. Please retry.",
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
    console.error("[Gemini Frontend] Raw call failed:", error);
    return "";
  }
}
