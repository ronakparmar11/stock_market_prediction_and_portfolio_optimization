"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  TrendingUp, TrendingDown, Activity, BarChart2, PieChart,
  ArrowRight, RefreshCw, Cpu, Globe, Sigma,
} from "lucide-react";
import {
  fetchMarketOverview, fetchStockHistory, fetchSectorPerformance, fetchMarketSummary,
} from "@/lib/api";
import AIInsightPanel from "@/components/AIInsightPanel";

const PREVIEW_STOCKS = ["AAPL", "MSFT", "NVDA", "TSLA", "GOOGL"];
const PERIODS = [{ v: "1mo", l: "1M" }, { v: "3mo", l: "3M" }, { v: "6mo", l: "6M" }, { v: "1y", l: "1Y" }];

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function SparkLine({ symbol }: { symbol: string }) {
  const [pts, setPts] = useState<{ date: string; close: number }[]>([]);
  const [up, setUp] = useState(true);
  useEffect(() => {
    fetchStockHistory(symbol, "3mo").then((r) => {
      const d = (r.data || []).slice(-18);
      setPts(d.map((x: any) => ({ date: x.date, close: x.close })));
      if (d.length >= 2) setUp(d[d.length - 1].close >= d[0].close);
    }).catch(() => {});
  }, [symbol]);

  if (pts.length < 2) return <div className="skeleton" style={{ width: 80, height: 34, borderRadius: 4 }} />;
  const color = up ? "#10b981" : "#ef4444";
  return (
    <ResponsiveContainer width={90} height={36}>
      <AreaChart data={pts} margin={{ top: 2, bottom: 2 }}>
        <defs>
          <linearGradient id={`sg-${symbol}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="close" stroke={color} strokeWidth={1.5} fill={`url(#sg-${symbol})`} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function SectorHeatmap({ data }: { data: any[] }) {
  if (!data.length) return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
      {Array(10).fill(0).map((_, i) => <div key={i} className="skeleton" style={{ height: 72, borderRadius: 10 }} />)}
    </div>
  );

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 8 }}>
      {data.map((s) => {
        const pct = s.change_percent;
        const abs = Math.abs(pct);
        const intensity = Math.min(abs / 3, 1);
        const bg = pct >= 0
          ? `rgba(16,185,129,${0.08 + intensity * 0.22})`
          : `rgba(239,68,68,${0.08 + intensity * 0.22})`;
        const border = pct >= 0
          ? `rgba(16,185,129,${0.15 + intensity * 0.25})`
          : `rgba(239,68,68,${0.15 + intensity * 0.25})`;
        const color = pct >= 0 ? "#10b981" : "#ef4444";

        return (
          <div key={s.sector} className="heatmap-cell" style={{ background: bg, border: `1px solid ${border}` }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4, textAlign: "center" }}>
              {s.sector}
            </p>
            <p className="mono" style={{ fontSize: 14, fontWeight: 800, color }}>{pct >= 0 ? "+" : ""}{pct.toFixed(2)}%</p>
          </div>
        );
      })}
    </div>
  );
}

