import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { getValuedHoldings } from './utils/stockPriceService';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import './index.css';
import './styles/Dashboard.css';
import TopSection from './components/TopSection';
import MonthlyCashFlow from './components/MonthlyCashFlow';
import PortfolioAllocation from './components/PortfolioAllocation';
import AccountDetails from './components/AccountDetails';
import UploadControls from './components/UploadControls';
import ManualAssetEditor from './components/ManualAssetEditor';
import { mockAccounts, mockCashFlows } from './data/mockData';
import { getExchangeRate } from './utils/exchangeService';
import type { Account, CashFlow } from './types';

function App() {
  const [session, setSession] = useState<any>(null);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  // DB에서 기존 데이터를 제대로 읽어오기 전까지는 저장을 막는다.
  // (읽기 실패 시 화면에 남아있는 샘플 데이터가 실제 데이터를 덮어쓰는 사고 방지)
  const [isSaveLocked, setIsSaveLocked] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [cashAccounts, setCashAccounts] = useState<Account[]>(mockAccounts.filter(a => a.type === 'Bank'));
  const [stockAccounts, setStockAccounts] = useState<Account[]>(mockAccounts.filter(a => a.type === 'Stock'));
  
  const [manualAccounts, setManualAccounts] = useState<Account[]>(() => {
    const saved = localStorage.getItem('manualAccounts');
    if (saved) return JSON.parse(saved);
    return mockAccounts.filter(a => a.type === 'RealEstate' || a.type === 'Crypto');
  });

  const [incomeFlows, setIncomeFlows] = useState<CashFlow[]>(mockCashFlows);
  const [exchangeRate, setExchangeRate] = useState<number>(1350);
  // 인컴 섹션이 보는 월. 계좌(현금) 데이터와 무관하게 '이번 달'에서 시작한다.
  const [targetMonth, setTargetMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [isManualEditorOpen, setIsManualEditorOpen] = useState(false);

  useEffect(() => {
    const fetchRate = async () => {
      const rate = await getExchangeRate();
      setExchangeRate(rate);
    };
    fetchRate();
  }, []);

  const refreshStockValuation = async (stockData: Account[]) => {
    return await Promise.all(stockData.map(async (acc: Account) => {
      if (acc.type === 'Stock' && acc.holdings) {
        const valued = await getValuedHoldings(acc.holdings);
        const totalValuation = valued.reduce((sum: number, h: any) => sum + h.valuation, 0);
        return { ...acc, balance: totalValuation };
      }
      return acc;
    }));
  };

  useEffect(() => {
    const initData = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession);
      
      if (currentSession?.user) {
        const { data: assetData, error: loadErr } = await supabase
          .from('user_asset_data')
          .select('*')
          .eq('user_id', currentSession.user.id)
          .maybeSingle();

        if (loadErr) {
          // 네트워크 오류·DB 일시정지 등 '읽기 실패'.
          // 저장된 데이터가 있는지 없는지 알 수 없으므로 저장을 잠근다.
          console.error('Error loading asset data', loadErr);
          setLoadError(loadErr.message || '알 수 없는 오류');
          setIsSaveLocked(true);
          setIsLoadingInitial(false);
          return;
        }

        if (assetData) {
          // 저장된 값이 빈 배열이면 '데이터 없음'이 맞으므로 샘플로 대체하지 않는다.
          const loadedCash: Account[] = assetData.cash_accounts ?? [];
          const loadedStock: Account[] = assetData.stock_accounts ?? [];
          const loadedIncome: CashFlow[] = assetData.income_flows ?? [];
          const loadedManual: Account[] = assetData.manual_accounts ?? [];

          setCashAccounts(loadedCash);
          setIncomeFlows(loadedIncome);
          setManualAccounts(loadedManual);

          const updatedStockAccounts = await refreshStockValuation(loadedStock);
          setStockAccounts(updatedStockAccounts);
        }
        // assetData가 null이면 아직 저장한 적 없는 신규 사용자 → 샘플 데이터로 시작, 저장 허용
        setIsSaveLocked(false);
      }
      setIsLoadingInitial(false);
    };
    initData();
  }, []);

  const saveToSupabase = async (cash: Account[], stock: Account[], income: CashFlow[], manual: Account[]) => {
    if (!session?.user?.id) return;
    if (isSaveLocked) {
      // 기존 데이터를 못 읽은 상태에서 저장하면 실제 데이터가 날아간다.
      setSaveStatus('저장 실패 (데이터 불러오기 전)');
      alert('기존 데이터를 불러오지 못해 저장을 중단했습니다.\n페이지를 새로고침해 데이터가 정상적으로 보이는지 확인한 뒤 다시 시도해 주세요.');
      return;
    }
    setIsSaving(true);
    setSaveStatus('저장 중...');
    try {
      const { error } = await supabase.from('user_asset_data').upsert({
        user_id: session.user.id,
        cash_accounts: cash,
        stock_accounts: stock,
        income_flows: income,
        manual_accounts: manual,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

      if (error) {
        console.error("Error saving asset data", error);
        setSaveStatus('저장 실패 (DB 오류)');
        alert(`데이터 저장 실패: ${error.message}\nSupabase 테이블 설정(RLS/Primary Key)을 확인해 주세요.`);
      } else {
        setSaveStatus('저장 완료');
        setTimeout(() => setSaveStatus(null), 3000);
      }
    } catch(e: any) {
      console.error(e);
      setSaveStatus('저장 실패');
      alert(`시스템 오류: ${e.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCashUploaded = (data: Account[]) => {
    setCashAccounts(data);
    // 인컴 섹션의 조회 월(targetMonth)은 현금 데이터와 분리되어 있으므로 건드리지 않는다.
    saveToSupabase(data, stockAccounts, incomeFlows, manualAccounts);
  };

  const handleStocksUploaded = async (data: Account[]) => { 
    // Show current state immediately
    setStockAccounts(data); 
    // Re-value stocks for real-time display
    const valuedData = await refreshStockValuation(data);
    setStockAccounts(valuedData);
    saveToSupabase(cashAccounts, valuedData, incomeFlows, manualAccounts); 
  };

  const handleIncomeUploaded = (data: CashFlow[]) => { 
    setIncomeFlows(data); 
    saveToSupabase(cashAccounts, stockAccounts, data, manualAccounts); 
  };
  
  const handleClearCash = () => { setCashAccounts([]); saveToSupabase([], stockAccounts, incomeFlows, manualAccounts); };
  const handleClearStocks = () => { setStockAccounts([]); saveToSupabase(cashAccounts, [], incomeFlows, manualAccounts); };
  const handleClearIncome = () => { setIncomeFlows([]); saveToSupabase(cashAccounts, stockAccounts, [], manualAccounts); };

  const handleUpdateManualAccounts = (updated: Account[]) => {
    setManualAccounts(updated);
    localStorage.setItem('manualAccounts', JSON.stringify(updated));
    saveToSupabase(cashAccounts, stockAccounts, incomeFlows, updated);
  };

  // Combine customized accounts + manual accounts
  const allAccounts = [...cashAccounts, ...stockAccounts, ...manualAccounts];
  
  if (isLoadingInitial) {
    return (
      <div className="asset-dashboard-scope" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>데이터 바인딩 중...</p>
      </div>
    );
  }

  return (
    <div className="asset-dashboard-scope">
      <div className="dashboard-container notranslate">
      {loadError && (
        <div style={{ padding: '12px 16px', marginBottom: '16px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.4)', color: 'var(--negative-color, #ef4444)', fontSize: '14px', lineHeight: 1.5 }}>
          ⚠️ 저장된 데이터를 불러오지 못했습니다 ({loadError}).<br />
          화면에 보이는 값은 실제 데이터가 아닐 수 있어 <strong>저장이 잠겨 있습니다.</strong> 잠시 후 새로고침해 주세요.
        </div>
      )}

      <header className="dashboard-header">
        <div>
          <h1>J&Y Family Invest</h1>
          <p>종합 자산관리 대시보드</p>
          {saveStatus && (
            <div className={`save-indicator ${saveStatus.includes('실패') ? 'fail' : 'success'}`} style={{ fontSize: '12px', marginTop: '4px', color: saveStatus.includes('실패') ? 'var(--negative-color)' : 'var(--positive-color)' }}>
              {isSaving ? '⏳ ' : '✅ '}{saveStatus}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <Link to="/dashboard" style={{ textDecoration: 'none', color: 'var(--text-primary)', padding: '8px 16px', borderRadius: '8px', background: 'var(--surface-color)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s' }}>
            <ArrowLeft size={16} /> 기존 가계부로 돌아가기
          </Link>
          <div className="user-profile">
            <span style={{ fontSize: '24px' }}>👨‍👩‍👧‍👦</span>
          </div>
        </div>
      </header>

      {/* Upload Controls for Excel */}
      <UploadControls 
        onCashUploaded={handleCashUploaded}
        onStocksUploaded={handleStocksUploaded}
        onIncomeUploaded={handleIncomeUploaded}
        onClearCash={handleClearCash}
        onClearStocks={handleClearStocks}
        onClearIncome={handleClearIncome}
        onOpenManualEditor={() => setIsManualEditorOpen(true)}
      />

      {isManualEditorOpen && (
        <ManualAssetEditor 
          accounts={manualAccounts}
          onUpdate={handleUpdateManualAccounts}
          onClose={() => setIsManualEditorOpen(false)}
        />
      )}

      {/* 1. Top Section */}
      <TopSection accounts={allAccounts} exchangeRate={exchangeRate} />

      {/* Grid wrapper for Middle Sections */}
      <div className="middle-section">
        {/* 2. Middle-Left Section */}
        <MonthlyCashFlow
          cashFlows={incomeFlows}
          exchangeRate={exchangeRate}
          targetMonth={targetMonth}
          onMonthChange={setTargetMonth}
          onCashFlowsChange={handleIncomeUploaded}
        />
        
        {/* 3. Middle-Right Section */}
        <PortfolioAllocation accounts={allAccounts} exchangeRate={exchangeRate} />
      </div>

      {/* 4. Bottom Section */}
      <AccountDetails
        accounts={allAccounts}
        exchangeRate={exchangeRate}
        onStockAccountsChange={(updatedStocks) => {
          setStockAccounts(updatedStocks);
          saveToSupabase(cashAccounts, updatedStocks, incomeFlows, manualAccounts);
        }}
      />

    </div>
    </div>
  );
}

export default App;
