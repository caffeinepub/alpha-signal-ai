import { Send } from "lucide-react";
import { useRef, useState } from "react";
import CompactSFIWidget from "../components/CompactSFIWidget";
import { callGeminiRaw } from "../utils/geminiClient";

const SYSTEM_PROMPT =
  "You are Alpha Signal AI, a professional trading assistant. Be concise and actionable. Focus on BTC, gold (XAU/USD), and EUR/USD trading analysis.";

interface Message {
  id: number;
  role: "user" | "ai";
  text: string;
}

async function askGemini(
  history: Message[],
  userText: string,
): Promise<string> {
  const contextLines = history
    .slice(-6) // keep last 6 messages for context
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.text}`)
    .join("\n");
  const prompt = `${SYSTEM_PROMPT}\n\nConversation so far:\n${contextLines}\n\nUser: ${userText}\nAssistant:`;
  console.log("[Chat] Request sent to backend proxy");
  const reply = await callGeminiRaw(prompt);
  console.log("[Chat] Response received", { length: reply.length });
  return reply || "AI temporarily unavailable";
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 0,
      role: "ai",
      text: "👋 Hello! I'm Alpha Signal AI. Ask me anything about BTC, XAU/USD, or EUR/USD — signals, analysis, risk management.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(1);

  function scrollToBottom() {
    setTimeout(
      () => bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
      50,
    );
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");

    const userMsg: Message = { id: idRef.current++, role: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    scrollToBottom();
    setLoading(true);

    try {
      const reply = await askGemini(messages, text);
      setMessages((prev) => [
        ...prev,
        { id: idRef.current++, role: "ai", text: reply },
      ]);
    } catch {
      console.error("[Chat] Error during Gemini call");
      setMessages((prev) => [
        ...prev,
        {
          id: idRef.current++,
          role: "ai",
          text: "⚠️ AI temporarily unavailable. Please retry.",
        },
      ]);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex flex-col h-full" data-ocid="chat.page">
      {/* Page header */}
      <div className="px-6 pt-5 pb-3 border-b border-white/5">
        <h1 className="text-xl font-bold text-white">AI Market Chat</h1>
        <p className="text-gray-400 text-sm">
          Ask anything about markets, signals, or trading
        </p>
      </div>

      {/* Message list */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
        data-ocid="chat.list"
      >
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${
              m.role === "user" ? "justify-end" : "justify-start"
            }`}
            data-ocid={`chat.item.${m.id}`}
          >
            <div
              className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-blue-600 text-white rounded-br-sm"
                  : "bg-gray-800 text-gray-100 rounded-bl-sm"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start" data-ocid="chat.loading_state">
            <div className="bg-gray-800 px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-2 text-gray-400 text-sm">
              <span className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:300ms]" />
              </span>
              Analyzing…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area + Compact widget */}
      <div className="px-4 pb-4 pt-2 space-y-3 border-t border-white/5">
        {/* Input row */}
        <div className="flex gap-2">
          <input
            data-ocid="chat.input"
            type="text"
            className="flex-1 bg-gray-900 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50 transition-colors"
            placeholder="Ask about BTC, XAU/USD, EUR/USD signals…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
          />
          <button
            type="button"
            data-ocid="chat.submit_button"
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="w-12 h-12 flex items-center justify-center rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Compact SFI widget */}
        <CompactSFIWidget />
      </div>
    </div>
  );
}
