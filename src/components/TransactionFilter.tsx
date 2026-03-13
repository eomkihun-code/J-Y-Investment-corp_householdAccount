import { useState, useEffect } from 'react';
import { Search, Calendar as CalendarIcon, Filter } from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth, startOfYear, endOfYear, parseISO, isAfter, isBefore, isEqual, startOfDay, endOfDay } from 'date-fns';
import type { Transaction } from '../types/transaction';

export type DateRangePreset = 'all' | 'thisMonth' | 'lastMonth' | 'thisYear' | 'custom';

export interface FilterState {
  keyword: string;
  datePreset: DateRangePreset;
  customStartDate: string;
  customEndDate: string;
}

export interface ExternalDateRange {
  startDate: string;
  endDate: string;
}

interface TransactionFilterProps {
  transactions: Transaction[];
  onFilterChange: (filtered: Transaction[]) => void;
  externalDateRange?: ExternalDateRange | null;
}

export default function TransactionFilter({ transactions, onFilterChange, externalDateRange }: TransactionFilterProps) {
  const [filter, setFilter] = useState<FilterState>({
    keyword: '',
    datePreset: 'thisMonth',
    customStartDate: format(subMonths(new Date(), 1), 'yyyy-MM-dd'),
    customEndDate: format(new Date(), 'yyyy-MM-dd')
  });

  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // 외부에서 날짜 범위가 전달되면 필터 상태를 업데이트
  useEffect(() => {
    if (externalDateRange) {
      setFilter(prev => ({
        ...prev,
        datePreset: 'custom',
        customStartDate: externalDateRange.startDate,
        customEndDate: externalDateRange.endDate
      }));
      setIsFilterOpen(true);
    }
  }, [externalDateRange]);

  // transactions나 filter 상태가 바뀔 때마다 필터링 로직 수행
  useEffect(() => {
    let result = [...transactions];

    // 1. 키워드 필터링
    if (filter.keyword.trim() !== '') {
      const lowerKeyword = filter.keyword.toLowerCase();
      result = result.filter(tx => 
        tx.description.toLowerCase().includes(lowerKeyword) ||
        tx.category.toLowerCase().includes(lowerKeyword)
      );
    }

    // 2. 날짜 필터링
    const today = new Date();
    let startDate: Date | null = null;
    let endDate: Date | null = null;

    if (filter.datePreset === 'thisMonth') {
      startDate = startOfMonth(today);
      endDate = endOfMonth(today);
    } else if (filter.datePreset === 'lastMonth') {
      const lastMonth = subMonths(today, 1);
      startDate = startOfMonth(lastMonth);
      endDate = endOfMonth(lastMonth);
    } else if (filter.datePreset === 'thisYear') {
      startDate = startOfYear(today);
      endDate = endOfYear(today);
    } else if (filter.datePreset === 'custom') {
      if (filter.customStartDate) startDate = startOfDay(parseISO(filter.customStartDate));
      if (filter.customEndDate) endDate = endOfDay(parseISO(filter.customEndDate));
    }

    if (startDate || endDate) {
      result = result.filter(tx => {
        try {
          const txDate = parseISO(tx.date);
          if (startDate && isBefore(txDate, startDate) && !isEqual(txDate, startDate)) return false;
          if (endDate && isAfter(txDate, endDate) && !isEqual(txDate, endDate)) return false;
          return true;
        } catch {
          return false;
        }
      });
    }

    onFilterChange(result);
  }, [transactions, filter, onFilterChange]);

  const handleDatePresetChange = (preset: DateRangePreset) => {
    setFilter(prev => ({ ...prev, datePreset: preset }));
  };

  return (
    <div className="glass" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
        
        {/* Search Bar */}
        <div style={{ flex: '1 1 300px', position: 'relative' }}>
          <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
            <Search size={18} />
          </div>
          <input 
            type="text" 
            className="input-field" 
            placeholder="스타벅스, 쿠팡 등 키워드 검색..." 
            style={{ paddingLeft: '40px' }}
            value={filter.keyword}
            onChange={(e) => setFilter(prev => ({ ...prev, keyword: e.target.value }))}
          />
        </div>

        {/* Filter Toggle for Mobile / Details */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <div className="filter-presets" style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '4px' }}>
            <button 
              className={`btn ${filter.datePreset === 'thisMonth' ? 'btn-primary' : 'btn-ghost'}`} 
              style={{ padding: '6px 12px', fontSize: '0.85rem' }}
              onClick={() => handleDatePresetChange('thisMonth')}
            >이번 달</button>
            <button 
              className={`btn ${filter.datePreset === 'thisYear' ? 'btn-primary' : 'btn-ghost'}`} 
              style={{ padding: '6px 12px', fontSize: '0.85rem' }}
              onClick={() => handleDatePresetChange('thisYear')}
            >올해</button>
            <button 
              className={`btn ${filter.datePreset === 'all' ? 'btn-primary' : 'btn-ghost'}`} 
              style={{ padding: '6px 12px', fontSize: '0.85rem' }}
              onClick={() => handleDatePresetChange('all')}
            >전체</button>
          </div>
          
          <button 
            className={`btn ${isFilterOpen ? 'btn-primary' : 'btn-ghost'}`} 
            style={{ padding: '8px 12px', border: '1px solid var(--glass-border)' }}
            onClick={() => setIsFilterOpen(!isFilterOpen)}
          >
            <Filter size={18} />
            <span className="hidden-mobile">상세 필터</span>
          </button>
        </div>
      </div>

      {/* Expanded Custom Filter Panel */}
      {isFilterOpen && (
        <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--glass-border)', display: 'flex', flexWrap: 'wrap', gap: '1.5rem', animation: 'fadeIn 0.2s ease-out' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><CalendarIcon size={14} /> 커스텀 기간 설정</div>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input 
                type="date" 
                className="input-field" 
                style={{ width: 'auto' }}
                value={filter.customStartDate}
                onChange={(e) => {
                  setFilter(prev => ({ ...prev, datePreset: 'custom', customStartDate: e.target.value }));
                }}
              />
              <span style={{ color: 'var(--text-muted)' }}>~</span>
              <input 
                type="date" 
                className="input-field" 
                style={{ width: 'auto' }}
                value={filter.customEndDate}
                onChange={(e) => {
                  setFilter(prev => ({ ...prev, datePreset: 'custom', customEndDate: e.target.value }));
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
