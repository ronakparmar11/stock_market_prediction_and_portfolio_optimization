"use client";
import { useEffect, useState } from "react";
import { fetchMarketOverview } from "@/lib/api";

interface TickerItem {
  symbol: string;
  price: number;
  change_percent: number;
}

export default function TickerTape() {
  const [items, setItems] = useState<TickerItem[]>([]);

  useEffect(() => {
    fetchMarketOverview()
      .then((data) => {
        const stocks: TickerItem[] = (data.trending || []).map((s: any) => ({
          symbol: s.symbol,
          price: s.current_price,
          change_percent: s.change_percent,
        }));
        const indices: TickerItem[] = (data.indices || []).map((i: any) => ({
          symbol: i.name,
          price: i.value,
          change_percent: i.change_percent,
        }));
        setItems([...indices, ...stocks]);
      })
      .catch(() => {});
  }, []);

  if (!items.length) return null;

  // Duplicate for seamless loop
  const doubled = [...items, ...items];

  return (
    <div style={{
      height: "32px",
      background: "rgba(5,7,15,0.9)",
      borderBottom: "1px solid rgba(255,255,255,0.04)",
      overflow: "hidden",
      display: "flex",
      alignItems: "center",
    }}>
      <div className="ticker-inner" style={{ display: "flex", alignItems: "center", gap: 0 }}>
        {doubled.map((item, i) => (
          <div key={i} style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "0 24px", borderRight: "1px solid rgba(255,255,255,0.05)",
            whiteSpace: "nowrap",
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)" }}>{item.symbol}</span>
            <span className="mono" style={{ fontSize: 11, color: "var(--text-primary)" }}>
              {item.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
            <span className="mono" style={{
              fontSize: 10, fontWeight: 700,
              color: item.change_percent >= 0 ? "var(--accent-green)" : "var(--accent-red)",
            }}>
              {item.change_percent >= 0 ? "▲" : "▼"} {Math.abs(item.change_percent).toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
