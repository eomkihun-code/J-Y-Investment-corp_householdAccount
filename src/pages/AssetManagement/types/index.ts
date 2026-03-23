export type Owner = 'Husband' | 'Wife' | 'Joint';
export type AssetType = 'Stock' | 'Bank' | 'Crypto' | 'RealEstate';

export interface Transaction {
  date: string; // YYYY-MM-DD
  type: '매수' | '매도';
  quantity: number;
  price: number;
}

export interface Holding {
  symbol: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number; // Price from Excel
  currency: string;
  code?: string;
  transactions?: Transaction[];
}

export interface Account {
  id: string;
  name: string;
  owner: Owner;
  type: AssetType;
  balance: number;
  currency: string;
  category: string; // e.g., '국내주식', '해외주식', '주거래', '파킹', 'IRP', '연금저축'
  history?: { [date: string]: number };
  holdings?: Holding[];
}

export interface CashFlow {
  id: string;
  source: string; // e.g., '월세', '배당', '이자'
  amount: number;
  currency: 'KRW' | 'USD';
  market: string;
  date: string; // YYYY-MM-DD
  category: 'Interest' | 'Dividend' | 'Rent' | 'Other';
  owner: Owner;
}

export interface MonthlyTrend {
  month: string;
  amount: number;
  cashAmount?: number;
  stockAmount?: number;
}
