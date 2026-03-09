"use client";
import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line, Legend, ReferenceLine,
} from "recharts";
import { Search, TrendingUp, TrendingDown, Info, ChevronRight } from "lucide-react";
import { fetchStockHistory, fetchStockInfo, searchStocks, fetchStockInsight } from "@/lib/api";
import CandlestickChart from "@/components/CandlestickChart";
import AIInsightPanel from "@/components/AIInsightPanel";

const PERIODS = [
  { label: "1M", value: "1mo" }, { label: "3M", value: "3mo" },
  { label: "6M", value: "6mo" }, { label: "1Y", value: "1y" },
  { label: "2Y", value: "2y" },  { label: "5Y", value: "5y" },
];
const CHART_TABS = ["Candlestick", "Line", "RSI", "MACD", "Volume"];

function fmt(n: number | null | undefined, d = 2) {
  if (n == null) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: d });
}
function fmtMcap(n?: number) {
  if (!n) return "—";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}
const formatDate = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: 12, padding: "12px 16px", fontSize: 12 }}>
      <p style={{ color: "var(--text-muted)", marginBottom: 6, fontWeight: 600 }}>{formatDate(label)}</p>
      {d?.close   != null && <p style={{ color: "var(--text-primary)" }}>Close <span className="mono" style={{ float: "right", paddingLeft: 16, fontWeight: 700 }}>${d.close}</span></p>}
      {d?.open    != null && <p style={{ color: "var(--text-secondary)" }}>Open  <span className="mono" style={{ float: "right", paddingLeft: 16 }}>${d.open}</span></p>}
      {d?.high    != null && <p style={{ color: "#10b981" }}>High  <span className="mono" style={{ float: "right", paddingLeft: 16 }}>${d.high}</span></p>}
      {d?.low     != null && <p style={{ color: "#ef4444" }}>Low   <span className="mono" style={{ float: "right", paddingLeft: 16 }}>${d.low}</span></p>}
      {d?.ma50    != null && <p style={{ color: "#f59e0b" }}>MA50  <span className="mono" style={{ float: "right", paddingLeft: 16 }}>${d.ma50}</span></p>}
      {d?.ma200   != null && <p style={{ color: "#8b5cf6" }}>MA200 <span className="mono" style={{ float: "right", paddingLeft: 16 }}>${d.ma200}</span></p>}
    </div>
  );
};

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="card-metric">
      <p style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 6, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px" }}>{label}</p>
      <p className="mono" style={{ fontSize: 17, fontWeight: 800, color: color || "var(--text-primary)" }}>{value}</p>
      {sub && <p style={{ fontSize: 10.5, color: "var(--text-muted)", marginTop: 3 }}>{sub}</p>}
    </div>
  );
}