export default function DashboardPage() {
  const [overview, setOverview] = useState<any>(null);
  const [sectors, setSectors] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [activeStock, setActiveStock] = useState("AAPL");
  const [activePeriod, setActivePeriod] = useState("6mo");
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      fetchMarketOverview(),
      fetchSectorPerformance().catch(() => []),
    ]).then(([ov, sec]) => {
      setOverview(ov);
      setSectors(sec || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    setChartLoading(true);
    fetchStockHistory(activeStock, activePeriod)
      .then((r) => { setChartData(r.data || []); setChartLoading(false); })
      .catch(() => setChartLoading(false));
  }, [activeStock, activePeriod]);

  const chartUp = chartData.length >= 2 && chartData[chartData.length - 1].close >= chartData[0].close;
  const lineColor = chartUp ? "#10b981" : "#ef4444";
  const chartMin = chartData.length ? Math.min(...chartData.map((d) => d.close)) * 0.98 : 0;
  const chartMax = chartData.length ? Math.max(...chartData.map((d) => d.close)) * 1.02 : 0;

  const handleMarketAI = () => {
    if (!overview) throw new Error("No data");
    return fetchMarketSummary({
      indices: overview.indices || [],
      top_gainers: overview.top_gainers || [],
      top_losers: overview.top_losers || [],
    });
  };

  return (
    <div style={{ padding: "28px 24px 48px", maxWidth: 1440, margin: "0 auto" }}>

      {/* ── Hero ── */}
      <div className="fade-in" style={{
        background: "linear-gradient(135deg, #141c22 0%, #1a3828 50%, #141c22 100%)",
        border: "1px solid rgba(16,185,129,0.15)",
        borderRadius: "22px", padding: "36px 44px", marginBottom: "28px",
        position: "relative", overflow: "hidden",
      }}>
        {/* Radial glow blobs */}
        <div style={{ position: "absolute", top: -80, right: -60, width: 320, height: 320, borderRadius: "50%", background: "radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -60, left: 160, width: 240, height: 240, borderRadius: "50%", background: "radial-gradient(circle, rgba(245,158,11,0.07) 0%, transparent 70%)", pointerEvents: "none" }} />

        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#60a5fa", boxShadow: "0 0 12px #3b82f6" }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: "#60a5fa", letterSpacing: "2.5px", textTransform: "uppercase" }}>
              AI-Powered Financial Analytics
            </span>
          </div>
          <h1 style={{
            fontSize: "clamp(26px, 3.5vw, 48px)", fontWeight: 900, lineHeight: 1.1, marginBottom: 14,
            background: "linear-gradient(90deg, #e8edf8 0%, #93c5fd 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>
            Stock Market Prediction<br />& Portfolio Optimization
          </h1>
          <p style={{ fontSize: 14.5, color: "rgba(255,255,255,0.4)", maxWidth: 560, lineHeight: 1.75, marginBottom: 28 }}>
            Analyze historical trends, forecast prices with ensemble ML models, and optimize portfolios using Modern Portfolio Theory — all with AI-powered insights.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/stocks" className="btn-primary" style={{ padding: "11px 26px" }}>
              <TrendingUp size={15} /> Analyze Stocks <ArrowRight size={13} />
            </Link>
            <Link href="/portfolio" className="btn-outline" style={{ padding: "11px 22px" }}>
              <PieChart size={15} /> Optimize Portfolio
            </Link>
            <Link href="/predictions" className="btn-outline" style={{ padding: "11px 22px" }}>
              <Cpu size={15} /> ML Predictions
            </Link>
          </div>
        </div>
      </div>

      {/* ── Market Indices ── */}
      <div className="fade-in-1" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 14, marginBottom: 24 }}>
        {loading
          ? Array(4).fill(0).map((_, i) => <div key={i} className="skeleton" style={{ height: 92, borderRadius: 14 }} />)
          : overview?.indices?.map((idx: any) => (
            <div key={idx.symbol} className="card-metric">
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>{idx.name}</p>
              <p className="mono" style={{ fontSize: 21, fontWeight: 800, marginBottom: 6 }}>
                {idx.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </p>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span className={idx.change_percent >= 0 ? "badge-up" : "badge-down"}>
                  {idx.change_percent >= 0 ? "▲" : "▼"} {Math.abs(idx.change_percent).toFixed(2)}%
                </span>
                {idx.change_percent >= 0 ? <TrendingUp size={14} color="var(--accent-green)" /> : <TrendingDown size={14} color="var(--accent-red)" />}
              </div>
            </div>
          ))
        }
      </div>

      {/* ── Chart + Trending Grid ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 20, marginBottom: 24 }} className="dash-main-grid">

        {/* Main chart */}
        <div className="glass fade-in-2" style={{ padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
            <div>
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, fontWeight: 600, letterSpacing: "0.5px" }}>WATCHING</p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {PREVIEW_STOCKS.map((s) => (
                  <button key={s} onClick={() => setActiveStock(s)} className={`tab-btn ${activeStock === s ? "active" : ""}`}>{s}</button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 5 }}>
              {PERIODS.map((p) => (
                <button key={p.v} onClick={() => setActivePeriod(p.v)} className={`tab-btn ${activePeriod === p.v ? "active" : ""}`}>{p.l}</button>
              ))}
            </div>
          </div>

          {chartLoading
            ? <div className="skeleton" style={{ height: 280, borderRadius: 12 }} />
            : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={chartData} margin={{ left: 8, right: 8 }}>
                  <defs>
                    <linearGradient id="dashGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={lineColor} stopOpacity={0.22} />
                      <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis domain={[chartMin, chartMax]} tick={{ fontSize: 10 }} width={66} tickFormatter={(v) => `$${v.toFixed(0)}`} />
                  <Tooltip
                    contentStyle={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: 12, fontSize: 12.5 }}
                    formatter={(v: any) => [`$${Number(v).toFixed(2)}`, "Close"]}
                    labelFormatter={(l: any) => formatDate(l)}
                  />
                  <Area type="monotone" dataKey="close" stroke={lineColor} strokeWidth={2} fill="url(#dashGrad)" dot={false} name="Price" />
                  {chartData[0]?.ma50 && <Area type="monotone" dataKey="ma50" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="5 3" fill="none" dot={false} name="MA50" />}
                  {chartData[0]?.ma200 && <Area type="monotone" dataKey="ma200" stroke="#8b5cf6" strokeWidth={1.5} strokeDasharray="5 3" fill="none" dot={false} name="MA200" />}
                </AreaChart>
              </ResponsiveContainer>
            )
          }
          <div style={{ display: "flex", gap: 18, marginTop: 12, fontSize: 11.5, color: "var(--text-muted)" }}>
            <span><span style={{ color: lineColor }}>—</span> Price</span>
            <span><span style={{ color: "#f59e0b" }}>- -</span> MA50</span>
            <span><span style={{ color: "#8b5cf6" }}>- -</span> MA200</span>
          </div>
        </div>

        {/* Trending + Gainers/Losers */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Top Gainers */}
          <div className="glass fade-in-3" style={{ padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>Top Gainers</p>
              <TrendingUp size={13} color="var(--accent-green)" />
            </div>
            {loading ? Array(3).fill(0).map((_, i) => <div key={i} className="skeleton" style={{ height: 36, borderRadius: 8, marginBottom: 6 }} />) : (
              (overview?.top_gainers || []).slice(0, 4).map((s: any) => (
                <Link key={s.symbol} href={`/stocks?symbol=${s.symbol}`} style={{ textDecoration: "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: "1px solid var(--border-subtle)", cursor: "pointer" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 7, background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: "#10b981" }}>{s.symbol.slice(0, 2)}</div>
                      <span style={{ fontSize: 12.5, fontWeight: 700 }}>{s.symbol}</span>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p className="mono" style={{ fontSize: 12, fontWeight: 700 }}>${s.current_price}</p>
                      <span className="badge-up" style={{ fontSize: 10, padding: "1px 5px" }}>+{s.change_percent.toFixed(2)}%</span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>

          {/* Top Losers */}
          <div className="glass fade-in-3" style={{ padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>Top Losers</p>
              <TrendingDown size={13} color="var(--accent-red)" />
            </div>
            {loading ? Array(3).fill(0).map((_, i) => <div key={i} className="skeleton" style={{ height: 36, borderRadius: 8, marginBottom: 6 }} />) : (
              (overview?.top_losers || []).slice(0, 4).map((s: any) => (
                <Link key={s.symbol} href={`/stocks?symbol=${s.symbol}`} style={{ textDecoration: "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: "1px solid var(--border-subtle)", cursor: "pointer" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 7, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: "#ef4444" }}>{s.symbol.slice(0, 2)}</div>
                      <span style={{ fontSize: 12.5, fontWeight: 700 }}>{s.symbol}</span>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p className="mono" style={{ fontSize: 12, fontWeight: 700 }}>${s.current_price}</p>
                      <span className="badge-down" style={{ fontSize: 10, padding: "1px 5px" }}>{s.change_percent.toFixed(2)}%</span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Sector Heatmap ── */}
      <div className="glass fade-in-3" style={{ padding: 24, marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <p style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.5px", marginBottom: 3 }}>SECTOR PERFORMANCE</p>
            <h2 style={{ fontSize: 15, fontWeight: 700 }}>Market Heatmap</h2>
          </div>
          <Globe size={16} color="var(--text-muted)" />
        </div>
        <SectorHeatmap data={sectors} />
      </div>

      {/* ── Trending Stocks scrollbar row ── */}
      <div className="glass fade-in-3" style={{ padding: 24, marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700 }}>Trending Stocks</h2>
          <Activity size={15} color="var(--accent-blue)" />
        </div>
        <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 4 }}>
          {loading
            ? Array(8).fill(0).map((_, i) => <div key={i} className="skeleton" style={{ width: 150, height: 78, borderRadius: 12, flexShrink: 0 }} />)
            : overview?.trending?.slice(0, 8).map((s: any) => (
              <Link key={s.symbol} href={`/stocks?symbol=${s.symbol}`} style={{ textDecoration: "none", flexShrink: 0 }}>
                <div style={{
                  width: 150, padding: "14px 16px", borderRadius: 12,
                  background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)",
                  cursor: "pointer", transition: "all 0.2s",
                }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(59,130,246,0.3)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border-subtle)"; }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 26, height: 26, borderRadius: 7, background: "var(--grad-blue)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: "white" }}>{s.symbol.slice(0, 2)}</div>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{s.symbol}</span>
                  </div>
                  <SparkLine symbol={s.symbol} />
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
                    <p className="mono" style={{ fontSize: 13, fontWeight: 700 }}>${s.current_price}</p>
                    <span className={s.change_percent >= 0 ? "badge-up" : "badge-down"} style={{ fontSize: 9, padding: "1px 5px" }}>
                      {s.change_percent >= 0 ? "+" : ""}{s.change_percent.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </Link>
            ))
          }
        </div>
      </div>

      {/* ── AI Market Summary + Feature Cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20, marginBottom: 24 }} className="dash-features-grid">
        {[
          { icon: BarChart2, color: "#3b82f6", grad: "var(--grad-blue)", title: "Stock Analysis", desc: "RSI, MACD, Bollinger Bands, candlestick charts, and full technical analytics.", href: "/stocks", cta: "Analyze" },
          { icon: Cpu, color: "#8b5cf6", grad: "var(--grad-purple)", title: "ML Predictions", desc: "Forecast prices with Random Forest, Gradient Boosting, Linear, and SVR models.", href: "/predictions", cta: "Predict" },
          { icon: Sigma, color: "#10b981", grad: "var(--grad-green)", title: "Portfolio Optimizer", desc: "Modern Portfolio Theory, Sharpe ratio maximization, and efficient frontier.", href: "/portfolio", cta: "Optimize" },
        ].map(({ icon: Icon, color, grad, title, desc, href, cta }) => (
          <Link key={href} href={href} style={{ textDecoration: "none" }}>
            <div className="glass" style={{ padding: 26, height: "100%", cursor: "pointer" }}>
              <div style={{ width: 44, height: 44, borderRadius: 13, background: grad, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16, boxShadow: `0 4px 16px ${color}44` }}>
                <Icon size={20} color="white" />
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{title}</h3>
              <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.65, marginBottom: 18 }}>{desc}</p>
              <span style={{ fontSize: 12.5, fontWeight: 700, color }}>{cta} →</span>
            </div>
          </Link>
        ))}
      </div>

      {/* ── AI Market Commentary ── */}
      {overview && (
        <div className="fade-in-4">
          <AIInsightPanel
            onFetch={handleMarketAI}
            title="Daily Market Commentary"
          />
        </div>
      )}

      <style>{`
        .dash-main-grid { }
        @media (max-width: 1100px) { .dash-main-grid { grid-template-columns: 1fr !important; } }
        @media (max-width: 900px)  { .dash-features-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}
