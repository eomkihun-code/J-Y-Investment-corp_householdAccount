import * as XLSX from 'xlsx';
import type { Account, CashFlow, Owner } from '../types';

/**
 * Helper to wrap FileReader with a Promise
 */
const readExcelFile = async (file: File): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];
        resolve(jsonData);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
};

/**
 * Helper to trim all keys in a JSON object (Excel row)
 */
const trimKeys = (obj: any): any => {
  const trimmed: any = {};
  for (const key in obj) {
    trimmed[key.trim()] = obj[key];
  }
  return trimmed;
};

/**
 * Helper to parse amount robustly (handles commas)
 */
const parseAmount = (val: any): number => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const cleaned = String(val).replace(/[^0-9.-]/g, '');
  return Number(cleaned) || 0;
};

/**
 * Parser for "주식 매매 현황_*.xlsx"
 */
export const parseExcelStocks = async (file: File): Promise<Account[]> => {
  const rawData = await readExcelFile(file);
  const accountMap = new Map<string, Account>();

  rawData.forEach((rawRow) => {
    const row = trimKeys(rawRow);
    const accountName = String(row['증권 계좌'] || row['계좌'] || '알수없는계좌').trim();
    const ownerRaw = String(row['소유자'] || row['소유주'] || 'Husband').trim();
    const mappedOwner: Owner = ownerRaw.includes('최수진') || ownerRaw.toLowerCase().includes('wife') ? 'Wife' : 
                               ownerRaw.includes('엄기훈') || ownerRaw.toLowerCase().includes('husband') ? 'Husband' : 'Joint';
    
    const price = parseAmount(row['평단가']);
    const quantity = parseAmount(row['수량']);
    const symbol = String(row['종목명'] || '알수없는종목').trim();
    const stockCode = row['종목코드'] ? String(row['종목코드']).trim() : undefined;
    const type = String(row['매매구분'] || '매수').trim() as '매수' | '매도';
    let dateStr = new Date().toISOString().split('T')[0];
    if (row['거래일']) {
      const serial = row['거래일'];
      if (typeof serial === 'number') {
        const date = new Date(1899, 11, 30 + Math.floor(serial));
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        dateStr = `${y}-${m}-${d}`;
      } else {
        dateStr = String(serial).trim().substring(0, 10).replace(/\./g, '-');
      }
    }

    const market = String(row['시장구분'] || row['시장'] || '').trim();
    const isUSD = market === '해외' || market === '미국' || accountName.includes('미국');
    const currency = isUSD ? 'USD' : 'KRW';
    const accountKey = `${accountName}_${currency}_${mappedOwner}`;
    const escapedKey = accountKey.replace(/\s+/g, '-');
    
    // 1. Get or create the account base object (without holdings yet)
    if (!accountMap.has(accountKey)) {
      accountMap.set(accountKey, {
        id: `excel-stock-${escapedKey}`,
        name: isUSD ? `${accountName} (USD)` : accountName,
        owner: mappedOwner,
        type: 'Stock',
        balance: 0,
        currency: currency,
        category: isUSD ? '해외주식' : '국내주식',
        holdings: []
      });
    }

    // 2. Aggregate holdings by symbol using a temporary map or similar logic
    // For simplicity, let's find the existing holding in the array
    const account = accountMap.get(accountKey)!;
    if (!account.holdings) account.holdings = [];
    
    let holding = account.holdings.find(h => h.symbol === symbol);
    
    if (type === '매도') {
      if (holding) {
        holding.quantity -= quantity;
        if (!holding.transactions) holding.transactions = [];
        holding.transactions.push({ date: dateStr, type, quantity, price });
      }
    } else {
      // 매수 (Buy) or default
      if (holding) {
        // Weighted Average Price calculation
        const totalCost = (holding.quantity * holding.avgPrice) + (quantity * price);
        const totalQty = holding.quantity + quantity;
        holding.avgPrice = totalQty > 0 ? totalCost / totalQty : price;
        holding.quantity = totalQty;
        holding.currentPrice = holding.avgPrice;
        if (stockCode) holding.code = stockCode;
        if (!holding.transactions) holding.transactions = [];
        holding.transactions.push({ date: dateStr, type, quantity, price });
      } else {
        account.holdings.push({
          symbol,
          quantity,
          avgPrice: price,
          currentPrice: price,
          currency,
          code: stockCode,
          transactions: [{ date: dateStr, type, quantity, price }]
        });
      }
    }
  });

  // 3. Final cleanup: Calculate account balances and filter out zero-quantity holdings
  const finalAccounts = Array.from(accountMap.values()).map(acc => {
    if (acc.holdings) {
      acc.holdings = acc.holdings.filter(h => h.quantity > 0.0001 || (h.transactions && h.transactions.length > 0));
      acc.balance = acc.holdings.reduce((sum, h) => sum + (h.quantity * h.avgPrice), 0);
    }
    return acc;
  });

  return finalAccounts;
};