export default function StocksPage() {
  const params = useSearchParams();
  const [symbol, setSymbol] = useState(params.get("symbol") || "AAPL");
  const [inputVal, setInputVal] = useState(params.get("symbol") || "AAPL");
  const [period, setPeriod] = useState("1y");
  const [activeTab, setActiveTab] = useState("Candlestick");
  const [history, setHistory] = useState<any[]>([]);
  const [info, setInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [infoLoading, setInfoLoading] = useState(false);
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSugg, setShowSugg] = useState(false);

  const load = useCallback(async (sym: string, per: string) => {
    setLoading(true); setError("");
    try { const r = await fetchStockHistory(sym, per); setHistory(r.data || []); }
    catch { setError("Failed to load data. Check the ticker symbol."); setHistory([]); }
    finally { setLoading(false); }
  }, []);

  const loadInfo = useCallback(async (sym: string) => {
    setInfoLoading(true);
    try { setInfo(await fetchStockInfo(sym)); }
    catch { setInfo(null); }
    finally { setInfoLoading(false); }
  }, []);

  useEffect(() => {
    load(symbol, period);
    loadInfo(symbol);
  }, [symbol, period, load, loadInfo]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const s = inputVal.trim().toUpperCase();
    if (s) { setSymbol(s); setShowSugg(false); }
  };

  const handleSuggInput = async (val: string) => {
    setInputVal(val);
    if (val.length >= 1) {
      try { setSuggestions(await searchStocks(val)); setShowSugg(true); }
      catch { setSuggestions([]); }
    } else { setShowSugg(false); }
  };

  // Derived chart metrics
  const chartUp = history.length >= 2 && history[history.length - 1].close >= history[0].close;
  const lineColor = chartUp ? "#10b981" : "#ef4444";
  const chartMin = history.length ? Math.min(...history.map((d) => d.low || d.close)) * 0.98 : 0;
  const chartMax = history.length ? Math.max(...history.map((d) => d.high || d.close)) * 1.02 : 0;

  const aiFetch = async () => {
    if (!info) throw new Error("No data");
    const last = history[history.length - 1];
    return fetchStockInsight({
      symbol,
      name: info.name || symbol,
      sector: info.sector || "Unknown",
      current_price: info.current_price,
      change_percent: info.change_percent,
      rsi: last?.rsi ?? null,
      ma50: last?.ma50 ?? null,
      ma200: last?.ma200 ?? null,
      volume_ratio: info.volume_ratio ?? null,
      pe_ratio: info.pe_ratio ?? null,
    });
  };

  return (
    <div style={{ padding: "28px 24px 48px", maxWidth: 1440, margin: "0 auto" }}>

      {/* Header row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
        <div>
          <p className="label-tag" style={{ color: "var(--accent-blue)", marginBottom: 6 }}>Stock Analysis</p>
          <h1 style={{ fontSize: "clamp(20px, 2.5vw, 30px)", fontWeight: 800 }} className="heading-gradient">Technical Analytics</h1>
        </div>
        {/* Search */}
        <form onSubmit={handleSearch} style={{ display: "flex", gap: 10 }}>
          <div style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            <input
              value={inputVal}
              onChange={(e) => handleSuggInput(e.target.value)}
              onBlur={() => setTimeout(() => setShowSugg(false), 160)}
              placeholder="Ticker symbol..."
              style={{ paddingLeft: 34, width: 205 }}
              autoComplete="off"
            />
            {showSugg && suggestions.length > 0 && (
              <div style={{ position: "absolute", top: "calc(100% + 5px)", left: 0, right: 0, background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: 12, zIndex: 50, overflow: "hidden" }}>
                {suggestions.slice(0, 6).map((s) => (
                  <div key={s.symbol} className="sugg-item" onMouseDown={() => { setInputVal(s.symbol); setSymbol(s.symbol); setShowSugg(false); }}>
                    <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{s.symbol}</span>
                    <span style={{ color: "var(--text-muted)", marginLeft: 8, fontSize: 12 }}>{s.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button type="submit" className="btn-primary" style={{ padding: "10px 20px" }}>Go</button>
        </form>
      </div>

      {error && <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 10, padding: "12px 16px", marginBottom: 18, color: "var(--accent-red)", fontSize: 13 }}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 22 }} className="stocks-grid">

        {/* Left: Charts */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

          {/* Stock header strip */}
          {(info || infoLoading) && (
            <div className="glass fade-in" style={{ padding: "18px 24px" }}>
              {infoLoading
                ? <div className="skeleton" style={{ height: 60 }} />
                : info && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ width: 48, height: 48, borderRadius: 14, background: "var(--grad-blue)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900, color: "white", flexShrink: 0, boxShadow: "0 4px 16px rgba(59,130,246,0.3)" }}>
                        {symbol.slice(0, 2)}
                      </div>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <h2 style={{ fontSize: 20, fontWeight: 900 }}>{symbol}</h2>
                          <span style={{ fontSize: 11, color: "var(--text-muted)", background: "var(--bg-overlay)", borderRadius: 5, padding: "2px 7px" }}>{info.exchange || ""}</span>
                        </div>
                        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{info.name} · {info.sector}</p>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
                      <div>
                        <p className="mono" style={{ fontSize: 28, fontWeight: 900, lineHeight: 1 }}>${fmt(info.current_price)}</p>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }}>
                          <span className={info.change_percent >= 0 ? "badge-up" : "badge-down"} style={{ fontSize: 12 }}>
                            {info.change_percent >= 0 ? "▲" : "▼"} {Math.abs(info.change_percent).toFixed(2)}%
                          </span>
                          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>({info.change >= 0 ? "+" : ""}{fmt(info.change)})</span>
                        </div>
                      </div>
                      {info.change_percent >= 0 ? <TrendingUp size={28} color="var(--accent-green)" /> : <TrendingDown size={28} color="var(--accent-red)" />}
                    </div>
                  </div>
                )
              }
            </div>
          )}

          {/* Chart card */}
          <div className="glass fade-in-1" style={{ padding: 22 }}>
            {/* Tabs + Period selectors */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
              <div style={{ display: "flex", gap: 5 }}>
                {CHART_TABS.map((t) => <button key={t} onClick={() => setActiveTab(t)} className={`tab-btn ${activeTab === t ? "active" : ""}`}>{t}</button>)}
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                {PERIODS.map((p) => <button key={p.value} onClick={() => setPeriod(p.value)} className={`tab-btn ${period === p.value ? "active" : ""}`}>{p.label}</button>)}
              </div>
            </div>

            {loading
              ? <div className="skeleton" style={{ height: 360, borderRadius: 12 }} />
              : history.length === 0
                ? <div style={{ height: 360, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>No data available</div>
                : <>
                  {activeTab === "Candlestick" && <CandlestickChart data={history} height={360} showVolume />}

                  {activeTab === "Line" && (
                    <ResponsiveContainer width="100%" height={360}>
                      <AreaChart data={history} margin={{ left: 8, right: 8 }}>
                        <defs>
                          <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={lineColor} stopOpacity={0.2} />
                            <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                        <YAxis domain={[chartMin, chartMax]} tick={{ fontSize: 10 }} width={68} tickFormatter={(v) => `$${v.toFixed(0)}`} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        {history[0]?.bb_upper && <Area type="monotone" dataKey="bb_upper" stroke="rgba(59,130,246,0.2)" strokeWidth={1} fill="none" dot={false} name="BB Upper" legendType="none" />}
                        {history[0]?.bb_lower && <Area type="monotone" dataKey="bb_lower" stroke="rgba(59,130,246,0.2)" strokeWidth={1} fill="none" dot={false} name="BB Lower" legendType="none" />}
                        <Area type="monotone" dataKey="close" stroke={lineColor} strokeWidth={2} fill="url(#lineGrad)" dot={false} name="Price" />
                        {history[0]?.ma50  && <Line type="monotone" dataKey="ma50"  stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="5 3" dot={false} name="MA 50" />}
                        {history[0]?.ma200 && <Line type="monotone" dataKey="ma200" stroke="#8b5cf6" strokeWidth={1.5} strokeDasharray="5 3" dot={false} name="MA 200" />}
                      </AreaChart>
                    </ResponsiveContainer>
                  )}

                  {activeTab === "RSI" && (
                    <ResponsiveContainer width="100%" height={360}>
                      <LineChart data={history} margin={{ left: 8, right: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} width={40} />
                        <Tooltip contentStyle={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: 12, fontSize: 12 }} labelFormatter={(l: any) => formatDate(l)} formatter={(v: any) => [Number(v).toFixed(2), "RSI"]} />
                        <ReferenceLine y={70} stroke="rgba(239,68,68,0.5)" strokeDasharray="4 2" label={{ value: "Overbought 70", fill: "#ef4444", fontSize: 10 }} />
                        <ReferenceLine y={50} stroke="rgba(255,255,255,0.1)" strokeDasharray="3 3" />
                        <ReferenceLine y={30} stroke="rgba(16,185,129,0.5)" strokeDasharray="4 2" label={{ value: "Oversold 30", fill: "#10b981", fontSize: 10 }} />
                        <Line type="monotone" dataKey="rsi" stroke="#a78bfa" strokeWidth={2} dot={false} name="RSI (14)" />
                      </LineChart>
                    </ResponsiveContainer>
                  )}

                  {activeTab === "MACD" && (
                    <ResponsiveContainer width="100%" height={360}>
                      <LineChart data={history} margin={{ left: 8, right: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                        <YAxis tick={{ fontSize: 10 }} width={56} />
                        <Tooltip contentStyle={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: 12, fontSize: 12 }} labelFormatter={(l: any) => formatDate(l)} formatter={(v: any) => [Number(v).toFixed(4), ""]} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" />
                        <Bar dataKey="macd_hist" fill="#3b82f6" opacity={0.4} name="Histogram" />
                        <Line type="monotone" dataKey="macd" stroke="#10b981" strokeWidth={2} dot={false} name="MACD" />
                        <Line type="monotone" dataKey="macd_signal" stroke="#f59e0b" strokeWidth={1.5} dot={false} name="Signal" />
                      </LineChart>
                    </ResponsiveContainer>
                  )}

                  {activeTab === "Volume" && (
                    <ResponsiveContainer width="100%" height={360}>
                      <BarChart data={history} margin={{ left: 8, right: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                        <YAxis tick={{ fontSize: 10 }} width={70} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
                        <Tooltip contentStyle={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: 12, fontSize: 12 }} formatter={(v: any) => [`${(Number(v) / 1e6).toFixed(2)}M`, "Volume"]} labelFormatter={(l: any) => formatDate(l)} />
                        <Bar dataKey="volume" fill="#3b82f6" opacity={0.65} radius={[2, 2, 0, 0]} name="Volume" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </>
            }
          </div>

          {/* Stat row */}
          {!loading && history.length > 0 && (() => {
            const last = history[history.length - 1];
            const first = history[0];
            const totalReturn = ((last.close - first.close) / first.close * 100);
            const highs = history.map((d) => d.high || d.close);
            const lows  = history.map((d) => d.low  || d.close);
            return (
              <div className="fade-in-2" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <StatCard label="Current" value={`$${fmt(last.close)}`} />
                <StatCard label={`${period} Return`} value={`${totalReturn >= 0 ? "+" : ""}${totalReturn.toFixed(2)}%`} color={totalReturn >= 0 ? "var(--accent-green)" : "var(--accent-red)"} />
                <StatCard label="Period High" value={`$${fmt(Math.max(...highs))}`} color="var(--accent-green)" />
                <StatCard label="Period Low" value={`$${fmt(Math.min(...lows))}`} color="var(--accent-red)" />
                {last.rsi   != null && <StatCard label="RSI (14)" value={fmt(last.rsi)} sub={last.rsi > 70 ? "Overbought ⚠" : last.rsi < 30 ? "Oversold 🟢" : "Neutral"} />}
                {last.atr   != null && <StatCard label="ATR" value={`$${fmt(last.atr)}`} sub="14-day" />}
                {last.volatility != null && <StatCard label="Volatility" value={`${fmt(last.volatility)}%`} sub="20-day σ" />}
              </div>
            );
          })()}

          {/* 52W range bar */}
          {info?.fifty_two_week_range_pct != null && (
            <div className="glass-sm fade-in-3" style={{ padding: "16px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>52-WEEK RANGE</span>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Position: <span className="mono" style={{ color: "var(--text-primary)", fontWeight: 700 }}>{info.fifty_two_week_range_pct}%</span></span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${info.fifty_two_week_range_pct}%` }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                <span className="mono" style={{ fontSize: 11, color: "var(--accent-red)" }}>${fmt(info.fifty_two_week_low)}</span>
                <span className="mono" style={{ fontSize: 11, color: "var(--accent-green)" }}>${fmt(info.fifty_two_week_high)}</span>
              </div>
            </div>
          )}

          {/* AI Insight Panel */}
          {info && (
            <div className="fade-in-4">
              <AIInsightPanel onFetch={aiFetch} title={`${symbol} Technical Analysis`} />
            </div>
          )}
        </div>

        {/* Right: Info Sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Stock Details */}
          <div className="glass fade-in-1" style={{ padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <Info size={14} color="var(--accent-blue)" />
              <h3 style={{ fontSize: 13.5, fontWeight: 700 }}>Fundamentals</h3>
            </div>
            {infoLoading
              ? Array(8).fill(0).map((_, i) => <div key={i} className="skeleton" style={{ height: 34, borderRadius: 7, marginBottom: 6 }} />)
              : info
                ? [
                  ["Market Cap", fmtMcap(info.market_cap)],
                  ["P/E Ratio", fmt(info.pe_ratio)],
                  ["Fwd P/E", fmt(info.forward_pe)],
                  ["PEG Ratio", fmt(info.peg_ratio)],
                  ["P/B Ratio", fmt(info.price_to_book)],
                  ["Beta", fmt(info.beta)],
                  ["Div. Yield", info.dividend_yield ? `${(info.dividend_yield * 100).toFixed(2)}%` : "—"],
                  ["Profit Margin", info.profit_margins ? `${(info.profit_margins * 100).toFixed(1)}%` : "—"],
                  ["Revenue Growth", info.revenue_growth ? `${(info.revenue_growth * 100).toFixed(1)}%` : "—"],
                  ["Sector", info.sector || "—"],
                  ["Industry", info.industry || "—"],
                ].map(([label, val]) => (
                  <div key={label} className="stat-row">
                    <span style={{ color: "var(--text-muted)" , fontSize: 12 }}>{label}</span>
                    <span className="mono" style={{ fontSize: 12, fontWeight: 700 }}>{val}</span>
                  </div>
                ))
                : <p style={{ color: "var(--text-muted)", fontSize: 12.5 }}>No data</p>
            }
          </div>

          {/* Volume indicator */}
          {info?.volume_ratio != null && (
            <div className="glass-sm" style={{ padding: "14px 18px" }}>
              <p style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, marginBottom: 8 }}>VOLUME RATIO</p>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <p className="mono" style={{ fontSize: 22, fontWeight: 800, color: info.volume_ratio > 1.5 ? "var(--accent-amber)" : "var(--text-primary)" }}>{info.volume_ratio}x</p>
                <p style={{ fontSize: 11, color: "var(--text-muted)" }}>vs 5-day avg</p>
              </div>
              <div className="progress-track" style={{ marginTop: 8 }}>
                <div className="progress-fill" style={{ width: `${Math.min(100, info.volume_ratio * 40)}%`, background: info.volume_ratio > 1.5 ? "linear-gradient(90deg, #92400e, #f59e0b)" : undefined }} />
              </div>
            </div>
          )}

          {/* About */}
          {info?.description && (
            <div className="glass fade-in-2" style={{ padding: 18 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>About</h3>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.72 }}>{info.description}</p>
            </div>
          )}

          {/* Quick Navigate */}
          <div className="glass-sm" style={{ padding: 18 }}>
            <h3 style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 12, color: "var(--text-secondary)" }}>QUICK NAVIGATE</h3>
            {[
              { label: "ML Prediction", href: `/predictions?symbol=${symbol}`, color: "var(--accent-purple)" },
              { label: "Add to Portfolio", href: `/portfolio?add=${symbol}`, color: "var(--accent-green)" },
            ].map(({ label, href, color }) => (
              <a key={href} href={href} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", textDecoration: "none", padding: "9px 0", borderBottom: "1px solid var(--border-subtle)", color, fontSize: 13, fontWeight: 600 }}>
                {label} <ChevronRight size={14} />
              </a>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .stocks-grid { }
        @media (max-width: 1100px) { .stocks-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}
