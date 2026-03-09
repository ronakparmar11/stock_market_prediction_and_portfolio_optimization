import axios from "axios";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const api = axios.create({ baseURL: BASE, timeout: 130000 });

// ── Stock endpoints ──────────────────────────────────────────
export async function fetchMarketOverview() {
  const { data } = await api.get("/api/stocks/market-overview");
  return data;
}

export async function fetchSectorPerformance() {
  const { data } = await api.get("/api/stocks/sector-performance");
  return data.sectors as any[];
}

export async function searchStocks(query: string) {
  const { data } = await api.get("/api/stocks/search", { params: { q: query } });
  return data.results as { symbol: string; name: string }[];
}

export async function fetchStockInfo(symbol: string) {
  const { data } = await api.get(`/api/stocks/${symbol}/info`);
  return data;
}

export async function fetchStockHistory(symbol: string, period = "1y") {
  const { data } = await api.get(`/api/stocks/${symbol}/history`, { params: { period } });
  return data;
}

// ── Prediction endpoint ──────────────────────────────────────
export async function fetchPrediction(
  symbol: string,
  period = "2y",
  forecastDays = 30,
  model = "random_forest"
) {
  const { data } = await api.get(`/api/predictions/${symbol}`, {
    params: { period, forecast_days: forecastDays, model },
  });
  return data;
}

// ── Portfolio endpoint ───────────────────────────────────────
export async function optimizePortfolio(
  symbols: string[],
  period = "1y",
  numPortfolios = 5000
) {
  const { data } = await api.post("/api/portfolio/optimize", {
    symbols,
    period,
    num_portfolios: numPortfolios,
  });
  return data;
}

// ── AI endpoints ─────────────────────────────────────────────
export async function fetchStockInsight(payload: {
  symbol: string;
  name?: string;
  sector?: string;
  current_price: number;
  change_percent: number;
  rsi?: number | null;
  ma50?: number | null;
  ma200?: number | null;
  volume_ratio?: number | null;
  pe_ratio?: number | null;
}) {
  const { data } = await api.post("/api/ai/stock-insight", payload);
  return data.insight as string;
}

export async function fetchPortfolioInsight(payload: {
  symbols: string[];
  weights: Record<string, number>;
  expected_return: number;
  volatility: number;
  sharpe_ratio: number;
}) {
  const { data } = await api.post("/api/ai/portfolio-insight", payload);
  return data.insight as string;
}

export async function fetchPredictionInsight(payload: {
  symbol: string;
  model: string;
  accuracy: number;
  r2: number;
  mae: number;
  last_price: number;
  forecast_30d: number;
}) {
  const { data } = await api.post("/api/ai/prediction-insight", payload);
  return data.insight as string;
}

export async function fetchMarketSummary(payload: {
  indices: any[];
  top_gainers: any[];
  top_losers: any[];
}) {
  const { data } = await api.post("/api/ai/market-summary", payload);
  return data.insight as string;
}
