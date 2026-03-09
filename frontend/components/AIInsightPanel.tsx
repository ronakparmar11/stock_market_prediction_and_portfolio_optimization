"use client";
import { useState, useEffect, useRef } from "react";
import { Brain, Loader2, Sparkles, RefreshCw } from "lucide-react";

interface AIInsightPanelProps {
  onFetch: () => Promise<string>;
  title?: string;
  autoFetch?: boolean;
  className?: string;
}

export default function AIInsightPanel({
  onFetch,
  title = "AI Insight",
  autoFetch = false,
  className = "",
}: AIInsightPanelProps) {
  const [insight, setInsight] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const hasAutoFetched = useRef(false);

  const fetchInsight = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await onFetch();
      setInsight(result);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "AI service unavailable. Try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (autoFetch && !hasAutoFetched.current) {
      hasAutoFetched.current = true;
      fetchInsight();
    }
  }, [autoFetch]);

  return (
    <div className={`ai-panel ${className}`}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: "linear-gradient(135deg, #4c1d95, #8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 16px rgba(139,92,246,0.35)",
          }}>
            <Sparkles size={15} color="white" />
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#a78bfa", letterSpacing: "0.5px" }}>AI ANALYSIS</p>
            <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{title}</p>
          </div>
        </div>
        <button
          onClick={fetchInsight}
          disabled={loading}
          style={{
            background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.25)",
            borderRadius: 8, padding: "6px 12px", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6,
            color: "#a78bfa", fontSize: 12, fontWeight: 600,
          }}
        >
          {loading ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <RefreshCw size={12} />}
          {loading ? "Analyzing..." : insight ? "Refresh" : "Analyze"}
        </button>
      </div>

      {/* Content */}
      {loading && (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div className="skeleton" style={{ height: 14, marginBottom: 8, width: "95%" }} />
            <div className="skeleton" style={{ height: 14, marginBottom: 8, width: "80%" }} />
            <div className="skeleton" style={{ height: 14, width: "65%" }} />
          </div>
        </div>
      )}

      {error && !loading && (
        <p style={{ fontSize: 12.5, color: "var(--accent-red)", lineHeight: 1.6 }}>
          ⚠ {error}
        </p>
      )}

      {insight && !loading && (
        <div>
          <p style={{
            fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.75,
            fontStyle: "normal", borderLeft: "2px solid rgba(139,92,246,0.4)",
            paddingLeft: 12, margin: 0,
          }}>
            {insight}
          </p>
          <p style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 10, fontStyle: "italic" }}>
            Powered by Llama 3.1 8B via Featherless AI · For informational purposes only
          </p>
        </div>
      )}

      {!insight && !loading && !error && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, opacity: 0.6 }}>
          <Brain size={28} color="#8b5cf6" />
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.6 }}>
            Click "Analyze" to get AI-powered insights from Llama 3.1.
          </p>
        </div>
      )}
    </div>
  );
}
