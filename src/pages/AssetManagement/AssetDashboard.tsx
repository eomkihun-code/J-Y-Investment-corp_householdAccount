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

  const [cashAccounts, setCashAccounts] = useState<Account[]>(mockAccounts.filter(a => a.type === 'Bank'));
  const [stockAccounts, setStockAccounts] = useState<Account[]>(mockAccounts.filter(a => a.type === 'Stock'));
  
  const [manualAccounts, setManualAccounts] = useState<Account[]>(() => {
    const saved = localStorage.getItem('manualAccounts');
    if (saved) return JSON.parse(saved);
    return mockAccounts.filter(a => a.type === 'RealEstate' || a.type === 'Crypto');
  });

  const [incomeFlows, setIncomeFlows] = useState<CashFlow[]>(mockCashFlows);
  const [exchangeRate, setExchangeRate] = useState<number>(1350);
  const [targetMonth, setTargetMonth] = useState<string>('2026-03');
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
        const { data: assetData, error: _err } = await supabase
          .from('user_asset_data')
          .select('*')
          .eq('user_id', currentSession.user.id)
          .single();
          
        if (assetData) {
          let loadedCash = assetData.cash_accounts?.length > 0 ? assetData.cash_accounts : cashAccounts;
          let loadedStock = assetData.stock_accounts?.length > 0 ? assetData.stock_accounts : stockAccounts;
          let loadedIncome = assetData.income_flows?.length > 0 ? assetData.income_flows : incomeFlows;
          let loadedManual = assetData.manual_accounts?.length > 0 ? assetData.manual_accounts : manualAccounts;

          setCashAccounts(loadedCash);
          setIncomeFlows(loadedIncome);
          setManualAccounts(loadedManual);

          // 저장된 현금 데이터에서 최신 월 복원
          const allDates = loadedCash.flatMap((acc: Account) => Object.keys(acc.history || {})).sort();
          if (allDates.length > 0) {
            setTargetMonth(allDates[allDates.length - 1].substring(0, 7));
          }

          const updatedStockAccounts = await refreshStockValuation(loadedStock);
          setStockAccounts(updatedStockAccounts);
        }
      }
      setIsLoadingInitial(false);
    };
    initData();
  }, []);

  const saveToSupabase = async (cash: Account[], stock: Account[], income: CashFlow[], manual: Account[]) => {
    if (!session?.user?.id) return;
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
    // 업로드된 데이터에서 최신 월로 targetMonth 자동 업데이트
    const allDates = data.flatMap(acc => Object.keys(acc.history || {})).sort();
    if (allDates.length > 0) {
      const latest = allDates[allDates.length - 1];
      setTargetMonth(latest.substring(0, 7)); // YYYY-MM
    }
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
      <AccountDetails accounts={allAccounts} exchangeRate={exchangeRate} />

    </div>
    </div>
  );
}

export default App;
