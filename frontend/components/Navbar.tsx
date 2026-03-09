"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BarChart2, TrendingUp, PieChart, Activity, Brain, Menu, X, Zap } from "lucide-react";

const NAV_LINKS = [
  { href: "/", label: "Dashboard", icon: BarChart2 },
  { href: "/stocks", label: "Stock Analysis", icon: TrendingUp },
  { href: "/predictions", label: "ML Predictions", icon: Activity },
  { href: "/portfolio", label: "Portfolio", icon: PieChart },
];

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <header style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        height: "64px",
        background: "rgba(5, 7, 15, 0.92)",
        backdropFilter: "blur(24px) saturate(1.8)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        display: "flex", alignItems: "center",
        padding: "0 28px",
        justifyContent: "space-between",
      }}>

        {/* Logo */}
        <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34,
            background: "linear-gradient(135deg, #064e3b 0%, #10b981 100%)",
            borderRadius: "10px",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 20px rgba(16,185,129,0.45)",
          }}>
            <Zap size={18} color="white" fill="white" />
          </div>
          <div>
            <span style={{
              fontSize: "17px", fontWeight: 900,
              background: "linear-gradient(90deg, #e8edf8 0%, #10b981 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              letterSpacing: "-0.5px", display: "block", lineHeight: 1.1,
            }}>
              AlphaQuant
            </span>
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", letterSpacing: "1.5px", fontWeight: 600 }}>
              FINTECH ANALYTICS
            </span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav style={{ display: "flex", gap: 2, alignItems: "center" }} className="hide-mobile">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link key={href} href={href} style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "7px 14px", borderRadius: "9px",
                textDecoration: "none", fontSize: "13px", fontWeight: 500,
                color: active ? "#10b981" : "rgba(255,255,255,0.4)",
                background: active ? "rgba(16,185,129,0.1)" : "transparent",
                border: active ? "1px solid rgba(16,185,129,0.3)" : "1px solid transparent",
                transition: "all 0.18s",
              }}
                onMouseEnter={(e) => { if (!active) { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.7)"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; } }}
                onMouseLeave={(e) => { if (!active) { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.4)"; (e.currentTarget as HTMLElement).style.background = "transparent"; } }}
              >
                <Icon size={14} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Right side */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* Live badge */}
          <div style={{
            display: "flex", alignItems: "center", gap: 6, fontSize: "11px",
            color: "rgba(16,185,129,0.9)",
            background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)",
            borderRadius: "20px", padding: "5px 12px",
          }}>
            <span className="pulse-dot" />
            <span style={{ fontWeight: 600 }}>Live Market</span>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setOpen(!open)}
            style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", padding: 6 }}
            className="only-mobile"
            aria-label="Menu"
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      {/* Mobile Menu */}
      {open && (
        <div style={{
          position: "fixed", top: 64, left: 0, right: 0, zIndex: 99,
          background: "rgba(5,7,15,0.97)", backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          padding: "12px 16px 20px",
          display: "flex", flexDirection: "column", gap: 4,
        }}>
          {NAV_LINKS.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} onClick={() => setOpen(false)}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 16px", borderRadius: 10, textDecoration: "none",
                color: pathname === href ? "#60a5fa" : "rgba(255,255,255,0.55)",
                background: pathname === href ? "rgba(59,130,246,0.1)" : "transparent",
                fontSize: 14, fontWeight: 500,
              }}>
              <Icon size={16} /> {label}
            </Link>
          ))}
        </div>
      )}

      <style>{`
        @media (min-width: 769px) { .only-mobile { display: none !important; } }
      `}</style>
    </>
  );
}
