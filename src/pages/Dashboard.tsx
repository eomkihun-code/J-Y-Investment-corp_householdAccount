import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  ArrowDownRight, 
  Wallet, 
  Plus, 
  LogOut,
  ShoppingCart,
  Trash2
} from 'lucide-react';
import { parseISO, format, startOfMonth, endOfMonth } from 'date-fns';
import { ko } from 'date-fns/locale';
import html2canvas from 'html2canvas';
import CsvUploadWidget from '../components/CsvUploadWidget';
import TransactionFilter from '../components/TransactionFilter';
import type { ExternalDateRange } from '../components/TransactionFilter';
import AnalyticsCharts from '../components/AnalyticsCharts';
import CalendarWidget from '../components/CalendarWidget';
import BudgetManager from '../components/BudgetManager';
import type { Transaction } from '../types/transaction';
import { useRef } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Dashboard() {
  const dashboardRef = useRef<HTMLDivElement>(null);
  const [session, setSession] = useState<any>(null);
  // const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<string[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [externalDateRange, setExternalDateRange] = useState<ExternalDateRange | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 세션 정보 가져오기 및 데이터 로드
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchTransactions(session.user.id);
      } else {
        setIsLoading(false);
      }
    });
  }, []);

  const fetchTransactions = async (userId: string) => {
    try {
      setIsLoading(true);
      // Supabase 1000개 제한 우회를 위해 여러 페이지 요청 (총 3000개 예상)
      const [p1, p2, p3] = await Promise.all([
        supabase.from('transactions').select('*').eq('user_id', userId).order('date', { ascending: false }).range(0, 999),
        supabase.from('transactions').select('*').eq('user_id', userId).order('date', { ascending: false }).range(1000, 1999),
        supabase.from('transactions').select('*').eq('user_id', userId).order('date', { ascending: false }).range(2000, 2999)
      ]);

      const data = [...(p1.data || []), ...(p2.data || []), ...(p3.data || [])];
      
      if (data.length > 0) {
        // DB format to internal Transaction format if needed
        const mapped = data.map(d => {
          const amountValue = typeof d.amount === 'number' ? d.amount : Number(String(d.amount).replace(/[^0-9.-]/g, ''));
          
          return {
            id: d.id,
            date: d.date,
            amount: amountValue,
            description: d.content,
            category: d.category || '기타',
            type: d.type || (amountValue >= 0 && (d.content.includes('입금') || d.category === '수입') ? 'income' : 'expense'),
            cardType: d.payment_method || '',
            fileName: d.file_name
          };
        }) as Transaction[];
        
        // Sheet1(결제내역) 파일 업로드를 통해 생성된 내역만 필터링 
        // (file_name이 없는 유령 고정비 데이터 등을 통계에서 제외)
        const sheetTransactions = mapped.filter(t => t.fileName && t.fileName.trim() !== '');
        setTransactions(sheetTransactions);
        
        const files = Array.from(new Set(data.map(d => d.file_name).filter(Boolean)));
        setUploadedFiles(files);
      }
    } catch (e) {
      console.error("Failed to fetch transactions", e);
    } finally {
      setIsLoading(false);
    }
  };

  // 월별 막대 그래프 클릭 시 해당 월로 기간 변경
  const handleBarClick = useCallback((monthStr: string) => {
    const match = monthStr.match(/(\d{4})년\s*(\d{2})월/);
    if (match) {
      const year = parseInt(match[1]);
      const month = parseInt(match[2]) - 1; // 0-indexed
      const targetDate = new Date(year, month, 1);
      const start = format(startOfMonth(targetDate), 'yyyy-MM-dd');
      const end = format(endOfMonth(targetDate), 'yyyy-MM-dd');
      setExternalDateRange({ startDate: start, endDate: end });
    }
  }, []);

  // 모달 배경 스크롤 방지
  useEffect(() => {
    if (selectedDateStr) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [selectedDateStr]);

  // 통계 데이터 가공
  const stats = useMemo(() => {
    if (filteredTransactions.length === 0) {
      return {
        latestMonthStr: '조회 기간',
        currentExpense: 0, lastExpense: 0, expenseDiffRate: 0,
        currentIncome: 0, lastIncome: 0, incomeDiffRate: 0,
        currentNet: 0
      };
    }
    
    // 전체 필터링된 데이터에 대한 합계 계산 (더 견고한 루프로 변경)
    let currentExpense = 0;
    let currentIncome = 0;
    const monthsSet = new Set<string>();
    
    filteredTransactions.forEach(t => {
      monthsSet.add(format(parseISO(t.date), 'yyyy-MM'));
      if (t.type === 'expense') {
        currentExpense += t.amount; // 취소 내역(-값)이 합산되면서 자연스럽게 차감됨
      } else if (t.type === 'income') {
        currentIncome += t.amount;
      }
    });
    
    // 고정비(Fixed Costs)는 메인 합계에서 제외 (사용자 요청)
    const currentNet = currentIncome - currentExpense;

    console.log('Dashboard Stats Summary (Excluding Fixed Costs):', {
      count: filteredTransactions.length,
      currentExpense,
      currentIncome,
      currentNet,
      uniqueTypes: Array.from(new Set(filteredTransactions.map(t => t.type))),
      sample: filteredTransactions.slice(0, 2)
    });

    // 조회 기간 표시
    const latestMonthStr = monthsSet.size === 1 
      ? format(parseISO(filteredTransactions[0].date), 'M월', { locale: ko })
      : '조회 기간';

    const result = {
      latestMonthStr,
      currentExpense, 
      lastExpense: 0, 
      expenseDiffRate: 0,
      currentIncome, 
      lastIncome: 0, 
      incomeDiffRate: 0,
      currentNet
    };
    
    return result;
  }, [filteredTransactions]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('isAuthenticated');
    window.location.href = '/auth';
  };

  const handleExcelUpload = async (newTxs: Transaction[], fileName: string) => {
    if (!session) return;
    
    try {
      // Supabase 테이블 구조에 맞게 매핑
      const dbTxs = newTxs.map(t => ({
        user_id: session.user.id,
        date: t.date,
        category: t.category,
        content: t.description,
        amount: t.amount, // 부호 그대로 전달
        payment_method: t.cardType,
        file_name: fileName
      }));

      const { error } = await supabase.from('transactions').insert(dbTxs);
      if (error) throw error;
      
      // 재로드
      fetchTransactions(session.user.id);
    } catch (e) {
      console.error("Upload to Supabase failed", e);
      alert("데이터를 저장하지 못했습니다.");
    }
  };

  const handleDeleteAll = async () => {
    if (!session) return;
    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('user_id', session.user.id);
      
      if (error) throw error;
      
      setTransactions([]);
      setUploadedFiles([]);
      setShowDeleteModal(false);
    } catch (e) {
      console.error("Delete all failed", e);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedTransactionIds.length === 0 || !session) return;
    if (!confirm(`선택한 ${selectedTransactionIds.length}개의 내역을 삭제하시겠습니까?`)) return;

    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .in('id', selectedTransactionIds);

      if (error) throw error;

      setTransactions(prev => prev.filter(t => !selectedTransactionIds.includes(t.id)));
      setSelectedTransactionIds([]);
      if (transactions.filter(t => !selectedTransactionIds.includes(t.id) && t.category === selectedCategory).length === 0) {
        setSelectedCategory(null);
      }
    } catch (e) {
      console.error("Delete selected failed", e);
    }
  };

  const handleDownloadReport = async () => {
    if (!dashboardRef.current) return;
    try {
      const canvas = await html2canvas(dashboardRef.current, {
        backgroundColor: '#0f172a',
        scale: 2,
      });
      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      link.download = `가계부_리포트_${format(new Date(), 'yyyyMMdd')}.png`;
      link.click();
    } catch (error) {
      console.error('Failed to download report', error);
    }
  };

  if (isLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh', color: 'white' }}>데이터 로딩 중...</div>;
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1rem' }}>
      
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
        <div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.25rem' }}>환영합니다,</p>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '700' }}>{session?.user?.email?.split('@')[0]} 님</h1>
        </div>
        <button className="btn btn-ghost" onClick={handleLogout} style={{ padding: '8px 16px' }}>
          <LogOut size={18} />
          <span>로그아웃</span>
        </button>
      </header>

      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <section>
            <CsvUploadWidget 
              onUploadSuccess={handleExcelUpload} 
              existingCount={transactions.length}
              uploadedFiles={uploadedFiles}
            />
          </section>

          <TransactionFilter 
            transactions={transactions} 
            onFilterChange={setFilteredTransactions}
            externalDateRange={externalDateRange}
          />

          <div ref={dashboardRef}>
            <section className="notranslate" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
              <div className="glass" style={{ padding: '2rem', position: 'relative', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
                  <div style={{ padding: '10px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '12px', color: 'var(--primary)' }}>
                    <Wallet size={24} />
                  </div>
                  <h3 style={{ color: 'var(--text-muted)', fontSize: '1rem', fontWeight: '500' }}>{stats.latestMonthStr} 순수익</h3>
                </div>
                <p style={{ fontSize: '2.5rem', fontWeight: '700' }}>₩ {stats.currentNet.toLocaleString()}</p>
              </div>

              <div className="glass" style={{ padding: '2rem', position: 'relative', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
                  <div style={{ padding: '10px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '12px', color: 'var(--danger)' }}>
                    <ShoppingCart size={24} />
                  </div>
                  <h3 style={{ color: 'var(--text-muted)', fontSize: '1rem', fontWeight: '500' }}>{stats.latestMonthStr} 지출</h3>
                </div>
                <p style={{ fontSize: '2rem', fontWeight: '600', color: 'var(--danger)' }}>₩ {stats.currentExpense.toLocaleString()}</p>
              </div>

              <div className="glass" style={{ padding: '2rem', position: 'relative', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
                  <div style={{ padding: '10px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '12px', color: 'var(--success)' }}>
                    <ArrowDownRight size={24} />
                  </div>
                  <h3 style={{ color: 'var(--text-muted)', fontSize: '1rem', fontWeight: '500' }}>{stats.latestMonthStr} 수입</h3>
                </div>
                <p style={{ fontSize: '2rem', fontWeight: '600', color: 'var(--success)' }}>₩ {stats.currentIncome.toLocaleString()}</p>
              </div>
            </section>

            <section style={{ marginBottom: '2rem' }}>
              <AnalyticsCharts 
                transactions={filteredTransactions} 
                onCategoryClick={setSelectedCategory} 
                selectedCategory={selectedCategory}
                onBarClick={handleBarClick}
              />
            </section>

            <section style={{ marginBottom: '2rem' }}>
              <CalendarWidget 
                transactions={filteredTransactions} 
                onDayClick={(dateStr) => setSelectedDateStr(dateStr)} 
              />
            </section>

            <section style={{ marginBottom: '2rem' }}>
              <BudgetManager transactions={filteredTransactions} />
            </section>
          </div>

          <section style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginBottom: '2rem' }}>
            <button className="btn btn-ghost" onClick={handleDownloadReport}><ArrowDownRight size={18} /> 리포트 캡처</button>
            <button className="btn btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => setShowDeleteModal(true)} disabled={transactions.length === 0}><Trash2 size={18} /> 전체 삭제</button>
            <button className="btn btn-primary" onClick={() => alert('기능 준비 중입니다.')}><Plus size={18} /> 임시 내역 추가</button>
          </section>
        </div>

        {selectedCategory && (
          <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '520px', zIndex: 1000, borderLeft: '1px solid var(--glass-border)', boxShadow: '-8px 0 32px rgba(0,0,0,0.5)' }} className="glass">
            <div style={{ padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', height: '100vh' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '600' }}>'{selectedCategory}' 내역</h2>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {selectedTransactionIds.length > 0 && (
                    <button className="btn btn-ghost" style={{ color: 'var(--danger)' }} onClick={handleDeleteSelected}>
                      <Trash2 size={16} /> 삭제 ({selectedTransactionIds.length})
                    </button>
                  )}
                  <button className="btn btn-ghost" onClick={() => { setSelectedCategory(null); setSelectedTransactionIds([]); }}>닫기</button>
                </div>
              </div>
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {filteredTransactions.filter(t => t.category === selectedCategory).map(tx => (
                  <div key={tx.id} style={{ padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--glass-border)', background: selectedTransactionIds.includes(tx.id) ? 'rgba(99, 102, 241, 0.1)' : 'transparent' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <input type="checkbox" checked={selectedTransactionIds.includes(tx.id)} onChange={() => setSelectedTransactionIds(prev => prev.includes(tx.id) ? prev.filter(x => x !== tx.id) : [...prev, tx.id])} />
                      <div>
                        <p style={{ fontWeight: '600' }}>{tx.description}</p>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{tx.cardType} • {new Date(tx.date).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <p style={{ fontWeight: '600', color: tx.type === 'expense' ? 'var(--danger)' : 'var(--success)' }}>₩ {tx.amount.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {showDeleteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="glass" style={{ width: '400px', padding: '2rem', textAlign: 'center' }}>
            <Trash2 size={48} style={{ color: 'var(--danger)', margin: '0 auto 1.5rem' }} />
            <h2 style={{ marginBottom: '1rem' }}>모든 내역 삭제</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>모든 데이터를 삭제하시겠습니까? 되돌릴 수 없습니다.</p>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowDeleteModal(false)}>취소</button>
              <button className="btn btn-primary" style={{ flex: 1, background: 'var(--danger)' }} onClick={handleDeleteAll}>삭제하기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
