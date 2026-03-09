"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, ReferenceLine,
} from "recharts";
import {
  Brain, Search, Zap, Target, TrendingUp, TrendingDown,
  AlertTriangle, CheckCircle, BarChart2, Clock,
} from "lucide-react";
import { fetchPrediction, searchStocks, fetchPredictionInsight } from "@/lib/api";
import AIInsightPanel from "@/components/AIInsightPanel";

const MODELS = [
  { value: "random_forest",    label: "Random Forest",     color: "#3b82f6", desc: "Ensemble of 100 decision trees — excellent for non-linear patterns. Best overall." },
  { value: "gradient_boosting", label: "Gradient Boosting", color: "#8b5cf6", desc: "Sequential boosting — high accuracy on structured tabular data." },
  { value: "linear",            label: "Linear Regression", color: "#10b981", desc: "Baseline linear model — fast training, interpretable, lower accuracy." },
  { value: "svr",               label: "Support Vector Reg.", color: "#f59e0b", desc: "Kernel-SVM regression — robust with small-to-medium datasets." },
];

const FORECAST_OPTIONS = [7, 14, 30, 60, 90];
const PERIOD_OPTIONS    = ["1y", "2y", "3y", "5y"];

function formatDate(d: string) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function MetricBadge({ label, value, status }: { label: string; value: string; status?: "good" | "bad" | "neutral" }) {
  const colors: Record<string, string> = { good: "var(--accent-green)", bad: "var(--accent-amber)", neutral: "var(--text-primary)" };
  const bgs: Record<string, string> = { good: "rgba(16,185,129,0.08)", bad: "rgba(245,158,11,0.08)", neutral: "var(--bg-elevated)" };
  const borders: Record<string, string> = { good: "rgba(16,185,129,0.2)", bad: "rgba(245,158,11,0.2)", neutral: "var(--border-default)" };
  const st = status || "neutral";

  return (
    <div style={{ background: bgs[st], border: `1px solid ${borders[st]}`, borderRadius: 12, padding: "14px 18px", flex: "1 0 130px" }}>
      <p style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.7px", fontWeight: 700, marginBottom: 7 }}>{label}</p>
      <p className="mono" style={{ fontSize: 19, fontWeight: 800, color: colors[st] }}>{value}</p>
    </div>
  );
}

