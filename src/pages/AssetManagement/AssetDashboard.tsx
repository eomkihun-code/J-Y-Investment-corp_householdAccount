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

  useEffect(() => {
    const initData = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession);
      
      if (currentSession?.user) {
        // Fetch from Supabase
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

          // Update Stock account balances with real-time valuations
          const updatedStockAccounts = await Promise.all(loadedStock.map(async (acc: Account) => {
            if (acc.type === 'Stock' && acc.holdings) {
              const valued = await getValuedHoldings(acc.holdings);
              const totalValuation = valued.reduce((sum: number, h: any) => sum + h.valuation, 0);
              return { ...acc, balance: totalValuation };
            }
            return acc;
          }));
          setStockAccounts(updatedStockAccounts);
        }
      }
      setIsLoadingInitial(false);
    };
    initData();
  }, []);

  const saveToSupabase = async (cash: Account[], stock: Account[], income: CashFlow[], manual: Account[]) => {
    if (!session?.user?.id) return;
    try {
      const { error } = await supabase.from('user_asset_data').upsert({
        user_id: session.user.id,
        cash_accounts: cash,
        stock_accounts: stock,
        income_flows: income,
        manual_accounts: manual,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });
      if (error) console.error("Error saving asset data", error);
    } catch(e) {
      console.error(e);
    }
  };

  const handleCashUploaded = (data: Account[]) => { setCashAccounts(data); saveToSupabase(data, stockAccounts, incomeFlows, manualAccounts); };
  const handleStocksUploaded = (data: Account[]) => { setStockAccounts(data); saveToSupabase(cashAccounts, data, incomeFlows, manualAccounts); };
  const handleIncomeUploaded = (data: CashFlow[]) => { setIncomeFlows(data); saveToSupabase(cashAccounts, stockAccounts, data, manualAccounts); };
  
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
