// Gemini API configuration — frontend routes all calls through the backend proxy.
// The API key is stored securely in the backend environment, never exposed here.

export const GEMINI_CONFIG = {
  API_ROUTE: "/api/gemini",
} as const;