function FeatureBar({ feat, importance }: { feat: string; importance: number }) {
  const pct = Math.min(100, importance * 100 * 5);
  return (
    <div style={{ marginBottom: 9 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{feat}</span>
        <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>{(importance * 100).toFixed(2)}%</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function PredictionsPage() {
  const params = useSearchParams();
  const [symbol, setSymbol] = useState(params.get("symbol") || "AAPL");
  const [inputVal, setInputVal] = useState(params.get("symbol") || "AAPL");
  const [model, setModel] = useState("random_forest");
  const [forecastDays, setForecastDays] = useState(30);
  const [period, setPeriod] = useState("2y");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSugg, setShowSugg] = useState(false);

  const runPrediction = async (sym?: string) => {
    const s = (sym || symbol).toUpperCase();
    setLoading(true); setError(""); setResult(null);
    try { setResult(await fetchPrediction(s, period, forecastDays, model)); }
    catch (e: any) { setError(e?.response?.data?.detail || "Prediction failed. Try a different symbol or model."); }
    finally { setLoading(false); }
  };

  const handleSuggInput = async (val: string) => {
    setInputVal(val);
    if (val.length >= 1) {
      try { setSuggestions(await searchStocks(val)); setShowSugg(true); }
      catch { setSuggestions([]); }
    } else { setShowSugg(false); }
  };

  const chartData = result ? [
    ...(result.historical_predictions || []).map((d: any) => ({ date: d.date, actual: d.actual, predicted: d.predicted })),
    ...(result.predictions || []).map((d: any) => ({ date: d.date, forecast: d.predicted })),
  ] : [];

  const selectedModel = MODELS.find((m) => m.value === model)!;
  const metrics = result?.metrics;
  const accuracy = metrics?.accuracy_pct;
  const r2 = metrics?.r2_score;
  const forecastEnd = result?.predictions?.[result.predictions.length - 1]?.predicted;
  const priceDelta = forecastEnd && result?.last_known_price
    ? ((forecastEnd - result.last_known_price) / result.last_known_price * 100)
    : null;

  const aiFetch = async () => {
    if (!result) throw new Error("No result");
    return fetchPredictionInsight({
      symbol,
      model: selectedModel.label,
      accuracy: metrics?.accuracy_pct || 0,
      r2: metrics?.r2_score || 0,
      mae: metrics?.mae || 0,
      last_price: result.last_known_price,
      forecast_30d: result.predictions?.[result.predictions.length - 1]?.predicted || result.last_known_price,
    });
  };

  return (
    <div style={{ padding: "28px 24px 48px", maxWidth: 1440, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ marginBottom: 26 }}>
        <p className="label-tag" style={{ color: "var(--accent-purple)", marginBottom: 6 }}>ML Predictions</p>
        <h1 style={{ fontSize: "clamp(20px, 2.5vw, 30px)", fontWeight: 800 }} className="heading-gradient">AI Price Forecasting</h1>
        <p style={{ fontSize: 13.5, color: "var(--text-muted)", marginTop: 8, maxWidth: 540, lineHeight: 1.7 }}>
          Train ML models on historical data to forecast price trends. Compare accuracy metrics and get AI-powered interpretations.
        </p>
      </div>

      {/* Controls */}
      <div className="glass fade-in" style={{ padding: "22px 24px", marginBottom: 22 }}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>

          {/* Symbol */}
          <div style={{ flex: "1 0 150px", position: "relative" }}>
            <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 6, fontWeight: 600, letterSpacing: "0.5px" }}>STOCK SYMBOL</label>
            <div style={{ position: "relative" }}>
              <Search size={13} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
              <input value={inputVal} onChange={(e) => handleSuggInput(e.target.value)} onBlur={() => setTimeout(() => setShowSugg(false), 160)} placeholder="e.g. TSLA" style={{ paddingLeft: 32 }} autoComplete="off" />
              {showSugg && suggestions.length > 0 && (
                <div style={{ position: "absolute", top: "calc(100% + 5px)", left: 0, right: 0, background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: 12, zIndex: 50, overflow: "hidden" }}>
                  {suggestions.slice(0, 5).map((s) => (
                    <div key={s.symbol} className="sugg-item" onMouseDown={() => { setInputVal(s.symbol); setSymbol(s.symbol.toUpperCase()); setShowSugg(false); }}>
                      <span style={{ fontWeight: 700 }}>{s.symbol}</span>
                      <span style={{ color: "var(--text-muted)", marginLeft: 8, fontSize: 12 }}>{s.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Model */}
          <div style={{ flex: "2 0 200px" }}>
            <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 6, fontWeight: 600, letterSpacing: "0.5px" }}>MODEL</label>
            <select value={model} onChange={(e) => setModel(e.target.value)}>
              {MODELS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>

          {/* Forecast Days */}
          <div style={{ flex: "0 0 140px" }}>
            <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 6, fontWeight: 600, letterSpacing: "0.5px" }}>FORECAST</label>
            <select value={forecastDays} onChange={(e) => setForecastDays(Number(e.target.value))}>
              {FORECAST_OPTIONS.map((d) => <option key={d} value={d}>{d} days</option>)}
            </select>
          </div>

          {/* Training Period */}
          <div style={{ flex: "0 0 130px" }}>
            <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 6, fontWeight: 600, letterSpacing: "0.5px" }}>TRAINING DATA</label>
            <select value={period} onChange={(e) => setPeriod(e.target.value)}>
              {PERIOD_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          {/* Run */}
          <button
            onClick={() => { setSymbol(inputVal.trim().toUpperCase()); runPrediction(inputVal.trim()); }}
            className="btn-primary" disabled={loading}
            style={{ padding: "10px 28px", alignSelf: "flex-end", flexShrink: 0 }}
          >
            {loading ? <><span className="spinner" style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.2)", borderTopColor: "white" }} /> Training...</>
                     : <><Zap size={14} /> Run Prediction</>}
          </button>
        </div>

        {/* Model description */}
        <div style={{ marginTop: 14, padding: "10px 14px", background: `${selectedModel.color}0d`, border: `1px solid ${selectedModel.color}30`, borderRadius: 8 }}>
          <p style={{ fontSize: 12.5, color: selectedModel.color }}>
            <strong>{selectedModel.label}:</strong> {selectedModel.desc}
          </p>
        </div>
      </div>

      {error && <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 10, padding: "12px 16px", marginBottom: 18, color: "var(--accent-red)", fontSize: 13 }}>{error}</div>}

      {loading && (
        <div className="glass" style={{ padding: 70, textAlign: "center", marginBottom: 22 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
            <div className="spinner-lg" />
            <div>
              <p style={{ fontWeight: 700, fontSize: 16 }}>Training {selectedModel.label}...</p>
              <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 5 }}>Fetching {period} of data · Engineering features · Fitting model</p>
            </div>
          </div>
        </div>
      )}

      {result && (
        <>
          {/* Metrics row */}
          <div className="fade-in" style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
            <MetricBadge label="Accuracy" value={`${accuracy?.toFixed(1)}%`} status={accuracy >= 90 ? "good" : accuracy >= 75 ? "neutral" : "bad"} />
            <MetricBadge label="R² Score" value={r2?.toFixed(4)} status={r2 >= 0.85 ? "good" : r2 >= 0.6 ? "neutral" : "bad"} />
            <MetricBadge label="MAE" value={`$${metrics?.mae?.toFixed(2)}`} />
            <MetricBadge label="RMSE" value={`$${metrics?.rmse?.toFixed(2)}`} />
            <MetricBadge label="Last Price" value={`$${result.last_known_price?.toFixed(2)}`} />
            <div style={{ background: priceDelta != null && priceDelta >= 0 ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)", border: `1px solid ${priceDelta != null && priceDelta >= 0 ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`, borderRadius: 12, padding: "14px 18px", flex: "1 0 130px" }}>
              <p style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.7px", fontWeight: 700, marginBottom: 7 }}>
                {forecastDays}D FORECAST
              </p>
              <p className="mono" style={{ fontSize: 19, fontWeight: 800 }}>${forecastEnd?.toFixed(2) || "—"}</p>
              {priceDelta != null && (
                <span style={{ fontSize: 11, color: priceDelta >= 0 ? "var(--accent-green)" : "var(--accent-red)", fontWeight: 700 }}>
                  {priceDelta >= 0 ? "▲" : "▼"} {Math.abs(priceDelta).toFixed(2)}%
                </span>
              )}
            </div>
          </div>

          {/* R2 quality bar */}
          <div className="glass-sm fade-in-1" style={{ padding: "14px 20px", marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)" }}>MODEL FIT (R² = {r2?.toFixed(4)})</span>
              <span style={{ fontSize: 11, color: r2 >= 0.85 ? "var(--accent-green)" : r2 >= 0.6 ? "var(--accent-amber)" : "var(--accent-red)" }}>
                {r2 >= 0.85 ? "Strong" : r2 >= 0.6 ? "Moderate" : "Weak"} fit
              </span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{
                width: `${Math.max(0, Math.min(100, r2 * 100))}%`,
                background: r2 >= 0.85 ? "linear-gradient(90deg, #064e3b, #10b981)" : r2 >= 0.6 ? "linear-gradient(90deg, #92400e, #f59e0b)" : "linear-gradient(90deg, #7f1d1d, #ef4444)",
              }} />
            </div>
          </div>

          {/* Chart */}
          <div className="glass fade-in-2" style={{ padding: "22px 24px", marginBottom: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 800 }}>{symbol} — Prediction Chart</h2>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
                  <span style={{ color: selectedModel.color }}>{selectedModel.label}</span>
                  {" · "}{result.historical_predictions?.length} test points{" · "}{result.predictions?.length} forecasted days
                </p>
              </div>
              <div style={{ display: "flex", gap: 16, fontSize: 11, color: "var(--text-muted)" }}>
                <span>— Actual</span>
                <span style={{ color: selectedModel.color }}>- - Predicted</span>
                <span style={{ color: "#a78bfa" }}>— Forecast</span>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={380}>
              <LineChart data={chartData} margin={{ left: 8, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} width={70} tickFormatter={(v) => `$${v.toFixed(0)}`} />
                <Tooltip
                  contentStyle={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: 12, fontSize: 12 }}
                  labelFormatter={(l: any) => formatDate(l)}
                  formatter={(v: any, name: any) => [`$${Number(v).toFixed(2)}`, name]}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <ReferenceLine
                  x={result.historical_predictions?.[result.historical_predictions.length - 1]?.date}
                  stroke="rgba(255,255,255,0.1)" strokeDasharray="5 3"
                  label={{ value: "→ Forecast", fill: "rgba(255,255,255,0.2)", fontSize: 10, position: "insideTopRight" }}
                />
                <Line type="monotone" dataKey="actual"    stroke="var(--text-primary)"  strokeWidth={2}   dot={false} name="Actual"    connectNulls={false} />
                <Line type="monotone" dataKey="predicted" stroke={selectedModel.color}   strokeWidth={1.5} strokeDasharray="6 3" dot={false} name="Predicted (test)" connectNulls={false} />
                <Line type="monotone" dataKey="forecast"  stroke="#a78bfa"              strokeWidth={2.5} dot={false} name="Forecast"  connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Feature importance + Forecast table */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 22 }} className="pred-bottom-grid">
            {result.feature_importance && Object.keys(result.feature_importance).length > 0 && (
              <div className="glass fade-in-3" style={{ padding: 22 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <Brain size={15} color="var(--accent-blue)" />
                  <h3 style={{ fontSize: 14, fontWeight: 700 }}>Feature Importance</h3>
                </div>
                {Object.entries(result.feature_importance).slice(0, 10).map(([f, imp]: [string, any]) => (
                  <FeatureBar key={f} feat={f} importance={imp} />
                ))}
              </div>
            )}

            <div className="glass fade-in-3" style={{ padding: 22 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <Clock size={15} color="var(--accent-purple)" />
                <h3 style={{ fontSize: 14, fontWeight: 700 }}>Price Forecast</h3>
              </div>
              <div style={{ maxHeight: 360, overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border-default)" }}>
                      {["Date", "Forecast", "vs Today"].map((h) => (
                        <th key={h} style={{ textAlign: h === "Date" ? "left" : "right", padding: "7px 10px", fontSize: 10, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(result.predictions || []).map((d: any, i: number) => {
                      const pct = ((d.predicted - result.last_known_price) / result.last_known_price * 100);
                      return (
                        <tr key={i} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                          <td style={{ padding: "7px 10px", fontSize: 12, color: "var(--text-muted)" }}>{formatDate(d.date)}</td>
                          <td className="mono" style={{ textAlign: "right", padding: "7px 10px", fontSize: 12, fontWeight: 700 }}>${d.predicted.toFixed(2)}</td>
                          <td style={{ textAlign: "right", padding: "7px 10px" }}>
                            <span className="mono" style={{ fontSize: 11, color: pct >= 0 ? "var(--accent-green)" : "var(--accent-red)", fontWeight: 700 }}>
                              {pct >= 0 ? "+" : ""}{pct.toFixed(2)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* AI Prediction Insight */}
          <div className="fade-in-4">
            <AIInsightPanel onFetch={aiFetch} title={`${symbol} Prediction Interpretation`} />
          </div>
        </>
      )}

      {!result && !loading && (
        <div className="glass" style={{ padding: 90, textAlign: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Brain size={32} color="#8b5cf6" />
            </div>
            <div>
              <p style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>Ready to Forecast</p>
              <p style={{ fontSize: 13, color: "var(--text-muted)", maxWidth: 400 }}>Select a symbol, model, and forecast window — then click "Run Prediction" to train the model and generate forecasts.</p>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 900px) { .pred-bottom-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}
