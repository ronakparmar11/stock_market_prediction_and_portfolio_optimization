import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import TickerTape from "@/components/TickerTape";
import ChatBot from "@/components/ChatBot";

export const metadata: Metadata = {
  title: "AlphaQuant | AI-Powered Financial Analytics Platform",
  description:
    "Professional stock market prediction, ML-powered forecasting, portfolio optimization, and AI financial insights. Built with Modern Portfolio Theory and advanced ML models.",
  keywords: "stock market prediction, portfolio optimization, financial analytics, AI investing, ML forecasting",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Navbar />
        <div style={{ paddingTop: "64px" }}>
          <TickerTape />
          <main style={{ minHeight: "calc(100vh - 96px)" }}>{children}</main>
        </div>
        <ChatBot />
      </body>
    </html>
  );
}
