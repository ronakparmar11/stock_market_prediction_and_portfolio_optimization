"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ZAxis,
  PieChart, Pie, Cell,
} from "recharts";
import { Plus, X, BarChart2, Target, Sigma, TrendingUp, PieChart as PieIcon, Activity } from "lucide-react";
import { optimizePortfolio, fetchPortfolioInsight, searchStocks } from "@/lib/api";
import AIInsightPanel from "@/components/AIInsightPanel";

const PRESETS = {
  "Tech Giants":   ["AAPL", "MSFT", "GOOGL", "NVDA", "META"],
  "Balanced":      ["SPY", "QQQ", "AGG", "GLD", "VNQ"],
  "High Growth":   ["TSLA", "AMD", "NFLX", "SHOP", "SQ"],
  "Dividend":      ["JNJ", "PEP", "KO", "PG", "MMM"],
};
const PERIOD_OPTIONS = ["6mo", "1y", "2y", "3y"];

const PIE_COLORS = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#a855f7"];

function ChipInput({
  symbols, onAdd, onRemove, onSearch,
}: { symbols: string[]; onAdd: (s: string) => void; onRemove: (s: string) => void; onSearch: (q: string) => Promise<any[]> }) {
  const [val, setVal] = useState("");
  const [sugg, setSugg] = useState<any[]>([]);
  const [show, setShow] = useState(false);

  const handleInput = async (v: string) => {
    setVal(v.toUpperCase());
    if (v.length >= 1) {
      try { setSugg(await onSearch(v)); setShow(true); }
      catch { setSugg([]); }
    } else { setShow(false); }
  };

  const commit = (sym: string) => {
    if (sym && !symbols.includes(sym)) onAdd(sym);
    setVal(""); setShow(false);
  };

  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7, alignItems: "center", background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: 10, padding: "8px 10px", minHeight: 46 }}>
        {symbols.map((s) => (
          <div key={s} style={{
            display: "flex", alignItems: "center", gap: 5, background: "rgba(59,130,246,0.12)",
            border: "1px solid rgba(59,130,246,0.25)", borderRadius: 7, padding: "3px 9px",
            fontSize: 12, fontWeight: 700, color: "var(--accent-blue)",
          }}>
            {s}
            <button onClick={() => onRemove(s)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(59,130,246,0.6)", padding: 0, display: "flex", lineHeight: 1 }}>
              <X size={11} />
            </button>
          </div>
        ))}
        <input
          value={val} onChange={(e) => handleInput(e.target.value)}
          onBlur={() => setTimeout(() => setShow(false), 160)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(val); } }}
          placeholder={symbols.length ? "Add more..." : "Type ticker..."}
          style={{ border: "none", background: "transparent", outline: "none", fontSize: 13, color: "var(--text-primary)", flex: "1 0 80px", padding: 0 }}
        />
        <button onClick={() => commit(val)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent-blue)", display: "flex" }}>
          <Plus size={16} />
        </button>
      </div>
      {show && sugg.length > 0 && (
        <div style={{ position: "absolute", top: "calc(100% + 5px)", left: 0, right: 0, background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: 12, zIndex: 50, overflow: "hidden" }}>
          {sugg.slice(0, 5).map((s) => (
            <div key={s.symbol} className="sugg-item" onMouseDown={() => commit(s.symbol)}>
              <span style={{ fontWeight: 700 }}>{s.symbol}</span>
              <span style={{ color: "var(--text-muted)", marginLeft: 8, fontSize: 12 }}>{s.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CorrelationMatrix({ data }: { data: Record<string, Record<string, number>> }) {
  const symbols = Object.keys(data);
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", fontSize: 11.5 }}>
        <thead>
          <tr>
            <th style={{ width: 56, background: "var(--bg-elevated)" }} />
            {symbols.map((s) => (
              <th key={s} style={{ padding: "7px 8px", textAlign: "center", background: "var(--bg-elevated)", color: "var(--text-secondary)", fontWeight: 700, minWidth: 52 }}>{s}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {symbols.map((rowSym) => (
            <tr key={rowSym}>
              <td style={{ padding: "7px 10px", fontWeight: 700, color: "var(--text-secondary)", background: "var(--bg-elevated)" }}>{rowSym}</td>
              {symbols.map((colSym) => {
                const val = data[rowSym]?.[colSym] ?? 0;
                const abs = Math.abs(val);
                const isPos = val >= 0;
                const bg = val === 1
                  ? "rgba(59,130,246,0.25)"
                  : isPos
                    ? `rgba(59,130,246,${abs * 0.35})`
                    : `rgba(239,68,68,${abs * 0.35})`;
                const textColor = abs > 0.5 ? "#fff" : "var(--text-secondary)";
                return (
                  <td key={colSym} style={{ padding: "7px 8px", textAlign: "center", background: bg, color: textColor, fontWeight: abs > 0.5 ? 700 : 400, borderRadius: 4, border: "2px solid var(--bg-surface)" }}>
                    {val.toFixed(2)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: 12, padding: "12px 16px", fontSize: 12 }}>
      <p style={{ fontWeight: 700, marginBottom: 4, color: d?.sharpe > 1.5 ? "var(--accent-green)" : "var(--text-primary)" }}>{d?.label || "Portfolio"}</p>
      <p>Return: <span className="mono" style={{ fontWeight: 700 }}>{d?.return?.toFixed(2)}%</span></p>
      <p>Risk:   <span className="mono" style={{ fontWeight: 700 }}>{d?.volatility?.toFixed(2)}%</span></p>
      <p>Sharpe: <span className="mono" style={{ fontWeight: 700, color: "var(--accent-blue)" }}>{d?.sharpe?.toFixed(3)}</span></p>
    </div>
  );
};

export default function PortfolioPage() {
  const params = useSearchParams();
  const addParam = params.get("add");

  const [symbols, setSymbols] = useState<string[]>(addParam ? [addParam] : ["AAPL", "MSFT", "GOOGL"]);
  const [period, setPeriod] = useState("1y");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const optimize = async () => {
    if (symbols.length < 2) { setError("Add at least 2 stocks."); return; }
    setLoading(true); setError(""); setResult(null);
    try { setResult(await optimizePortfolio(symbols, period, 5000)); }
    catch (e: any) { setError(e?.response?.data?.detail || "Optimization failed. Try fewer stocks or a longer period."); }
    finally { setLoading(false); }
  };

  const applyPreset = (key: keyof typeof PRESETS) => { setSymbols(PRESETS[key]); };

  // API returns flat: { optimal_weights, expected_return, volatility, sharpe_ratio, ... }
  const hasResult = result && result.optimal_weights;
  const alloc = hasResult
    ? Object.entries(result.optimal_weights).map(([sym, w]: [string, any], i) => ({ name: sym, value: parseFloat(Number(w).toFixed(2)), color: PIE_COLORS[i % PIE_COLORS.length] }))
    : [];
  const efData = (result?.efficient_frontier || []).map((p: any) => ({ return: p.return, volatility: p.volatility, sharpe: p.sharpe }));

  const aiFetch = async () => {
    if (!hasResult) throw new Error("No result");
    const weights: Record<string, number> = {};
    alloc.forEach((a) => { weights[a.name] = a.value; });
    return fetchPortfolioInsight({
      symbols,
      weights,
      expected_return: result.expected_return,
      volatility: result.volatility,
      sharpe_ratio: result.sharpe_ratio,
    });
  };

  return (
    <div style={{ padding: "28px 24px 48px", maxWidth: 1440, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ marginBottom: 26 }}>
        <p className="label-tag" style={{ color: "var(--accent-green)", marginBottom: 6 }}>Portfolio Optimizer</p>
        <h1 style={{ fontSize: "clamp(20px, 2.5vw, 30px)", fontWeight: 800 }} className="heading-gradient">Modern Portfolio Theory</h1>
        <p style={{ fontSize: 13.5, color: "var(--text-muted)", marginTop: 8, maxWidth: 580, lineHeight: 1.7 }}>
          Build and optimize multi-asset portfolios using Sharpe ratio maximization, Monte Carlo simulation (5,000 portfolios), and efficient frontier analysis.
        </p>
      </div>

      {/* Controls */}
      <div className="glass fade-in" style={{ padding: "20px 24px", marginBottom: 22 }}>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-end" }}>

          {/* Stock input */}
          <div style={{ flex: "2 0 300px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <label style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.5px" }}>ADD STOCKS ({symbols.length}/15)</label>
              <div style={{ display: "flex", gap: 6 }}>
                {(Object.keys(PRESETS) as (keyof typeof PRESETS)[]).map((preset) => (
                  <button key={preset} className="btn-ghost" onClick={() => applyPreset(preset)}>{preset}</button>
                ))}
              </div>
            </div>
            <ChipInput
              symbols={symbols}
              onAdd={(s) => { if (symbols.length < 15) setSymbols([...symbols, s]); }}
              onRemove={(s) => setSymbols(symbols.filter((x) => x !== s))}
              onSearch={searchStocks}
            />
          </div>

          {/* Period */}
          <div style={{ flex: "0 0 150px" }}>
            <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 8, fontWeight: 600, letterSpacing: "0.5px" }}>HISTORICAL PERIOD</label>
            <select value={period} onChange={(e) => setPeriod(e.target.value)}>
              {PERIOD_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          {/* Optimize button */}
          <button className="btn-primary" onClick={optimize} disabled={loading} style={{ padding: "11px 28px", alignSelf: "flex-end", flexShrink: 0 }}>
            {loading ? <><span className="spinner" style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.2)", borderTopColor: "white" }} /> Optimizing...</>
                     : <><Sigma size={15} /> Optimize</>}
          </button>
        </div>
        {error && <p style={{ color: "var(--accent-red)", fontSize: 12.5, marginTop: 12 }}>⚠ {error}</p>}
      </div>

      {loading && (
        <div className="glass" style={{ padding: 70, textAlign: "center", marginBottom: 22 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
            <div className="spinner-lg" />
            <div>
              <p style={{ fontWeight: 700, fontSize: 16 }}>Running Monte Carlo Simulation...</p>
              <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 5 }}>Generating 5,000 random portfolios · Maximizing Sharpe ratio · Computing efficient frontier</p>
            </div>
          </div>
        </div>
      )}

      {hasResult && (
        <>
          {/* Key metrics */}
          <div className="fade-in" style={{ display: "flex", gap: 14, marginBottom: 22, flexWrap: "wrap" }}>
            {[
              { label: "Expected Return", value: `${result.expected_return?.toFixed(2)}%`, icon: TrendingUp, color: "var(--accent-green)", bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.2)" },
              { label: "Volatility (Risk)", value: `${result.volatility?.toFixed(2)}%`,        icon: Activity, color: "var(--accent-amber)", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.2)" },
              { label: "Sharpe Ratio",     value: result.sharpe_ratio?.toFixed(4),             icon: Target,   color: "var(--accent-blue)",  bg: "rgba(59,130,246,0.08)", border: "rgba(59,130,246,0.2)" },
              { label: "Portfolios Tested", value: "5,000",                                     icon: BarChart2, color: "var(--accent-purple)", bg: "rgba(139,92,246,0.08)", border: "rgba(139,92,246,0.2)" },
            ].map(({ label, value, icon: Icon, color, bg, border }) => (
              <div key={label} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 14, padding: "16px 20px", flex: "1 0 160px", display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 38, height: 38, borderRadius: 11, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon size={17} color={color} />
                </div>
                <div>
                  <p style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 5 }}>{label}</p>
                  <p className="mono" style={{ fontSize: 20, fontWeight: 900, color }}>{value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Efficient Frontier + Pie */}
          <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 20, marginBottom: 22 }} className="port-top-grid">

            {/* Efficient Frontier */}
            <div className="glass fade-in-1" style={{ padding: 22 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Efficient Frontier</h2>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>5,000 simulated portfolios. <span style={{ color: "var(--accent-amber)" }}>★</span> = Max Sharpe Ratio</p>
              <ResponsiveContainer width="100%" height={320}>
                <ScatterChart margin={{ left: 8, right: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="volatility" name="Risk %" tick={{ fontSize: 10 }} label={{ value: "Volatility (Risk) %", position: "insideBottom", offset: -5, fill: "var(--text-muted)", fontSize: 11 }} />
                  <YAxis dataKey="return"     name="Return %" tick={{ fontSize: 10 }} label={{ value: "Expected Return %", angle: -90, position: "insideLeft", fill: "var(--text-muted)", fontSize: 11 }} />
                  <ZAxis range={[10, 10]} />
                  <Tooltip content={<CustomTooltip />} />
                  <Scatter data={efData} fill="rgba(59,130,246,0.35)" shape="circle" />
                  <Scatter
                    data={[{ return: result.expected_return, volatility: result.volatility, sharpe: result.sharpe_ratio, label: "★ Optimal" }]}
                    fill="#f59e0b" shape="star"
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>

            {/* Allocation Pie */}
            <div className="glass fade-in-2" style={{ padding: 22, display: "flex", flexDirection: "column" }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Optimal Allocation</h2>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>Maximum Sharpe Ratio Portfolio</p>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={alloc} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={46} paddingAngle={3}>
                    {alloc.map((entry, i) => <Cell key={i} fill={entry.color} strokeWidth={0} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => [`${v}%`, "Allocation"]} contentStyle={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 8 }}>
                {alloc.map((a) => (
                  <div key={a.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: a.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 12.5, fontWeight: 700 }}>{a.name}</span>
                    </div>
                    <span className="mono" style={{ fontSize: 12.5, color: a.color, fontWeight: 700 }}>{a.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Asset Stats + Correlation */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 22 }} className="port-bottom-grid">

            {/* Asset table */}
            {result.individual_stats && (
              <div className="glass fade-in-3" style={{ padding: 22 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Individual Asset Stats</h3>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border-default)" }}>
                        {["Symbol", "Weight", "Ann. Return", "Volatility", "Sharpe"].map((h) => (
                          <th key={h} style={{ textAlign: h === "Symbol" ? "left" : "right", padding: "7px 10px", fontSize: 10, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(result.individual_stats).map(([sym, stats]: [string, any], i) => {
                        const w = result.optimal_weights?.[sym] ?? 0;
                        return (
                          <tr key={sym} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                            <td style={{ padding: "8px 10px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                                <div style={{ width: 8, height: 8, borderRadius: 2, background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                                <span style={{ fontWeight: 800 }}>{sym}</span>
                              </div>
                            </td>
                            <td className="mono" style={{ textAlign: "right", padding: "8px 10px", fontWeight: 700, color: "var(--accent-blue)" }}>{Number(w).toFixed(2)}%</td>
                            <td className="mono" style={{ textAlign: "right", padding: "8px 10px", color: stats.expected_return >= 0 ? "var(--accent-green)" : "var(--accent-red)", fontWeight: 700 }}>
                              {stats.expected_return >= 0 ? "+" : ""}{stats.expected_return?.toFixed(2)}%
                            </td>
                            <td className="mono" style={{ textAlign: "right", padding: "8px 10px" }}>{stats.volatility?.toFixed(2)}%</td>
                            <td className="mono" style={{ textAlign: "right", padding: "8px 10px", color: stats.sharpe >= 1 ? "var(--accent-green)" : "var(--text-secondary)" }}>{stats.sharpe?.toFixed(3)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Correlation matrix */}
            {result.correlation_matrix && (
              <div className="glass fade-in-3" style={{ padding: 22 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Correlation Matrix</h3>
                <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 14 }}>
                  Blue = positive correlation · Red = negative correlation · White = uncorrelated
                </p>
                <CorrelationMatrix data={result.correlation_matrix} />
              </div>
            )}
          </div>

          {/* AI Portfolio Insight */}
          <div className="fade-in-4">
            <AIInsightPanel onFetch={aiFetch} title="Portfolio Risk & Diversification Analysis" />
          </div>
        </>
      )}

      {!hasResult && !loading && (
        <div className="glass" style={{ padding: 90, textAlign: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <PieIcon size={32} color="#10b981" />
            </div>
            <div>
              <p style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>Build Your Portfolio</p>
              <p style={{ fontSize: 13, color: "var(--text-muted)", maxWidth: 420 }}>Add at least 2 stocks or use a preset, select a historical period, and click "Optimize" to compute the efficient frontier and optimal Sharpe ratio allocation.</p>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 1100px) { .port-top-grid, .port-bottom-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}
