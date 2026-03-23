import '../styles/TopSection.css';
import type { Account } from '../types';

interface Props {
  accounts: Account[];
  exchangeRate: number;
}

export default function TopSection({ accounts, exchangeRate }: Props) {
  const convertToKRW = (balance: number, currency: string) => 
    currency === 'USD' ? balance * exchangeRate : balance;

  const totalStocks = accounts.filter(a => a.type === 'Stock').reduce((acc, curr) => acc + convertToKRW(curr.balance, curr.currency), 0);
  
  // To calculate ROI, we need to know the cost. 
  // For simplicity, we'll try to sum (avgPrice * quantity) from holdings.
  const totalStockCost = accounts.filter(a => a.type === 'Stock').reduce((acc, curr) => {
    const cost = (curr.holdings || []).reduce((sum, h) => sum + (h.avgPrice * h.quantity), 0);
    return acc + convertToKRW(cost, curr.currency);
  }, 0);

  const totalCash = accounts.filter(a => a.type === 'Bank').reduce((acc, curr) => acc + convertToKRW(curr.balance, curr.currency), 0);
  const totalUsdCash = accounts.filter(a => a.type === 'Bank' && a.currency === 'USD').reduce((acc, curr) => acc + curr.balance, 0);
  const totalRealEstate = accounts.filter(a => a.type === 'RealEstate').reduce((acc, curr) => acc + convertToKRW(curr.balance, curr.currency), 0);
  const totalCrypto = accounts.filter(a => a.type === 'Crypto').reduce((acc, curr) => acc + convertToKRW(curr.balance, curr.currency), 0);

  const totalNetWorth = totalStocks + totalCash + totalRealEstate + totalCrypto;
  const stockROI = totalStockCost > 0 ? ((totalStocks - totalStockCost) / totalStockCost * 100) : 0;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(Math.round(amount)) + '원';
  };

  return (
    <section className="top-section">
      <div className="card total-net-worth-card">
        <span className="dev-label">&lt;TopSection /&gt;</span>
        <h2 className="text-secondary">Total Net Worth</h2>
        <div className="net-worth-value">
          <span className="amount">{formatCurrency(totalNetWorth)}</span>
          <span className={`percentage ${stockROI >= 0 ? 'text-positive' : 'text-negative'}`}>
            {stockROI >= 0 ? '+' : ''}{stockROI.toFixed(1)}% (주식 수익률)
          </span>
        </div>
      </div>

      <div className="sub-cards-grid">
        <div className="card sub-card">
          <div className="icon">📈</div>
          <div className="details">
            <span className="text-secondary label">총 주식</span>
            <span className="value">{formatCurrency(totalStocks)}</span>
          </div>
        </div>
        <div className="card sub-card">
          <div className="icon">💰</div>
          <div className="details">
            <span className="text-secondary label">총 현금</span>
            <span className="value">{formatCurrency(totalCash)}</span>
            {totalUsdCash > 0 && (
              <span className="usd-subvalue">
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalUsdCash)}
              </span>
            )}
          </div>
        </div>
        <div className="card sub-card">
          <div className="icon">🏠</div>
          <div className="details">
            <span className="text-secondary label">부동산</span>
            <span className="value">{formatCurrency(totalRealEstate)}</span>
          </div>
        </div>
        <div className="card sub-card">
          <div className="icon">🪙</div>
          <div className="details">
            <span className="text-secondary label">가상자산</span>
            <span className="value">{formatCurrency(totalCrypto)}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
