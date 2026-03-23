import { useState, useEffect } from 'react';
import '../styles/PortfolioAllocation.css';
import type { Account, MonthlyTrend } from '../types';
import { getMonthlyAssetHistory } from '../utils/stockPriceService';

interface Props {
  accounts: Account[];
  exchangeRate: number;
}

export default function PortfolioAllocation({ accounts, exchangeRate }: Props) {
  const [cashTrends, setCashTrends] = useState<MonthlyTrend[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const history = await getMonthlyAssetHistory(accounts, exchangeRate);
        setCashTrends(history);
      } catch (err) {
        console.error('Failed to fetch asset history:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [accounts, exchangeRate]);

  const convertToKRW = (balance: number, currency: string) => 
    currency === 'USD' ? balance * exchangeRate : balance;

  const totals = {
    Stock: accounts.filter(a => a.type === 'Stock').reduce((acc, curr) => acc + convertToKRW(curr.balance, curr.currency), 0),
    Bank: accounts.filter(a => a.type === 'Bank').reduce((acc, curr) => acc + convertToKRW(curr.balance, curr.currency), 0),
    RealEstate: accounts.filter(a => a.type === 'RealEstate').reduce((acc, curr) => acc + convertToKRW(curr.balance, curr.currency), 0),
    Crypto: accounts.filter(a => a.type === 'Crypto').reduce((acc, curr) => acc + convertToKRW(curr.balance, curr.currency), 0),
  };

  const totalNetWorth = totals.Stock + totals.Bank + totals.RealEstate + totals.Crypto;

  const getPercentage = (amount: number) => {
    return totalNetWorth === 0 ? 0 : ((amount / totalNetWorth) * 100).toFixed(1);
  };

  // Calculate degrees for conic-gradient
  const stockDeg = (totals.Stock / totalNetWorth) * 360;
  const bankDeg = (totals.Bank / totalNetWorth) * 360;
  const realEstateDeg = (totals.RealEstate / totalNetWorth) * 360;
  // Pension takes the rest

  const conicGradient = `conic-gradient(
    #bb86fc 0deg ${stockDeg}deg,
    #03dac6 ${stockDeg}deg ${stockDeg + bankDeg}deg,
    #4dabf7 ${stockDeg + bankDeg}deg ${stockDeg + bankDeg + realEstateDeg}deg,
    #ffd43b ${stockDeg + bankDeg + realEstateDeg}deg 360deg
  )`;


  return (
    <div className="card portfolio-card">
      <span className="dev-label">&lt;PortfolioAllocation /&gt;</span>
      <h3 className="text-secondary portfolio-title">포트폴리오 비중 (Portfolio Allocation)</h3>
      
      <div className="portfolio-content">
        <div className="chart-wrapper">
          <div className="donut-chart" style={{ background: conicGradient }}>
            <div className="donut-hole">
              <span className="hole-text">Total</span>
            </div>
          </div>
        </div>

        <div className="legend-container">
          <div className="legend-item">
            <span className="dot" style={{ backgroundColor: '#bb86fc' }}></span>
            <span className="legend-label">주식 (Stock)</span>
            <span className="legend-value">{getPercentage(totals.Stock)}%</span>
          </div>
          <div className="legend-item">
            <span className="dot" style={{ backgroundColor: '#03dac6' }}></span>
            <span className="legend-label">현금 (Bank)</span>
            <span className="legend-value">{getPercentage(totals.Bank)}%</span>
          </div>
          <div className="legend-item">
            <span className="dot" style={{ backgroundColor: '#4dabf7' }}></span>
            <span className="legend-label">부동산 (Real Est.)</span>
            <span className="legend-value">{getPercentage(totals.RealEstate)}%</span>
          </div>
          <div className="legend-item">
            <span className="dot" style={{ backgroundColor: '#ffd43b' }}></span>
            <span className="legend-label">가상자산 (Crypto)</span>
            <span className="legend-value">{getPercentage(totals.Crypto)}%</span>
          </div>
        </div>
      </div>

      {/* Monthly Asset Trend Chart (Stacked Bars) */}
      <div className="cash-trend-section">
        <h4 className="chart-title text-secondary">
          자산 현황 (최근 12개월)
          <div className="chart-legend">
            <span className="legend-item"><span className="legend-color cash-color"></span> 현금</span>
            <span className="legend-item"><span className="legend-color stock-color"></span> 주식</span>
          </div>
        </h4>
        <div className="portfolio-bar-chart">
          {loading ? (
            <div className="loading-spinner-small">데이터 분석 중...</div>
          ) : (
            <>
              {(() => {
                const maxAmt = Math.max(...cashTrends.map(t => t.amount), 1);
                return (
                  <div className="stacked-bars-container">
                    {cashTrends.map((t, i) => {
                      const cashPcnt = ((t.cashAmount || 0) / maxAmt) * 100;
                      const stockPcnt = ((t.stockAmount || 0) / maxAmt) * 100;
                      const totalM = Math.round(t.amount / 1000000);
                      const cashM = Math.round((t.cashAmount || 0) / 1000000);
                      const stockM = Math.round((t.stockAmount || 0) / 1000000);
                      
                      return (
                        <div key={i} className="portfolio-bar-wrapper">
                          <div className="portfolio-bar-value total-val">{totalM}M</div>
                          
                          <div className="portfolio-stacked-bar">
                            {/* Stock Segment (Top) */}
                            {stockPcnt > 0 && (
                              <div className="portfolio-bar-segment stock-segment" style={{ height: `${stockPcnt}%` }}>
                                {stockPcnt > 15 && <span className="segment-label">{stockM}M</span>}
                              </div>
                            )}
                            
                            {/* Cash Segment (Bottom) */}
                            {cashPcnt > 0 && (
                              <div className="portfolio-bar-segment cash-segment" style={{ height: `${cashPcnt}%` }}>
                                {cashPcnt > 15 && <span className="segment-label">{cashM}M</span>}
                              </div>
                            )}
                          </div>
                          <span className="portfolio-bar-label">{t.month}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
