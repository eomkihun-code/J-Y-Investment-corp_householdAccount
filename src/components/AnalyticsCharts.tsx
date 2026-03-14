import { useMemo } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import type { Transaction } from '../types/transaction';
import { format, parseISO, subMonths } from 'date-fns';
import { ko } from 'date-fns/locale';

interface AnalyticsChartsProps {
  transactions: Transaction[];
  onCategoryClick?: (category: string) => void;
  selectedCategory?: string | null;
  onBarClick?: (monthStr: string) => void;
}

const COLORS = ['#6366f1', '#a855f7', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#3b82f6', '#64748b'];

export default function AnalyticsCharts({ transactions, onCategoryClick, selectedCategory, onBarClick }: AnalyticsChartsProps) {
  
  // 1. 월별 수입/지출 추이 데이터 가공
  const monthlyData = useMemo(() => {
    // If a category is selected, filter transactions first
    const chartTransactions = selectedCategory 
      ? transactions.filter(t => t.category === selectedCategory)
      : transactions;

    // 1. 최근 12개월 목록 생성 (데이터가 없더라도 12개가 나오도록)
    const months = [];
    const today = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = subMonths(today, i);
      const mLabel = format(d, 'yyyy년 MM월', { locale: ko });
      months.push(mLabel);
    }
    
    if (chartTransactions.length > 0) {
      console.log('Chart Debug - First TX Date:', chartTransactions[0].date);
      console.log('Chart Debug - First TX Parsed Month:', format(parseISO(chartTransactions[0].date), 'yyyy년 MM월', { locale: ko }));
    }

    const grouped = chartTransactions.reduce((acc, tx) => {
      try {
        const month = format(parseISO(tx.date), 'yyyy년 MM월', { locale: ko });
        if (acc[month]) {
          if (tx.type === 'income') acc[month].수입 += Math.abs(tx.amount);
          if (tx.type === 'expense') acc[month].지출 += Math.abs(tx.amount);
        }
      } catch (e) { /* ignore */ }
      return acc;
    }, months.reduce((acc, m) => {
      acc[m] = { name: m, 수입: 0, 지출: 0 };
      return acc;
    }, {} as Record<string, any>));

    console.log('Months keys:', months);
    const result = months.map(m => grouped[m]);
    console.log('Monthly Data result (mapped):', result);
    return result;
  }, [transactions, selectedCategory]);

  // 2. 카테고리별 지출 형태 요약 데이터 가공 (도넛 차트용)
  const categoryData = useMemo(() => {
    const expenses = transactions.filter(t => t.type === 'expense');
    const grouped = expenses.reduce((acc, tx) => {
      acc[tx.category] = (acc[tx.category] || 0) + Math.abs(tx.amount);
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value); // 높은 금액 순
  }, [transactions]);

  if (transactions.length === 0) {
    return (
      <div className="glass" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        엑셀 파일을 업로드하여 차트 분석을 확인해보세요.
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
      
      {/* Monthly Bar Chart */}
      <div className="glass" style={{ padding: '1.5rem' }}>
        <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem', fontWeight: '600' }}>
          월별 수입/지출 추이 {selectedCategory && <span style={{ color: 'var(--primary)', fontSize: '0.9rem', marginLeft: '8px' }}>({selectedCategory}만 표시 중)</span>}
        </h3>
        <div style={{ width: '100%', height: '300px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={monthlyData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis 
                dataKey="name" 
                stroke="var(--text-muted)" 
                fontSize={9} 
                tickLine={false} 
                axisLine={false} 
                interval={0}
                angle={-15}
                textAnchor="end"
                height={60}
              />
              <YAxis 
                stroke="var(--text-muted)" 
                fontSize={12} 
                tickLine={false} 
                axisLine={false}
                tickFormatter={(val) => `₩${(val / 10000).toFixed(0)}만`} 
              />
              <Tooltip 
                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-main)' }}
                formatter={(value: any) => `₩ ${Number(value).toLocaleString()}`}
              />
              <Legend 
                wrapperStyle={{ paddingTop: '20px' }} 
                formatter={(value) => <span className="notranslate">{value}</span>}
              />
              <Bar name="수입" dataKey="수입" fill="var(--success)" radius={[4, 4, 0, 0]} maxBarSize={40} style={{ cursor: onBarClick ? 'pointer' : 'default' }} onClick={(data: any) => { if (onBarClick && data?.name) onBarClick(data.name); }} />
              <Bar name="지출" dataKey="지출" fill="var(--danger)" radius={[4, 4, 0, 0]} maxBarSize={40} style={{ cursor: onBarClick ? 'pointer' : 'default' }} onClick={(data: any) => { if (onBarClick && data?.name) onBarClick(data.name); }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category Donut Chart */}
      <div className="glass" style={{ padding: '1.5rem' }}>
        <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem', fontWeight: '600' }}>카테고리별 지출 비율 (누적)</h3>
        {categoryData.length > 0 ? (
          <div style={{ width: '100%', height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                  onClick={(data) => {
                    if (onCategoryClick && data && data.name) {
                      onCategoryClick(data.name);
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  {categoryData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'var(--text-main)' }}
                  formatter={(value: any) => `₩ ${Number(value).toLocaleString()}`}
                />
                <Legend 
                  layout="vertical" 
                  verticalAlign="middle" 
                  align="right" 
                  wrapperStyle={{ paddingLeft: '20px', cursor: onCategoryClick ? 'pointer' : 'default' }} 
                  onClick={(e: any) => {
                    if (onCategoryClick && e && e.value) {
                      onCategoryClick(e.value);
                    }
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            지출 내역이 없습니다.
          </div>
        )}
      </div>

    </div>
  );
}
