"use client";
import { useMemo } from "react";
import { ResponsiveContainer } from "recharts";

interface OHLCPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface CandlestickChartProps {
  data: OHLCPoint[];
  height?: number;
  showVolume?: boolean;
}

// Map data values to SVG pixel positions
function scale(value: number, min: number, max: number, pxMin: number, pxMax: number): number {
  if (max === min) return (pxMin + pxMax) / 2;
  return pxMin + ((value - min) / (max - min)) * (pxMax - pxMin);
}

export default function CandlestickChart({ data, height = 360, showVolume = true }: CandlestickChartProps) {
  const chartData = useMemo(() => data.slice(-80), [data]); // last 80 candles
  const padding = { top: 16, bottom: showVolume ? 72 : 24, left: 70, right: 16 };

  const prices = chartData.flatMap((d) => [d.high, d.low]);
  const priceMin = Math.min(...prices) * 0.998;
  const priceMax = Math.max(...prices) * 1.002;
  const volumes = chartData.map((d) => d.volume || 0);
  const maxVol = Math.max(...volumes) || 1;

  const svgWidth = 900; // internal coordinate space
  const svgHeight = height;
  const chartW = svgWidth - padding.left - padding.right;
  const chartH = svgHeight - padding.top - padding.bottom;
  const volH = 52;
  const volTop = svgHeight - padding.bottom + 10;

  const candleWidth = Math.max(2, Math.min(12, chartW / chartData.length - 2));
  const step = chartW / chartData.length;

  // Price axis ticks
  const priceTicks = 5;
  const priceTickValues = Array.from({ length: priceTicks }, (_, i) =>
    priceMin + (i * (priceMax - priceMin)) / (priceTicks - 1)
  );

  if (!chartData.length) return (
    <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
      No data
    </div>
  );

  return (
    <div style={{ width: "100%", height, position: "relative" }}>
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        style={{ width: "100%", height: "100%", overflow: "visible" }}
        preserveAspectRatio="none"
      >
        {/* Grid lines */}
        {priceTickValues.map((tick, i) => {
          const y = scale(tick, priceMin, priceMax, padding.top + chartH, padding.top);
          return (
            <g key={i}>
              <line
                x1={padding.left} y1={y} x2={svgWidth - padding.right} y2={y}
                stroke="rgba(255,255,255,0.04)" strokeWidth={1}
              />
              <text
                x={padding.left - 6} y={y + 3.5}
                textAnchor="end" fontSize={10} fill="var(--text-muted)"
              >
                ${tick.toFixed(0)}
              </text>
            </g>
          );
        })}

        {/* Date labels (every ~10 candles) */}
        {chartData.map((d, i) => {
          if (i % Math.max(1, Math.floor(chartData.length / 8)) !== 0) return null;
          const cx = padding.left + i * step + step / 2;
          const label = d.date ? new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
          return (
            <text key={i} x={cx} y={svgHeight - padding.bottom + 6} textAnchor="middle" fontSize={9} fill="var(--text-muted)">
              {label}
            </text>
          );
        })}

        {/* Candlesticks */}
        {chartData.map((d, i) => {
          const isUp = d.close >= d.open;
          const color = isUp ? "#10b981" : "#ef4444";
          const cx = padding.left + i * step + step / 2;

          const highY = scale(d.high, priceMin, priceMax, padding.top + chartH, padding.top);
          const lowY = scale(d.low, priceMin, priceMax, padding.top + chartH, padding.top);
          const openY = scale(d.open, priceMin, priceMax, padding.top + chartH, padding.top);
          const closeY = scale(d.close, priceMin, priceMax, padding.top + chartH, padding.top);

          const bodyTop = Math.min(openY, closeY);
          const bodyH = Math.max(1, Math.abs(closeY - openY));

          return (
            <g key={i}>
              {/* Wick */}
              <line x1={cx} y1={highY} x2={cx} y2={lowY} stroke={color} strokeWidth={1} />
              {/* Body */}
              <rect
                x={cx - candleWidth / 2}
                y={bodyTop}
                width={candleWidth}
                height={bodyH}
                fill={color}
                fillOpacity={isUp ? 0.85 : 1}
                rx={1}
              />
            </g>
          );
        })}

        {/* Volume bars */}
        {showVolume && chartData.map((d, i) => {
          const isUp = d.close >= d.open;
          const color = isUp ? "#10b981" : "#ef4444";
          const cx = padding.left + i * step + step / 2;
          const volBarH = ((d.volume || 0) / maxVol) * volH;
          return (
            <rect
              key={i}
              x={cx - candleWidth / 2}
              y={volTop + volH - volBarH}
              width={candleWidth}
              height={volBarH}
              fill={color}
              fillOpacity={0.35}
              rx={1}
            />
          );
        })}

        {/* Volume label */}
        {showVolume && (
          <text x={padding.left - 6} y={volTop + 8} textAnchor="end" fontSize={9} fill="var(--text-muted)">
            Vol
          </text>
        )}
      </svg>
    </div>
  );
}
