"""
AI service using the Featherless AI API (OpenAI-compatible endpoint).
Falls back to a rule-based financial response engine if the API is unavailable.
"""
import httpx
import logging
from typing import Optional, List, Dict, Any
from services.cache_service import cache, make_cache_key

logger = logging.getLogger(__name__)

FEATHERLESS_API_KEY = "rc_ad4330451ff580078047ec45c0f09483a51c9cf795d466adece1d8cdd0b21267"
FEATHERLESS_BASE_URL = "https://api.featherless.ai/v1"
FEATHERLESS_MODEL = "meta-llama/Meta-Llama-3.1-8B-Instruct"

SYSTEM_ANALYST = (
    "You are a professional financial analyst at a top-tier quantitative hedge fund. "
    "Provide concise, insightful analysis in 2-4 sentences. Use precise financial language. "
    "Be direct, data-driven, and professionally cautious about forward-looking statements."
)

HEADERS = {
    "Authorization": f"Bearer {FEATHERLESS_API_KEY}",
    "Content-Type": "application/json",
    "User-Agent": "AlphaQuant/2.0 (Financial Analytics Platform)",
    "Accept": "application/json",
}


async def _call_ai(prompt: str, system: str = SYSTEM_ANALYST, max_tokens: int = 350, cache_ttl: int = 1800) -> str:
    """Core function to call Featherless AI API with caching and fallback."""
    cache_key = make_cache_key("ai", prompt[:120], max_tokens)
    cached = cache.get(cache_key)
    if cached:
        return cached

    payload = {
        "model": FEATHERLESS_MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
        "max_tokens": max_tokens,
        "temperature": 0.65,
        "top_p": 0.9,
    }

    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            resp = await client.post(
                f"{FEATHERLESS_BASE_URL}/chat/completions",
                headers=HEADERS,
                json=payload,
            )
            if resp.status_code == 403:
                body = resp.text
                if "overdue" in body or "upgrade_required" in body:
                    raise ValueError("subscription_expired")
            resp.raise_for_status()
            result = resp.json()["choices"][0]["message"]["content"].strip()
            cache.set(cache_key, result, ttl=cache_ttl)
            return result
    except ValueError as e:
        if "subscription_expired" in str(e):
            logger.warning("Featherless subscription expired — using fallback engine")
            result = _fallback_insight(prompt)
            cache.set(cache_key, result, ttl=cache_ttl)
            return result
        raise
    except httpx.HTTPStatusError as e:
        logger.error(f"Featherless API HTTP error: {e.response.status_code} — {e.response.text[:200]}")
        result = _fallback_insight(prompt)
        return result
    except httpx.TimeoutException:
        logger.warning("Featherless AI request timed out — using fallback")
        return _fallback_insight(prompt)
    except Exception as e:
        logger.error(f"AI service error: {e}")
        return _fallback_insight(prompt)


