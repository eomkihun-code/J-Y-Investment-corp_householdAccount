import type { Account, Holding, MonthlyTrend } from '../types';

/**
 * Service to provide real-time price estimation and valuation for stock holdings.
 * NOW EXCLUSIVELY USING YAHOO FINANCE via TICKER_MAP.
 */

export interface HoldingValuation extends Holding {
  realtimePrice: number;
  valuation: number;
  gainLoss: number;
  returnRate: number;
  code?: string;
}

// STRICT MAPPING: Corrected by verified data.
const TICKER_MAP: Record<string, string> = {
  "삼성전자": "005930.KS",
  "TIGER 미국 S&P500": "360750.KS",
  "TIGER 미국 나스닥100": "133690.KS",
  "KODEX 미국나스닥100": "379810.KS",
  "KODEX 미국30년국채타겟커버드콜(합성)": "481060.KS",
  "KODEX 한국부동산 리츠 인프라": "476800.KS",
  "KODEX 머니마켓액티브": "488770.KS",
  "SPY": "SPY",
  "TLT": "TLT",
  "SGOV": "SGOV",
  "CRCL": "CRCL"
};

// Global error listener for UI display
let uiErrorCallback: ((msg: string) => void) | null = null;
export const setUIErrorCallback = (cb: ((msg: string) => void) | null) => {
  uiErrorCallback = cb;
};

const logUIError = (msg: string) => {
  console.error(msg);
  if (uiErrorCallback) {
    try {
      uiErrorCallback(msg);
    } catch (e) {
      console.error('Error in UI error callback:', e);
    }
  }
};

/**
 * Main function to fetch real-time prices for all holdings.
 * Sequentially fetches from Yahoo Finance.
 */
export const getValuedHoldings = async (holdings: Holding[]): Promise<HoldingValuation[]> => {
  const results: HoldingValuation[] = [];
  
  // Only process holdings with positive quantity OR that had recent transactions
  const activeHoldings = holdings.filter(h => h.quantity > 0 || (h.transactions && h.transactions.length > 0));

  for (const h of activeHoldings) {
    if (results.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 50)); // Throttling
    }
    
    let realtimePrice = h.avgPrice;
    
    // 1. Get Ticker from TICKER_MAP (with normalization)
    const normalize = (s: string) => s.replace(/\s+/g, '').replace(/[\(\)]/g, '').toLowerCase();
    const normH = normalize(h.symbol);
    let ticker = h.code || h.symbol;

    for (const [key, val] of Object.entries(TICKER_MAP)) {
      if (normalize(key) === normH) {
        ticker = val;
        break;
      }
    }
    
    try {
      console.log(`[StockService] Fetching ${h.symbol} via Yahoo (Ticker: ${ticker})`);
      const price = await fetchYahooPrice(ticker);
      
      if (price !== null) {
        realtimePrice = price;
        console.log(`[StockService] ✅ ${h.symbol} (Yahoo): ${realtimePrice}`);
      } else {
        logUIError(`[StockService] ⚠️ No price found for ${h.symbol} (Ticker: ${ticker}). Using fallback.`);
      }
    } catch (e) {
      logUIError(`[StockService] ❌ Error fetching ${h.symbol}: ${e}`);
    }

    const valuation = realtimePrice * h.quantity;
    const cost = h.avgPrice * h.quantity;
    const gainLoss = valuation - cost;
    const returnRate = cost > 0 ? (gainLoss / cost) * 100 : 0;

    results.push({
      ...h,
      realtimePrice,
      valuation,
      gainLoss,
      returnRate,
      code: ticker
    });
  }

  // Final sort: Non-zero quantities first, then by valuation
  return results.sort((a, b) => {
    if (a.quantity > 0 && b.quantity === 0) return -1;
    if (a.quantity === 0 && b.quantity > 0) return 1;
    return b.valuation - a.valuation;
  });
};

/**
 * Fetches historical chart data (monthly) for a ticker.
 */
