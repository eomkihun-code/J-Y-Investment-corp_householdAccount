import { useMemo, useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
  LabelList
} from 'recharts';
import type { Transaction } from '../types/transaction';
import { format, parseISO, subMonths, differenceInMonths } from 'date-fns';
import { ko } from 'date-fns/locale';

interface AnalyticsChartsProps {
  transactions: Transaction[];
  onCategoryClick: (category: string) => void;
  selectedCategory: string | null;
  onBarClick?: (monthStr: string) => void;
}

type ChartDuration = 'all' | '1' | '3' | '6' | '12';

const COLORS = ['#6366f1', '#a855f7', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#3b82f6', '#64748b'];

export default function AnalyticsCharts({ 
  transactions, 
  selectedCategory, 
  onCategoryClick,
  onBarClick 
}: AnalyticsChartsProps) {
  const version = "v1.2.1-stable"; // Version stamp for verification
  const [duration, setDuration] = useState<ChartDuration>('12');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsMounted(true), 500);
    return () => clearTimeout(timer);
  }, []);
  
  // 1. 월별 수입/지출 추이 데이터 가공
  const monthlyData = useMemo(() => {
    const filteredByCat = selectedCategory 
      ? transactions.filter(t => t.category === selectedCategory)
      : transactions;

    // 1. 선택된 기간에 따른 개월 수 및 목록 생성
    const months = [];
    const today = new Date();
    
    let monthCount = 12;
    if (duration === 'all') {
      const allDates = transactions.map(t => parseISO(t.date).getTime()).filter(t => !isNaN(t));
      if (allDates.length > 0) {
        const minDate = new Date(Math.min(...allDates));
        monthCount = Math.max(1, differenceInMonths(today, minDate) + 1);
        if (monthCount > 36) monthCount = 36; // 최대 3년으로 제한
      }
    } else {
      monthCount = parseInt(duration);
    }

    for (let i = monthCount - 1; i >= 0; i--) {
      const d = subMonths(today, i);
      const mLabel = format(d, 'yy.MM', { locale: ko });
      months.push(mLabel);
    }

    return months.map(m => {
      const monthTxs = filteredByCat.filter(t => format(parseISO(t.date), 'yy.MM') === m);
      const income = monthTxs.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
      const expense = monthTxs.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
      return {
        month: m,
        income,
        expense: Math.abs(expense)
      };
    });
  }, [transactions, selectedCategory, duration]);

  // 2. 카테고리별 지출 비율 데이터 가공
  const expenseByCategory = useMemo(() => {
    const expenses = transactions.filter(t => t.type === 'expense');
    const categories: Record<string, number> = {};
    expenses.forEach(t => {
      categories[t.category] = (categories[t.category] || 0) + Math.abs(t.amount);
    });

    return Object.entries(categories)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [transactions]);

  // 금액 포맷터 (단위: 만원)
  const formatAmount = (val: any) => {
    const num = Number(val || 0);
    if (num === 0) return '';
    if (num >= 10000) {
      return `${Math.floor(num / 10000)}만`;
    }
    return num.toLocaleString();
  };

  if (!isMounted) {
    return <div style={{ minHeight: '600px' }} />; // Placeholder to maintain layout
  }

  return (
    <div className="stats-grid notranslate" translate="no" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(0, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
      
      {/* Monthly Bar Chart v1.1 */}
      <div className="glass" style={{ padding: '1.5rem' }}>
        <div className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '600' }}>
            월별 수입/지출 추이 {selectedCategory && <span style={{ color: 'var(--primary)', fontSize: '0.9rem', marginLeft: '8px' }}>({selectedCategory}만 표시 중)</span>}
          </h3>
          <div className="filter-presets" style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '4px', gap: '2px' }}>
            {[
              { label: '전체', value: 'all' },
              { label: '당월', value: '1' },
              { label: '3개월', value: '3' },
              { label: '6개월', value: '6' },
              { label: '1년', value: '12' },
            ].map(preset => (
              <button
                key={preset.value}
                className={`btn ${duration === preset.value ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '4px 8px', fontSize: '0.75rem', borderRadius: '6px' }}
                onClick={() => setDuration(preset.value as ChartDuration)}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ width: '100%', minHeight: '300px' }}>
          <ResponsiveContainer width="100%" aspect={1.5}>
            <BarChart
              data={monthlyData}
              margin={{ top: 20, right: 10, left: 10, bottom: 0 }}
              onClick={(data) => {
                if (data && data.activeLabel && onBarClick) {
                  onBarClick(String(data.activeLabel));
                }
              }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis 
                dataKey="month" 
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                dy={10}
              />
              <YAxis 
                hide 
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(15, 23, 42, 0.9)', 
                  borderRadius: '12px', 
                  border: '1px solid var(--glass-border)',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                }}
                itemStyle={{ fontSize: '12px' }}
                formatter={(val: any) => `₩${Number(val || 0).toLocaleString()}`}
              />
              <Bar dataKey="income" fill="var(--success)" radius={[4, 4, 0, 0]} barSize={20}>
                <LabelList dataKey="income" position="top" formatter={formatAmount} style={{ fill: 'var(--success)', fontSize: '10px', fontWeight: '500' }} />
              </Bar>
              <Bar dataKey="expense" fill="var(--danger)" radius={[4, 4, 0, 0]} barSize={20}>
                <LabelList dataKey="expense" position="top" formatter={formatAmount} style={{ fill: 'var(--danger)', fontSize: '10px', fontWeight: '500' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Expense Pie Chart */}
      <div className="glass" style={{ padding: '1.5rem' }}>
        <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem', fontWeight: '600' }}>카테고리별 지출 비율</h3>
        <div style={{ width: '100%', minHeight: '300px' }}>
          <ResponsiveContainer width="100%" aspect={1.5}>
            <PieChart>
              <Pie
                data={expenseByCategory}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
                onClick={(data) => {
                  if (data && data.name) {
                    onCategoryClick(data.name);
                  }
                }}
                style={{ cursor: 'pointer' }}
              >
                {expenseByCategory.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(15, 23, 42, 0.9)', 
                  borderRadius: '12px', 
                  border: '1px solid var(--glass-border)' 
                }}
                formatter={(val: any) => `₩${Number(val || 0).toLocaleString()}`}
              />
              <Legend 
                layout="vertical" 
                align="right" 
                verticalAlign="middle"
                iconType="circle"
                wrapperStyle={{ paddingLeft: '20px', fontSize: '12px' }}
                onClick={(data) => {
                  if (data && data.value) {
                    onCategoryClick(data.value);
                  }
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
}
