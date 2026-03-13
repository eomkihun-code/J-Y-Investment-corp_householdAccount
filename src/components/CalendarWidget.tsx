import { useState, useMemo } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { format, parseISO, isSameMonth } from 'date-fns';
import { ko } from 'date-fns/locale';
import type { Transaction } from '../types/transaction';
import { Calendar as CalendarIcon, Trophy, AlertCircle } from 'lucide-react';

interface CalendarWidgetProps {
  transactions: Transaction[];
  onDayClick?: (dateStr: string) => void;
}

export default function CalendarWidget({ transactions, onDayClick }: CalendarWidgetProps) {
  // 달력에 표시될 기준 달 (기본값: 데이터 중 가장 최신 날짜 또는 현재 달)
  const [activeStartDate, setActiveStartDate] = useState<Date>(() => {
    const validDates = transactions.map(t => new Date(t.date).getTime()).filter(t => !isNaN(t));
    if (validDates.length > 0) {
      const maxDate = new Date(Math.max(...validDates));
      return new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
    }
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  
  // 현재 보고 있는 달력의 달(month)에 해당하는 거래 내역만 필터링
  const currentMonthTransactions = useMemo(() => {
    return transactions.filter(t => {
      try {
        return isSameMonth(parseISO(t.date), activeStartDate);
      } catch {
        return false;
      }
    });
  }, [transactions, activeStartDate]);

  // 일자별 지출/수입 합계 계산
  const { dailyExpenses, dailyIncomes } = useMemo(() => {
    const expenses: Record<string, number> = {};
    const incomes: Record<string, number> = {};
    
    currentMonthTransactions.forEach(tx => {
      try {
        const dateStr = format(parseISO(tx.date), 'yyyy-MM-dd');
        if (tx.type === 'expense') {
          expenses[dateStr] = (expenses[dateStr] || 0) + tx.amount;
        } else {
          incomes[dateStr] = (incomes[dateStr] || 0) + tx.amount;
        }
      } catch (e) {
        // 무시
      }
    });
    
    return { dailyExpenses: expenses, dailyIncomes: incomes };
  }, [currentMonthTransactions]);

  // 가장 많이 쓴 날 Top 3
  const topSpendingDays = useMemo(() => {
    return Object.entries(dailyExpenses)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([date, amount]) => ({ date, amount }));
  }, [dailyExpenses]);

  // 달력 내부 커스텀 컨텐츠 (점 찍기 및 총 지출 표기)
  const tileContent = ({ date, view }: { date: Date, view: string }) => {
    if (view !== 'month') return null;
    
    const dateStr = format(date, 'yyyy-MM-dd');
    const expense = dailyExpenses[dateStr];
    const income = dailyIncomes[dateStr];
    
    if (!expense && !income) return null;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '4px', fontSize: '0.7rem' }}>
        {expense > 0 && (
          <div style={{ color: 'var(--danger)', fontWeight: '600', marginBottom: '2px' }}>
            -{Math.round(expense / 10000)}만
          </div>
        )}
        {income > 0 && (
          <div style={{ color: 'var(--success)', fontWeight: '600' }}>
            +{Math.round(income / 10000)}만
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
      
      {/* Calendar Area */}
      <div className="glass custom-calendar-wrapper" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
          <div style={{ padding: '10px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '12px', color: 'var(--primary)' }}>
            <CalendarIcon size={24} />
          </div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600' }}>월간 달력</h3>
        </div>
        
        <div style={{ width: '100%', overflowX: 'auto', paddingBottom: '10px' }}>
          <Calendar 
            onChange={() => {}} 
            value={null}
            activeStartDate={activeStartDate}
            onActiveStartDateChange={({ activeStartDate, view }) => {
              if (view === 'month' && activeStartDate) {
                setActiveStartDate(activeStartDate);
              }
            }}
            calendarType="gregory"
            formatDay={(_locale, date) => format(date, 'd')}
            tileContent={tileContent}
            onClickDay={(value) => {
              if (onDayClick) {
                onDayClick(format(value, 'yyyy-MM-dd'));
              }
            }}
            className="react-calendar-dark"
          />
        </div>
      </div>

      {/* Top Spending Rankings */}
      <div className="glass" style={{ padding: '2rem', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem' }}>
          <div style={{ padding: '10px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '12px', color: 'var(--danger)' }}>
            <Trophy size={24} />
          </div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600' }}>이번 달 지출 랭킹</h3>
        </div>
        
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'center' }}>
          {topSpendingDays.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'var(--text-muted)', textAlign: 'center' }}>
              <AlertCircle size={32} style={{ marginBottom: '1rem', opacity: 0.5 }} />
              <p>해당 월에 지출 내역이 없습니다.</p>
            </div>
          ) : (
            topSpendingDays.map((item, index) => {
              const dateObj = parseISO(item.date);
              const isFirst = index === 0;
              
              return (
                <div 
                  key={item.date} 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    padding: isFirst ? '1.25rem' : '1rem',
                    background: isFirst ? 'rgba(239, 68, 68, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                    border: isFirst ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid var(--glass-border)',
                    borderRadius: '12px',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  {isFirst && (
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: 'var(--danger)' }}></div>
                  )}
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ 
                      width: isFirst ? '36px' : '28px', 
                      height: isFirst ? '36px' : '28px', 
                      borderRadius: '50%', 
                      background: isFirst ? 'var(--danger)' : 'var(--glass-bg)',
                      color: isFirst ? '#fff' : 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: '700',
                      fontSize: isFirst ? '1rem' : '0.85rem'
                    }}>
                      {index + 1}
                    </div>
                    <div>
                      <h4 style={{ fontSize: isFirst ? '1.1rem' : '0.95rem', fontWeight: isFirst ? '700' : '500', marginBottom: '4px' }}>
                        {format(dateObj, 'M월 d일 (E)', { locale: ko })}
                      </h4>
                      {isFirst && <p style={{ fontSize: '0.8rem', color: 'var(--danger)' }}>가장 코피 터진 날 🩸</p>}
                    </div>
                  </div>
                  
                  <div style={{ textAlign: 'right', fontWeight: '700', fontSize: isFirst ? '1.2rem' : '1rem', color: 'var(--danger)' }}>
                    ₩ {item.amount.toLocaleString()}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

    </div>
  );
}