export async function fetchChartData(ticker: string, range: string = '1y'): Promise<{ timestamp: number[], close: number[] } | null> {
  try {
    const path = `v8/finance/chart/${ticker}?interval=1mo&range=${range}`;
    const url = `/api/yahoo?path=${encodeURIComponent(path)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return null;
    return {
      timestamp: result.timestamp || [],
      close: result.indicators?.quote?.[0]?.close || []
    };
  } catch (e) {
    console.error(`[StockService] Chart fetch failed for ${ticker}:`, e);
    return null;
  }
}

/**
 * Calculates total asset history by combining bank history and stock valuations.
 */
export const getMonthlyAssetHistory = async (
  accounts: Account[], 
  exchangeRate: number
): Promise<MonthlyTrend[]> => {
  const bankAccounts = accounts.filter(a => a.type === 'Bank');
  const stockAccounts = accounts.filter(a => a.type === 'Stock');
  
  // 1. Determine the months to cover (last 12 months)
  const now = new Date();
  const months: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  // 2. Pre-fetch historical prices for all unique tickers + USD/KRW
  const tickerMap = new Map<string, { timestamp: number[], close: number[] }>();
  const uniqueTickers = new Set<string>();
  const normalize = (s: string) => s.replace(/\s+/g, '').replace(/[\(\)]/g, '');

  stockAccounts.forEach(acc => {
    acc.holdings?.forEach((h: Holding) => {
      const normH = normalize(h.symbol);
      let ticker = h.symbol;
      for (const [key, val] of Object.entries(TICKER_MAP)) {
        if (normalize(key) === normH) {
          ticker = val;
          break;
        }
      }
      uniqueTickers.add(ticker);
    });
  });

  // Always fetch USD/KRW history
  const forexTicker = "USDKRW=X";
  uniqueTickers.add(forexTicker);

  console.log(`[StockService] Fetching history for ${uniqueTickers.size} tickers...`);
  for (const ticker of uniqueTickers) {
    const data = await fetchChartData(ticker);
    if (data) tickerMap.set(ticker, data);
    await new Promise(r => setTimeout(r, 50)); 
  }

  // 3. Calculate valuation for each month
  const history: MonthlyTrend[] = [];

  for (const monthKey of months) {
    let monthlyBankTotal = 0;
    let monthlyStockTotal = 0;

    const [yr, mo] = monthKey.split('-').map(Number);
    const monthEnd = new Date(yr, mo, 0, 23, 59, 59);
    const monthEndStr = monthEnd.toISOString().split('T')[0];

    // Determine Monthly Exchange Rate
    let monthlyExchangeRate = exchangeRate; 
    const forexData = tickerMap.get(forexTicker);
    if (forexData) {
      const monthStartUnix = new Date(yr, mo - 1, 1).getTime() / 1000;
      const nextMonthStartUnix = new Date(yr, mo, 1).getTime() / 1000;
      for (let i = 0; i < forexData.timestamp.length; i++) {
        if (forexData.timestamp[i] >= monthStartUnix && forexData.timestamp[i] < nextMonthStartUnix) {
          if (forexData.close[i] !== null) monthlyExchangeRate = forexData.close[i];
        }
      }
    }

    // A. Bank Valuation
    bankAccounts.forEach(acc => {
      const hist = acc.history || {};
      const validDates = Object.keys(hist).filter(d => d <= monthEndStr).sort();
      const latestBalance = validDates.length > 0 ? hist[validDates[validDates.length - 1]] : 0;
      monthlyBankTotal += acc.currency === 'USD' ? latestBalance * monthlyExchangeRate : latestBalance;
    });

    // B. Stock Valuation
    stockAccounts.forEach(acc => {
      acc.holdings?.forEach((h: Holding) => {
        // Resolve Ticker with normalization
        const normH = normalize(h.symbol);
        let ticker = h.symbol;
        for (const [key, val] of Object.entries(TICKER_MAP)) {
          if (normalize(key) === normH) {
            ticker = val;
            break;
          }
        }
        
        const transactions = h.transactions || [];
        let qtyAtMonthEnd = 0;
        transactions.forEach((t: { date: string, type: '매수' | '매도', quantity: number }) => {
          if (new Date(t.date) <= monthEnd) {
            qtyAtMonthEnd += (t.type === '매수' ? t.quantity : -t.quantity);
          }
        });

        if (qtyAtMonthEnd > 0) {
          const priceData = tickerMap.get(ticker);
          let bestPrice = h.avgPrice;
          
          if (priceData) {
            const monthStartUnix = new Date(yr, mo - 1, 1).getTime() / 1000;
            const nextMonthStartUnix = new Date(yr, mo, 1).getTime() / 1000;
            for (let i = 0; i < priceData.timestamp.length; i++) {
              const ts = priceData.timestamp[i];
              if (ts >= monthStartUnix && ts < nextMonthStartUnix) {
                if (priceData.close[i] !== null) {
                  bestPrice = priceData.close[i];
                }
              }
            }
          }
          monthlyStockTotal += qtyAtMonthEnd * (h.currency === 'USD' ? bestPrice * monthlyExchangeRate : bestPrice);
        }
      });
    });

    history.push({
      month: `${parseInt(monthKey.split('-')[1])}월`,
      amount: monthlyBankTotal + monthlyStockTotal,
      cashAmount: monthlyBankTotal,
      stockAmount: monthlyStockTotal
    });
  }

  return history;
};

/**
 * Fetches price from Yahoo Finance via Vite proxy.
 */
async function fetchYahooPrice(ticker: string): Promise<number | null> {
  try {
    const path = `v8/finance/chart/${ticker}?interval=1m&range=1d`;
    const url = `/api/yahoo?path=${encodeURIComponent(path)}`;
    const res = await fetch(url);
    if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    
    if (!result) return null;

    const meta = result.meta;
    // Prefer regularMarketPrice, fallback to previousClose if during off-hours, or last close in quotes
    let price = meta?.regularMarketPrice;
    
    if (!price || price === 0) {
      price = meta?.previousClose;
    }

    if (!price || price === 0) {
      const quotes = result.indicators?.quote?.[0];
      if (quotes?.close) {
        const lastPrice = quotes.close.filter((p: any) => p !== null).pop();
        if (lastPrice) price = lastPrice;
      }
    }

    return price || null;
  } catch (e) {
    console.error(`[StockService] Yahoo fetch failed for ${ticker}:`, e);
    return null;
  }
}

export const formatCurrency = (value: number, currency: string) => {
  if (currency === 'USD') {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
  }
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(value);
};