/**
 * Parser for "현금 현황.xlsx"
 */
export const parseExcelCash = async (file: File): Promise<Account[]> => {
  const rawData = await readExcelFile(file);
  
  const accounts: Account[] = rawData.map((rawRow) => {
    const row = trimKeys(rawRow);
    const accountName = String(row['현금 현황'] || row['항목'] || '알수없는통장').trim();
    const ownerRaw = String(row['소유주'] || row['소유자'] || 'Husband').trim();
    const mappedOwner: Owner = ownerRaw.includes('최수진') || ownerRaw.toLowerCase().includes('wife') ? 'Wife' : 
                               ownerRaw.includes('엄기훈') || ownerRaw.toLowerCase().includes('husband') ? 'Husband' : 'Joint';
    
    // Find all date columns (e.g., 2026-03-17) and build history
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    const dateKeys = Object.keys(row).filter(k => datePattern.test(k)).sort();
    
    const history: { [date: string]: number } = {};
    dateKeys.forEach(k => {
      history[k] = parseAmount(row[k]);
    });
    
    const latestBalance = dateKeys.length > 0 ? history[dateKeys[dateKeys.length - 1]] : 0;
    const market = String(row['시장'] || row['구분'] || '국내').trim();
    const isUSD = market.includes('미국') || market.includes('해외') || market.toLowerCase().includes('us') || accountName.includes('미국');

    const escapedKey = accountName.replace(/\s+/g, '-');

    return {
      id: `excel-cash-${escapedKey}-${mappedOwner}`,
      name: accountName,
      owner: mappedOwner,
      type: 'Bank',
      balance: latestBalance,
      currency: isUSD ? 'USD' : 'KRW',
      category: market,
      history
    };
  });

  return accounts;
};

/**
 * Parser for "incoming 현황_*.xlsx"
 */
export const parseExcelIncome = async (file: File): Promise<CashFlow[]> => {
  const rawData = await readExcelFile(file);
  
  const cashFlows: CashFlow[] = rawData.map((rawRow, index) => {
    const row = trimKeys(rawRow);
    const sourceCat = row['수입원'] || '';
    const itemName = row['항목'] || '';
    const combinedSource = `${sourceCat} ${itemName}`.trim() || '기타 수입';
    const market = row['시장'] || '국내';
    const currency = market === '미국' ? 'USD' : 'KRW';
    
    // Determine category based on sourceCat (Robust Matching)
    const sourceCatLower = sourceCat.toLowerCase().trim();
    let category: 'Interest' | 'Dividend' | 'Rent' | 'Other' = 'Other';
    if (sourceCatLower.includes('배당') || sourceCatLower.includes('dividend')) category = 'Dividend';
    else if (sourceCatLower.includes('이자') || sourceCatLower.includes('interest')) category = 'Interest';
    else if (sourceCatLower.includes('월세') || sourceCatLower.includes('rent')) category = 'Rent';

    // Determine owner (Robust Matching)
    const ownerRaw = (row['수령인'] || row['소유자'] || row['소유주'] || row['소유'] || '').toString().trim();
    let owner: Owner = 'Joint';
    if (ownerRaw.includes('최수진') || ownerRaw.toLowerCase().includes('wife')) owner = 'Wife';
    else if (ownerRaw.includes('엄기훈') || ownerRaw.toLowerCase().includes('husband')) owner = 'Husband';
    else if (!ownerRaw) owner = 'Husband'; // Default fallback

    // Parse Excel serial date
    let dateStr = new Date().toISOString().split('T')[0];
    if (row['날짜']) {
      const serial = row['날짜'];
      if (typeof serial === 'number') {
        // Excel base date is 1899-12-30
        const date = new Date(1899, 11, 30 + Math.floor(serial));
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        dateStr = `${y}-${m}-${d}`;
      } else {
        dateStr = String(serial).substring(0, 10).replace(/\./g, '-');
      }
    }

    // Helper to parse amount robustly (handles commas) - Already defined above
    
    return {
      id: `excel-cf-${Date.now()}-${index}`,
      source: combinedSource,
      amount: parseAmount(row['금액']),
      market,
      currency,
      date: dateStr,
      category,
      owner
    };
  });

  return cashFlows;
};
