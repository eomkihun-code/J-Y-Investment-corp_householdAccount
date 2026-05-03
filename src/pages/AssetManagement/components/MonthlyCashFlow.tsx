import { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import '../styles/MonthlyCashFlow.css';
import type { CashFlow, MonthlyTrend, Owner } from '../types';

interface Props {
  cashFlows: CashFlow[];
  exchangeRate: number;
  targetMonth: string;
  onMonthChange: (month: string) => void;
  onCashFlowsChange: (flows: CashFlow[]) => void;
}

type TimelinePeriod = '3' | '6' | '12' | 'thisYear' | 'lastYear';
type CategoryFilter = 'Interest' | 'Dividend' | 'Rent' | 'Other';

interface FormState {
  date: string;
  source: string;
  amount: string;
  currency: 'KRW' | 'USD';
  category: CategoryFilter;
  owner: Owner;
  market: string;
}

const todayYMD = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const initialForm = (targetMonth: string): FormState => ({
  date: `${targetMonth}-${String(new Date().getDate()).padStart(2, '0')}`.length === 10
    ? `${targetMonth}-${String(new Date().getDate()).padStart(2, '0')}`
    : todayYMD(),
  source: '',
  amount: '',
  currency: 'KRW',
  category: 'Dividend',
  owner: 'Husband',
  market: '',
});

const generateId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `cf-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export default function MonthlyCashFlow({ cashFlows, exchangeRate, targetMonth, onMonthChange, onCashFlowsChange }: Props) {
  const [timeline, setTimeline] = useState<TimelinePeriod>('6');
  const [activeCategories, setActiveCategories] = useState<CategoryFilter[]>(['Interest', 'Dividend', 'Rent', 'Other']);
  const [activeOwners, setActiveOwners] = useState<string[]>(['Husband', 'Wife', 'Joint']);
  const [selectedBarMonth, setSelectedBarMonth] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(initialForm(targetMonth));
  const [formError, setFormError] = useState<string | null>(null);

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

  const openAddModal = () => {
    setForm(initialForm(targetMonth));
    setFormError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setFormError(null);
  };

  const handleFormChange = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(form.amount);
    if (!form.date || !form.source.trim() || isNaN(amountNum) || amountNum <= 0) {
      setFormError('날짜, 출처, 0보다 큰 금액은 필수입니다.');
      return;
    }
    const newFlow: CashFlow = {
      id: generateId(),
      date: form.date,
      source: form.source.trim(),
      amount: amountNum,
      currency: form.currency,
      category: form.category,
      owner: form.owner,
      market: form.market.trim() || (form.currency === 'USD' ? 'USD Market' : '국내'),
    };
    onCashFlowsChange([...cashFlows, newFlow]);
    closeModal();
  };

  const handleDelete = (id: string) => {
    if (!window.confirm('이 인컴 이력을 삭제하시겠어요?')) return;
    onCashFlowsChange(cashFlows.filter(cf => cf.id !== id));
  };

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
            <button
              type="button"
              className="add-income-btn"
              onClick={openAddModal}
              title="인컴 이력 추가"
            >
              <Plus size={14} />
              <span>추가</span>
            </button>
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
                  <span className="income-market">{cf.market} · {cf.date}</span>
                </div>
                <div className="income-right">
                  <div className={`income-amount ${cf.currency}`}>
                    {formatCurrency(cf.amount, cf.currency)}
                  </div>
                  <button
                    type="button"
                    className="income-delete-btn"
                    onClick={() => handleDelete(cf.id)}
                    title="삭제"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">데이터가 없습니다.</div>
        )}
      </div>

      {isModalOpen && (
        <div className="income-modal-overlay" onClick={closeModal}>
          <div className="income-modal" onClick={(e) => e.stopPropagation()}>
            <div className="income-modal-header">
              <h3>인컴 이력 추가</h3>
              <button type="button" className="close-btn" onClick={closeModal} title="닫기">
                <X size={16} />
              </button>
            </div>
            <form className="income-form" onSubmit={handleAddSubmit}>
              <div className="form-row">
                <label>
                  <span>날짜</span>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => handleFormChange('date', e.target.value)}
                    required
                  />
                </label>
                <label>
                  <span>출처</span>
                  <input
                    type="text"
                    value={form.source}
                    onChange={(e) => handleFormChange('source', e.target.value)}
                    placeholder="예: 삼성전자 배당, 월세"
                    required
                  />
                </label>
              </div>
              <div className="form-row">
                <label>
                  <span>금액</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={form.amount}
                    onChange={(e) => handleFormChange('amount', e.target.value)}
                    placeholder="숫자만 입력"
                    required
                  />
                </label>
                <label>
                  <span>통화</span>
                  <select
                    value={form.currency}
                    onChange={(e) => handleFormChange('currency', e.target.value as 'KRW' | 'USD')}
                  >
                    <option value="KRW">KRW</option>
                    <option value="USD">USD</option>
                  </select>
                </label>
              </div>
              <div className="form-row">
                <label>
                  <span>카테고리</span>
                  <select
                    value={form.category}
                    onChange={(e) => handleFormChange('category', e.target.value as CategoryFilter)}
                  >
                    <option value="Dividend">배당</option>
                    <option value="Interest">이자</option>
                    <option value="Rent">월세</option>
                    <option value="Other">기타</option>
                  </select>
                </label>
                <label>
                  <span>소유자</span>
                  <select
                    value={form.owner}
                    onChange={(e) => handleFormChange('owner', e.target.value as Owner)}
                  >
                    <option value="Husband">엄기훈</option>
                    <option value="Wife">최수진</option>
                    <option value="Joint">공동/기타</option>
                  </select>
                </label>
              </div>
              <div className="form-row">
                <label className="form-row-full">
                  <span>시장 (선택)</span>
                  <input
                    type="text"
                    value={form.market}
                    onChange={(e) => handleFormChange('market', e.target.value)}
                    placeholder="예: KOSPI, NYSE, 국내은행"
                  />
                </label>
              </div>

              {formError && <div className="form-error">{formError}</div>}

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={closeModal}>취소</button>
                <button type="submit" className="btn-primary">추가</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