async def chat_stream(messages: List[Dict[str, str]]):
    """Async generator: streams chat completion tokens. Falls back to fallback engine."""
    payload = {
        "model": FEATHERLESS_MODEL,
        "messages": messages,
        "max_tokens": 600,
        "temperature": 0.7,
        "stream": True,
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            async with client.stream("POST", f"{FEATHERLESS_BASE_URL}/chat/completions", headers=HEADERS, json=payload) as resp:
                if resp.status_code == 403:
                    body = await resp.aread()
                    body_text = body.decode()
                    if "overdue" in body_text or "upgrade_required" in body_text:
                        raise ValueError("subscription_expired")
                    raise ValueError(f"403 Forbidden: {body_text[:100]}")
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if line.startswith("data: "):
                        data = line[6:]
                        if data == "[DONE]":
                            break
                        try:
                            chunk = __import__("json").loads(data)
                            delta = chunk["choices"][0]["delta"].get("content", "")
                            if delta:
                                yield delta
                        except Exception:
                            pass
    except ValueError as e:
        if "subscription_expired" in str(e):
            # Fall back to rule-based response
            text = _fallback_chat(messages)
            # Yield word by word for streaming effect
            for word in text.split(" "):
                yield word + " "
                import asyncio
                await asyncio.sleep(0.04)
        else:
            yield f"⚠ Connection error: {str(e)[:80]}"
    except Exception as e:
        logger.error(f"Stream error: {e}")
        text = _fallback_chat(messages)
        for word in text.split(" "):
            yield word + " "
            import asyncio
            await asyncio.sleep(0.03)


# ─────────────────────────────────────────────────────────────
# Rule-based fallback financial intelligence engine
# ─────────────────────────────────────────────────────────────

def _extract_keywords(text: str) -> List[str]:
    text = text.lower()
    keywords = []
    checks = [
        ("rsi", ["rsi", "relative strength"]),
        ("macd", ["macd", "moving average convergence"]),
        ("bollinger", ["bollinger", "bb "]),
        ("moving average", ["moving average", "ma50", "ma200", "ma 50", "golden cross", "death cross"]),
        ("portfolio", ["portfolio", "allocation", "diversif"]),
        ("efficient frontier", ["efficient frontier", "sharpe"]),
        ("prediction", ["predict", "forecast", "future price", "ml model"]),
        ("volatility", ["volatility", "risk", "beta", "vix"]),
        ("bullish", ["bullish", "uptrend", "buy signal"]),
        ("bearish", ["bearish", "downtrend", "sell signal"]),
        ("pe ratio", ["p/e", "pe ratio", "price to earnings"]),
        ("market cap", ["market cap", "capitalization"]),
        ("volume", ["volume", "trading activity"]),
        ("sector", ["sector", "etf", "heatmap"]),
        ("tesla", ["tsla", "tesla"]),
        ("apple", ["aapl", "apple"]),
        ("nvidia", ["nvda", "nvidia"]),
        ("diversification", ["diversif"]),
        ("hello", ["hello", "hi ", "hey", "what can you"]),
    ]
    for tag, patterns in checks:
        if any(p in text for p in patterns):
            keywords.append(tag)
    return keywords


_KNOWLEDGE: Dict[str, str] = {
    "rsi": (
        "**RSI (Relative Strength Index)** is a momentum oscillator ranging 0–100. "
        "Values above **70** signal overbought conditions — the asset may be due for a pullback. "
        "Values below **30** signal oversold conditions — a potential reversal or buying opportunity. "
        "RSI between 40–60 is neutral territory. For stocks, divergence between RSI and price action "
        "is a powerful confirmation signal of trend changes."
    ),
    "macd": (
        "**MACD (Moving Average Convergence Divergence)** measures momentum using two EMAs (12-day and 26-day). "
        "A **bullish signal** occurs when the MACD line crosses above the signal line — indicating upward momentum. "
        "A **bearish signal** occurs when it crosses below. The histogram shows the difference between MACD and signal lines. "
        "Widening bars = strengthening trend; shrinking bars = weakening momentum."
    ),
    "bollinger": (
        "**Bollinger Bands** consist of a 20-day SMA (middle band) ± 2 standard deviations. "
        "Price touching the **upper band** suggests overbought / extended conditions. "
        "Price touching the **lower band** suggests oversold conditions. "
        "A **Bollinger Squeeze** (bands narrowing) indicates low volatility — often preceding a sharp breakout. "
        "Breakouts above the upper band with strong volume confirm bullish momentum."
    ),
    "moving average": (
        "**Moving Averages** smooth price action to identify trends. "
        "The **50-day MA** tracks medium-term momentum; the **200-day MA** tracks the long-term trend. "
        "A **Golden Cross** (MA50 crossing above MA200) is a classic bullish signal. "
        "A **Death Cross** (MA50 crossing below MA200) signals a bearish trend shift. "
        "Price trading above both MAs = healthy uptrend; below both = confirmed downtrend."
    ),
    "portfolio": (
        "A well-diversified portfolio balances assets across sectors and risk profiles. "
        "**Modern Portfolio Theory** (MPT) shows that combining assets with low correlation reduces overall risk "
        "without proportionally reducing return. The **Sharpe Ratio** measures risk-adjusted performance — "
        "values above 1.0 are good, above 1.5 are excellent. Avoid over-concentration: "
        "no single position should typically exceed 20-25% of the portfolio."
    ),
    "efficient frontier": (
        "The **Efficient Frontier** is the set of optimal portfolios offering the highest expected return "
        "for each level of risk (volatility). Portfolios below the frontier are sub-optimal — "
        "they take on more risk without commensurate return. The **Maximum Sharpe Ratio** portfolio sits "
        "on the frontier at the point where risk-adjusted return is maximized. "
        "In the scatter chart, blue dots are simulated portfolios; the gold star (★) marks the optimal allocation."
    ),
    "prediction": (
        "The ML prediction combines multiple models (Random Forest, Gradient Boosting, SVR) trained on "
        "historical price data with engineered features: momentum indicators, RSI, MACD, lag features, and volatility. "
        "**R² Score** above 0.85 indicates strong predictive fit. **MAE** shows average dollar error. "
        "Important caveat: ML models extrapolate from historical patterns — they cannot predict "
        "news events, earnings surprises, or black swan events. Use forecasts as directional guidance, not certainty."
    ),
    "volatility": (
        "**Volatility** (σ) measures price fluctuation — typically calculated as the annualized standard deviation "
        "of daily returns. Higher volatility means higher risk and potential reward. "
        "**ATR (Average True Range)** measures daily price range volatility over 14 days. "
        "**Beta** compares a stock's volatility to the S&P 500: Beta > 1 = more volatile than market; "
        "Beta < 1 = less volatile. For risk management, position sizing inversely proportional to volatility "
        "helps maintain consistent portfolio risk exposure."
    ),
    "pe ratio": (
        "**P/E Ratio (Price-to-Earnings)** compares a stock's price to its earnings per share. "
        "A high P/E (>25 for most sectors) suggests investors expect strong future growth — "
        "common in tech stocks. A low P/E may indicate undervaluation or business challenges. "
        "Always compare P/E to industry peers and historical averages. "
        "The **Forward P/E** uses projected earnings and is often more relevant for growth companies. "
        "**PEG Ratio** (P/E divided by earnings growth) < 1 may indicate undervaluation relative to growth."
    ),
    "volume": (
        "**Trading Volume** measures market participation and conviction behind price moves. "
        "A breakout on **high volume** (>1.5x average) is a strong confirmation signal. "
        "A price rise on **low volume** may be unsustainable — institutional interest is lacking. "
        "The **Volume Ratio** shown in AlphaQuant compares today's volume to the 5-day average. "
        "Spikes in volume often precede significant price moves, making it a leading indicator."
    ),
    "sector": (
        "The **Sector Heatmap** shows daily performance of 10 S&P 500 sectors via ETFs (XLK, XLF, XLV, etc.). "
        "Green intensity = sector outperforming; Red = underperforming. "
        "Broad red across all sectors signals market-wide risk-off sentiment. "
        "Rotation from defensive sectors (utilities, healthcare) to cyclical sectors (tech, financials) "
        "signals improving economic confidence. Sector diversification reduces concentration risk."
    ),
    "diversification": (
        "**Diversification** reduces unsystematic risk by combining assets with low or negative correlation. "
        "A well-diversified portfolio typically holds 15-30 positions across multiple sectors and geographies. "
        "**Correlation < 0.5** between assets indicates good diversification benefit. "
        "Adding bonds, commodities (gold), or international stocks to a US equity portfolio "
        "can significantly reduce drawdowns while maintaining returns. "
        "The correlation matrix in AlphaQuant's Portfolio page shows pairwise correlations — "
        "aim for a mix of blue (positive) and near-zero (uncorrelated) values."
    ),
    "hello": (
        "👋 Hello! I'm **AlphaBot**, your AI financial analyst. I can help you with:\n\n"
        "• 📊 **Technical Analysis** — RSI, MACD, Bollinger Bands, Moving Averages\n"
        "• 📈 **Stock Trends** — Bullish/bearish signals, volume analysis\n"
        "• 💼 **Portfolio Analysis** — Sharpe ratio, diversification, efficient frontier\n"
        "• 🤖 **ML Predictions** — Interpreting forecast charts and R² scores\n"
        "• 📉 **Risk Metrics** — Volatility, Beta, ATR explained\n\n"
        "Ask me anything about stocks, charts, or your portfolio!"
    ),
    "bullish": (
        "**Bullish signals** to look for:\n"
        "• Price above MA50 and MA200 (uptrend confirmation)\n"
        "• Golden Cross: MA50 crossing above MA200\n"
        "• RSI trending up from 40-50 range without being overbought (>70)\n"
        "• MACD crossing above signal line with expanding histogram\n"
        "• Breakout above resistance on high volume (>1.5x average)\n"
        "• Higher highs and higher lows in price structure"
    ),
    "bearish": (
        "**Bearish signals** to watch for:\n"
        "• Price below both MA50 and MA200\n"
        "• Death Cross: MA50 crossing below MA200\n"
        "• RSI declining from overbought territory (>70) downward\n"
        "• MACD crossing below signal line\n"
        "• Breakdown below support on elevated volume\n"
        "• Lower highs and lower lows in price structure\n"
        "• Candlestick patterns: Bearish engulfing, Shooting star, Evening star"
    ),
}


def _fallback_insight(prompt: str) -> str:
    """Generate a contextual rule-based insight based on prompt keywords."""
    keywords = _extract_keywords(prompt)
    if not keywords:
        return (
            "Based on the available technical data, this stock shows mixed signals. "
            "Analyze the RSI for momentum, compare MA50 vs MA200 for trend direction, "
            "and check volume ratio for institutional participation. "
            "Always consider the broader sector context and macroeconomic environment before making investment decisions."
        )
    # Return the most specific match
    for keyword in keywords:
        if keyword in _KNOWLEDGE:
            return _KNOWLEDGE[keyword]
    return _KNOWLEDGE.get(keywords[0], "Please ask me about specific financial indicators or concepts.")


def _fallback_chat(messages: List[Dict[str, str]]) -> str:
    """Generate a chat response using the rule-based engine."""
    # Get the last user message
    last_user = ""
    for msg in reversed(messages):
        if msg.get("role") == "user":
            last_user = msg.get("content", "")
            break
    return _fallback_insight(last_user) if last_user else _KNOWLEDGE["hello"]


def _fallback_note() -> str:
    return "\n\n*Note: Running in offline mode — Featherless AI subscription inactive. Responses are from AlphaQuant's built-in financial knowledge base.*"


# ─────────────────────────────────────────────────────────────
# High-level analysis functions
# ─────────────────────────────────────────────────────────────

async def analyze_stock(symbol, name, sector, current_price, change_pct, rsi=None, ma50=None, ma200=None, volume_ratio=None, pe_ratio=None) -> str:
    signals = []
    if ma50 and ma200:
        cross = "golden cross (bullish)" if ma50 > ma200 else "death cross (bearish)"
        signals.append(f"MA50/MA200 indicate a {cross} — MA50: ${ma50:.2f}, MA200: ${ma200:.2f}")
    if rsi is not None:
        if rsi > 70: signals.append(f"RSI at {rsi:.1f} — overbought, potential pullback risk")
        elif rsi < 30: signals.append(f"RSI at {rsi:.1f} — oversold, potential reversal opportunity")
        else: signals.append(f"RSI at {rsi:.1f} — neutral momentum")
    if pe_ratio: signals.append(f"P/E ratio: {pe_ratio:.1f}x")
    if volume_ratio and volume_ratio > 1.5: signals.append(f"Volume is {volume_ratio:.1f}x above average")

    prompt = (
        f"Analyze {symbol} ({name}, {sector} sector):\n"
        f"• Current price: ${current_price:.2f} ({change_pct:+.2f}% today)\n"
        + "\n".join(f"• {s}" for s in signals)
        + "\n\nProvide a brief technical and fundamental analysis with a clear bias (bullish/bearish/neutral)."
    )
    return await _call_ai(prompt)


async def analyze_portfolio(symbols, weights, expected_return, volatility, sharpe_ratio, correlation_summary=None) -> str:
    allocation = ", ".join(f"{sym}: {w:.1f}%" for sym, w in sorted(weights.items(), key=lambda x: -x[1]))
    risk_level = "low" if volatility < 10 else "moderate" if volatility < 20 else "high"
    sharpe_quality = "excellent" if sharpe_ratio > 1.5 else "good" if sharpe_ratio > 1 else "moderate" if sharpe_ratio > 0.5 else "poor"
    prompt = (
        f"Analyze this investment portfolio:\n• Allocation: {allocation}\n"
        f"• Expected Annual Return: {expected_return:.2f}%\n"
        f"• Annual Volatility: {volatility:.2f}% ({risk_level} risk)\n"
        f"• Sharpe Ratio: {sharpe_ratio:.3f} ({sharpe_quality} risk-adjusted return)\n"
        + (f"• Correlation note: {correlation_summary}\n" if correlation_summary else "")
        + "\nAssess diversification quality, risk-return tradeoff, and give 1-2 actionable suggestions."
    )
    return await _call_ai(prompt)


async def analyze_prediction(symbol, model, accuracy, r2, mae, last_price, forecast_30d) -> str:
    price_chg = (forecast_30d - last_price) / last_price * 100
    r2_quality = "strong" if r2 > 0.85 else "moderate" if r2 > 0.6 else "weak"
    prompt = (
        f"Interpret this ML prediction for {symbol}:\n"
        f"• Model: {model} — Accuracy: {accuracy:.1f}%, R²: {r2:.4f} ({r2_quality} fit), MAE: ${mae:.2f}\n"
        f"• Current: ${last_price:.2f} → Forecast: ${forecast_30d:.2f} ({price_chg:+.2f}%)\n\n"
        "Explain what this prediction means and any caveats an investor should consider."
    )
    return await _call_ai(prompt)


async def get_market_summary(indices, top_gainers, top_losers) -> str:
    idx_str = "; ".join(f"{i['name']} {i['change_percent']:+.2f}%" for i in indices[:4])
    gainers_str = ", ".join(f"{g['symbol']} +{g['change_percent']:.1f}%" for g in top_gainers[:3])
    losers_str = ", ".join(f"{l['symbol']} {l['change_percent']:.1f}%" for l in top_losers[:3])
    avg_idx = sum(i["change_percent"] for i in indices) / max(len(indices), 1)
    market_bias = "risk-on" if avg_idx > 0.3 else "risk-off" if avg_idx < -0.3 else "mixed"
    prompt = (
        f"Write a brief professional market commentary (3 sentences max):\n"
        f"• Indices: {idx_str}\n• Market bias: {market_bias} (avg: {avg_idx:+.2f}%)\n"
        f"• Top gainers: {gainers_str}\n• Top losers: {losers_str}\n\n"
        "Summarize the key market theme and what investors should watch."
    )
    return await _call_ai(prompt, cache_ttl=900)
