import type { Account, CashFlow, MonthlyTrend } from '../types';

export const mockAccounts: Account[] = [
  // 엄기훈 Accounts
  { 
    id: '1', name: 'NH투자증권', owner: 'Husband', type: 'Stock', balance: 37500000, currency: 'KRW', category: '국내주식',
    holdings: [
      {
        symbol: '삼성전자', quantity: 500, avgPrice: 70000, currentPrice: 75000, currency: 'KRW', code: '005930',
        transactions: [
          { date: '2023-01-10', type: '매수', quantity: 200, price: 65000 },
          { date: '2023-06-15', type: '매수', quantity: 300, price: 73333 }
        ]
      }
    ]
  },
  { 
    id: '2', name: '키움증권', owner: 'Husband', type: 'Stock', balance: 76500, currency: 'USD', category: '해외주식',
    holdings: [
      {
        symbol: 'SPY', quantity: 150, avgPrice: 400, currentPrice: 510, currency: 'USD', code: 'SPY',
        transactions: [
          { date: '2023-02-20', type: '매수', quantity: 100, price: 380 },
          { date: '2023-11-05', type: '매수', quantity: 50, price: 440 }
        ]
      }
    ]
  },
  { 
    id: '3', name: '국민은행', owner: 'Husband', type: 'Bank', balance: 15000000, currency: 'KRW', category: '주거래',
    history: { '2023-10-31': 14000000, '2023-11-30': 14500000, '2023-12-31': 15500000, '2024-01-31': 15000000, '2024-02-28': 15000000, '2024-03-15': 15000000 }
  },
  { 
    id: '4', name: '토스뱅크', owner: 'Husband', type: 'Bank', balance: 35000000, currency: 'KRW', category: '파킹',
    history: { '2023-12-31': 30000000, '2024-01-31': 32000000, '2024-02-28': 35000000 }
  },
  { id: '5', name: '업비트', owner: 'Husband', type: 'Crypto', balance: 25000000, currency: 'KRW', category: '비트코인' },
  
  // 최수진 Accounts
  { 
    id: '6', name: '한국투자증권', owner: 'Wife', type: 'Stock', balance: 92000000, currency: 'KRW', category: '해외주식',
    holdings: [
      {
        symbol: 'TIGER 미국 S&P500', quantity: 4000, avgPrice: 20000, currentPrice: 23000, currency: 'KRW', code: '360750',
        transactions: [
          { date: '2023-01-05', type: '매수', quantity: 2000, price: 18000 },
          { date: '2023-10-10', type: '매수', quantity: 2000, price: 22000 }
        ]
      }
    ]
  },
  { 
    id: '7', name: '신한은행', owner: 'Wife', type: 'Bank', balance: 22000000, currency: 'KRW', category: '주거래',
    history: { '2023-12-31': 20000000, '2024-01-31': 21000000, '2024-02-28': 22000000 }
  },
  { 
    id: '8', name: '케이뱅크', owner: 'Wife', type: 'Bank', balance: 18000000, currency: 'KRW', category: '파킹',
    history: { '2023-12-31': 15000000, '2024-01-31': 16000000, '2024-02-28': 18000000 }
  },
  { id: '9', name: '빗썸', owner: 'Wife', type: 'Crypto', balance: 30000000, currency: 'KRW', category: '알트코인' },
  
  // Joint / Real Estate
  { id: '10', name: '한강자이아파트', owner: 'Joint', type: 'RealEstate', balance: 850000000, currency: 'KRW', category: '실거주' }
];

export const mockCashFlows: CashFlow[] = [
  { id: '1', source: '🏠 오피스텔 월세', amount: 850000, currency: 'KRW', market: '국내', date: '2026-03-01', category: 'Rent', owner: 'Joint' },
  { id: '2', source: '📉 해외주식 배당', amount: 320, currency: 'USD', market: '미국', date: '2026-03-10', category: 'Dividend', owner: 'Husband' },
  { id: '3', source: '🏦 파킹통장 이자', amount: 120000, currency: 'KRW', market: '국내', date: '2026-02-15', category: 'Interest', owner: 'Husband' },
  { id: '4', source: '💰 예금 이자', amount: 250000, currency: 'KRW', market: '국내', date: '2026-03-20', category: 'Interest', owner: 'Wife' },
];

export const mockMonthlyTrends: MonthlyTrend[] = [
  { month: '10월', amount: 1100000 },
  { month: '11월', amount: 1150000 },
  { month: '12월', amount: 1250000 },
  { month: '1월', amount: 1500000 },
  { month: '2월', amount: 1220000 },
  { month: '3월', amount: 1290000 },
];
