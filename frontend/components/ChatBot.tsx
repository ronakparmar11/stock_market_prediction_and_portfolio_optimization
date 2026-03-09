"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { MessageSquare, X, Send, Bot, User, ChevronDown, Zap } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

const QUICK_QUESTIONS = [
  "Explain RSI indicator",
  "What is efficient frontier?",
  "How does Golden Cross work?",
  "Explain Sharpe ratio",
  "What is MACD?",
  "How to read Bollinger Bands?",
];

const WELCOME: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "👋 Hi! I'm **AlphaBot**, your AI financial analyst.\n\n" +
    "I can help you understand:\n" +
    "• **Technical indicators** — RSI, MACD, Bollinger Bands, MAs\n" +
    "• **Portfolio theory** — Sharpe ratio, efficient frontier, diversification\n" +
    "• **ML forecasts** — model accuracy, R² scores, prediction confidence\n" +
    "• **Market concepts** — volatility, volume analysis, sector trends\n\n" +
    "What would you like to explore?",
};

// Very simple markdown → React renderer
function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let listBuffer: string[] = [];

  const flushList = (key: string) => {
    if (listBuffer.length > 0) {
      elements.push(
        <ul key={key} style={{ paddingLeft: 16, margin: "6px 0" }}>
          {listBuffer.map((item, i) => (
            <li key={i} style={{ marginBottom: 3 }} dangerouslySetInnerHTML={{ __html: inlineFormat(item) }} />
          ))}
        </ul>
      );
      listBuffer = [];
    }
  };

  const inlineFormat = (s: string): string =>
    s
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em style='color:#14b8a6;font-style:normal'>$1</em>")
      .replace(/`(.+?)`/g, "<code style='background:rgba(255,255,255,0.07);padding:1px 5px;border-radius:4px;font-family:monospace;font-size:11px'>$1</code>");

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("• ") || trimmed.startsWith("- ")) {
      listBuffer.push(trimmed.slice(2));
    } else {
      flushList(`list-${i}`);
      if (trimmed === "") {
        if (elements.length > 0) elements.push(<br key={`br-${i}`} />);
      } else {
        elements.push(
          <p key={i} style={{ margin: "2px 0", lineHeight: 1.72 }}
            dangerouslySetInnerHTML={{ __html: inlineFormat(trimmed) }} />
        );
      }
    }
  });
  flushList("list-end");
  return <>{elements}</>;
}

export default function ChatBot() {
  const [open, setOpen]       = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [unread, setUnread]     = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (open) { scrollToBottom(); setUnread(false); }
  }, [open, messages]);

  const sendMessage = useCallback(async (text: string) => {
    const userText = text.trim();
    if (!userText || loading) return;

    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content: userText };
    const botId = `b-${Date.now()}`;
    const botMsg: Message = { id: botId, role: "assistant", content: "", streaming: true };

    setMessages((prev) => [...prev, userMsg, botMsg]);
    setLoading(true);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "42px";

    abortRef.current = new AbortController();

    try {
      const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }));
      const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const resp = await fetch(`${BASE_URL}/api/ai/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
        signal: abortRef.current.signal,
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.token) {
                accumulated += parsed.token;
                setMessages((prev) =>
                  prev.map((m) => m.id === botId ? { ...m, content: accumulated } : m)
                );
              }
              if (parsed.error) {
                accumulated = parsed.error;
                setMessages((prev) =>
                  prev.map((m) => m.id === botId ? { ...m, content: `⚠ ${accumulated}` } : m)
                );
              }
            } catch {/* skip malformed */ }
          }
        }
      }

      setMessages((prev) => prev.map((m) => m.id === botId ? { ...m, streaming: false } : m));
      if (!open) setUnread(true);
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === botId
              ? { ...m, content: "⚠ Connection error. Is the backend running on :8000?", streaming: false }
              : m
          )
        );
      }
    } finally {
      setLoading(false);
    }
  }, [loading, messages, open]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "42px";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 100)}px`;
  };

  const clearChat = () => setMessages([WELCOME]);

  return (
    <>
      {/* Floating Action Button */}
      <button
        className="chatbot-fab"
        onClick={() => setOpen(!open)}
        aria-label="Open AlphaBot AI"
        style={{ position: "relative" }}
      >
        {open ? <X size={22} color="white" /> : <MessageSquare size={22} color="white" />}
        {unread && !open && (
          <div className="chat-badge">1</div>
        )}
      </button>

      {/* Chat Panel */}
      {open && (
        <div className="chatbot-panel">
          {/* Header */}
          <div className="chatbot-header">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 34, height: 34, borderRadius: "50%",
                background: "rgba(16,185,129,0.2)", border: "1px solid rgba(16,185,129,0.4)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Zap size={16} color="#10b981" fill="#10b981" />
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 800, color: "#e8edf8" }}>AlphaBot</p>
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 1 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981" }} />
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>AI Financial Analyst</span>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={clearChat}
                style={{ background: "rgba(255,255,255,0.08)", border: "none", cursor: "pointer", borderRadius: 7, padding: "5px 9px", color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: 600 }}
              >
                Clear
              </button>
              <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", padding: 2 }}>
                <ChevronDown size={18} />
              </button>
            </div>
          </div>

          {/* Quick Questions (show when only welcome message) */}
          {messages.length <= 1 && (
            <div className="chat-chips">
              {QUICK_QUESTIONS.map((q) => (
                <button key={q} className="chat-chip" onClick={() => sendMessage(q)}>{q}</button>
              ))}
            </div>
          )}

          {/* Messages */}
          <div className="chatbot-messages">
            {messages.map((msg) => (
              <div key={msg.id}>
                {msg.role === "user" ? (
                  <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "flex-end", gap: 7 }}>
                    <div className="chat-bubble-user">{msg.content}</div>
                    <div style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <User size={13} color="#10b981" />
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 7 }}>
                    <div style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 3 }}>
                      <Bot size={13} color="#10b981" />
                    </div>
                    <div className="chat-bubble-bot">
                      {msg.streaming && !msg.content ? (
                        <div className="typing-dots">
                          <span /><span /><span />
                        </div>
                      ) : (
                        <>
                          {renderMarkdown(msg.content)}
                          {msg.streaming && msg.content && (
                            <span style={{ display: "inline-block", width: 7, height: 13, background: "#10b981", borderRadius: 2, marginLeft: 2, animation: "typing-bounce 0.8s ease-in-out infinite", verticalAlign: "bottom" }} />
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Row */}
          <div className="chatbot-input-row">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask about stocks, indicators, portfolio..."
              rows={1}
              disabled={loading}
            />
            <button
              className="chat-send-btn"
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
            >
              <Send size={15} color="white" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
