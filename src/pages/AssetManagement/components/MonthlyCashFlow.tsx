import { useState } from 'react';
import '../styles/MonthlyCashFlow.css';
import type { CashFlow, MonthlyTrend } from '../types';

interface Props {
  cashFlows: CashFlow[];
  exchangeRate: number;
  targetMonth: string;
  onMonthChange: (month: string) => void;
}

type TimelinePeriod = '3' | '6' | '12' | 'thisYear' | 'lastYear';
type CategoryFilter = 'Interest' | 'Dividend' | 'Rent' | 'Other';

export default function MonthlyCashFlow({ cashFlows, exchangeRate, targetMonth, onMonthChange }: Props) {
  const [timeline, setTimeline] = useState<TimelinePeriod>('6');
  const [activeCategories, setActiveCategories] = useState<CategoryFilter[]>(['Interest', 'Dividend', 'Rent', 'Other']);
  const [activeOwners, setActiveOwners] = useState<string[]>(['Husband', 'Wife', 'Joint']);
  const [selectedBarMonth, setSelectedBarMonth] = useState<string | null>(null);

  // 1. Filter and Group by month
  const monthlyTotals: Record<string, number> = {};
  const monthDetails: Record<string, CashFlow[]> = {};
  const ownerBreakdown: Record<string, Record<string, number>> = {};
  
  const filteredFlows = cashFlows.filter(cf => 
    activeCategories.includes(cf.category) && 
    activeOwners.includes(cf.owner)
  );

  filteredFlows.forEach(cf => {
    const month = cf.date.substring(0, 7); // YYYY-MM
    let amountInKRW = cf.currency === 'USD' ? cf.amount * exchangeRate : cf.amount;
    if (isNaN(amountInKRW)) amountInKRW = 0;
    
    monthlyTotals[month] = (monthlyTotals[month] || 0) + amountInKRW;
    
    if (!monthDetails[month]) monthDetails[month] = [];
    monthDetails[month].push(cf);

    if (!ownerBreakdown[month]) ownerBreakdown[month] = {};
    ownerBreakdown[month][cf.owner] = (ownerBreakdown[month][cf.owner] || 0) + amountInKRW;
  });

  // 2. Options for Selector and Timeline
  const monthOptions: string[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    monthOptions.push(`${yr}-${mo}`);
  }

  const currentMonthData = monthDetails[targetMonth] || [];
  const totalPassiveIncome = monthlyTotals[targetMonth] || 0;

  const krwSubtotal = currentMonthData
    .filter(cf => cf.currency === 'KRW')
    .reduce((sum, cf) => sum + cf.amount, 0);
  const usdSubtotal = currentMonthData
    .filter(cf => cf.currency === 'USD')
    .reduce((sum, cf) => sum + cf.amount, 0);

  // 3. Trends based on timeline
  const trends: (MonthlyTrend & { fullMonth: string })[] = [];
  const [targetYear, targetMonthNum] = targetMonth.split('-').map(Number);
  
  let startMonth: Date;
  let endMonth: Date;

  if (timeline === 'thisYear') {
    startMonth = new Date(targetYear, 0, 1);
    endMonth = new Date(targetYear, targetMonthNum - 1, 1);
  } else if (timeline === 'lastYear') {
    startMonth = new Date(targetYear - 1, 0, 1);
    endMonth = new Date(targetYear - 1, 11, 1);
  } else {
    const periodCount = parseInt(timeline);
    endMonth = new Date(targetYear, targetMonthNum - 1, 1);
    startMonth = new Date(targetYear, targetMonthNum - periodCount, 1);
  }

  // Generate months in range
  const curr = new Date(startMonth);
  while (curr <= endMonth) {
    const yearStr = curr.getFullYear();
    const monthStr = String(curr.getMonth() + 1).padStart(2, '0');
    const monthKey = `${yearStr}-${monthStr}`;
    trends.push({
      month: `${curr.getMonth() + 1}월`,
      amount: monthlyTotals[monthKey] || 0,
      fullMonth: monthKey
    });
    curr.setMonth(curr.getMonth() + 1);
  }

  const formatCurrency = (amount: number, currency: string = 'KRW') => {
    if (currency === 'USD') {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    }
    return new Intl.NumberFormat('ko-KR').format(Math.round(amount)) + '원';
  };

  const handleCategoryToggle = (cat: CategoryFilter) => {
    setActiveCategories(prev => 
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const handleOwnerToggle = (owner: string) => {
    setActiveOwners(prev => 
      prev.includes(owner) ? prev.filter(o => o !== owner) : [...prev, owner]
    );
  };

  const formatBarLabel = (amount: number) => {
    if (amount === 0) return '';
    const manWon = Math.round(amount / 10000);
    return manWon > 0 ? `${manWon}만` : '';
  };

  const maxAmount = Math.max(...trends.map(t => t.amount), 1);

  // 4. Calculate Period-wide Owner Totals (Always Visible)
  const periodOwnerTotals: Record<string, number> = { Husband: 0, Wife: 0, Joint: 0 };
  let periodGrandTotal = 0;

  trends.forEach(t => {
    const breakdown = ownerBreakdown[t.fullMonth] || {};
    Object.keys(breakdown).forEach(ownerKey => {
      const amount = breakdown[ownerKey];
      periodGrandTotal += amount;
      
      // Map back to canonical keys if needed (Defensive)
      if (ownerKey === 'Husband') periodOwnerTotals.Husband += amount;
      else if (ownerKey === 'Wife') periodOwnerTotals.Wife += amount;
      else periodOwnerTotals.Joint += amount; // Fallback any others to Joint
    });
  });

  const getTimelineLabel = (t: TimelinePeriod) => {
    if (t === 'thisYear') return '올해';
    if (t === 'lastYear') return '전년도';
    if (t === '12') return '1년';
    return `${t}개월`;
  }

  return (
    <div className="card cash-flow-card notranslate">
      <div className="cash-flow-header">
        <div className="flex-between">
          <h3 className="text-secondary">{targetMonth.split('-')[0]}년 {parseInt(targetMonth.split('-')[1])}월 패시브 인컴</h3>
          <div className="header-controls">
            <select 
              className="month-selector"
              value={targetMonth}
              onChange={(e) => onMonthChange(e.target.value)}
            >
              {monthOptions.map(m => (
                <option key={m} value={m}>{m.replace('-', '년 ')}월</option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="income-summary-grid">
          <div className="summary-item main">
            <span className="label">합계 (환율적용)</span>
            <span className="value">{formatCurrency(totalPassiveIncome)}</span>
          </div>
          <div className="summary-item secondary">
            <span className="label">KRW 소계</span>
            <span className="value">{formatCurrency(krwSubtotal)}</span>
          </div>
          <div className="summary-item secondary">
            <span className="label">USD 소계</span>
            <span className="value">{formatCurrency(usdSubtotal, 'USD')}</span>
          </div>
        </div>

        <div className="filters-row">
          <div className="period-btns">
            {(['3', '6', 'thisYear', 'lastYear', '12'] as TimelinePeriod[]).map(p => (
              <button 
                key={p} 
                className={`period-btn ${timeline === p ? 'active' : ''}`}
                onClick={() => setTimeline(p)}
              >
                {getTimelineLabel(p)}
              </button>
            ))}
          </div>
          <div className="filter-groups">
            <div className="category-checkboxes">
              {[
                { id: 'Interest', label: '이자' },
                { id: 'Dividend', label: '배당' },
                { id: 'Rent', label: '월세' },
                { id: 'Other', label: '기타' }
              ].map(cat => (
                <label key={cat.id} className="checkbox-label">
                  <input 
                    type="checkbox" 
                    checked={activeCategories.includes(cat.id as CategoryFilter)}
                    onChange={() => handleCategoryToggle(cat.id as CategoryFilter)}
                  />
                  <span>{cat.label}</span>
                </label>
              ))}
            </div>
            <div className="owner-checkboxes">
              {[
                { id: 'Husband', label: '엄기훈' },
                { id: 'Wife', label: '최수진' },
                { id: 'Joint', label: '공동/기타' }
              ].map(own => (
                <label key={own.id} className="checkbox-label owner">
                  <input 
                    type="checkbox" 
                    checked={activeOwners.includes(own.id)}
                    onChange={() => handleOwnerToggle(own.id)}
                  />
                  <span>{own.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="exchange-rate-info">
          적용 환율: 1$ = {formatCurrency(exchangeRate)}
        </div>
      </div>

      <div className="chart-container">
        <h4 className="chart-title text-secondary">수입 추이 ({getTimelineLabel(timeline)})</h4>
        <div className="bar-chart interactable">
          {trends.map((trend, idx) => {
            const heightPercentage = (trend.amount / maxAmount) * 100;
            const isSelected = selectedBarMonth === trend.fullMonth;
            return (
              <div 
                className={`bar-wrapper ${isSelected ? 'selected' : ''}`} 
                key={idx}
                onClick={() => setSelectedBarMonth(trend.fullMonth === selectedBarMonth ? null : trend.fullMonth)}
              >
                <div 
                  className="bar-static-label"
                  style={{ bottom: `calc(${heightPercentage}% + 6px)` }}
                >
                  {formatBarLabel(trend.amount)}
                </div>
                <div 
                  className="bar" 
                  style={{ height: `${heightPercentage}%` }}
                ></div>
                <span className="bar-label">{trend.month}</span>
              </div>
            );
          })}
        </div>

        <div className="owner-breakdown-box visible">
          <div className="breakdown-month flex-between" style={{ marginBottom: '12px' }}>
            <span className="text-secondary">{getTimelineLabel(timeline)} 소유자별 합계</span>
            <span className="grand-total" style={{ color: 'var(--accent-secondary)', fontWeight: 700 }}>
              총 {formatCurrency(periodGrandTotal)}
            </span>
          </div>
          <div className="breakdown-grid">
            <div className="breakdown-item husband">
              <span className="label">엄기훈</span>
              <span className="value">{formatCurrency(periodOwnerTotals['Husband'] || 0)}</span>
            </div>
            <div className="breakdown-item wife">
              <span className="label">최수진</span>
              <span className="value">{formatCurrency(periodOwnerTotals['Wife'] || 0)}</span>
            </div>
            <div className="breakdown-item joint">
              <span className="label">공동/기타</span>
              <span className="value">{formatCurrency(periodOwnerTotals['Joint'] || 0)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="detail-list-container">
        <h4 className="section-title text-secondary">상세 수입 내역</h4>
        {currentMonthData.length > 0 ? (
          <div className="income-list">
            {currentMonthData.map(cf => (
              <div key={cf.id} className="income-item">
                <div className="income-info">
                  <span className="income-source">{cf.source}</span>
                  <span className="income-market">{cf.market}</span>
                </div>
                <div className={`income-amount ${cf.currency}`}>
                  {formatCurrency(cf.amount, cf.currency)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">데이터가 없습니다.</div>
        )}
      </div>
    </div>
  );
}
