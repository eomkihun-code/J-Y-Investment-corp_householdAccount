import { useState, useEffect } from 'react';
import '../styles/AccountDetails.css';
import type { Account, Owner } from '../types';
import { getValuedHoldings, formatCurrency, setUIErrorCallback } from '../utils/stockPriceService';

interface Props {
  accounts: Account[];
  exchangeRate: number;
}

type TabType = 'All' | 'Husband' | 'Wife';

const StockModal = ({ account, onClose }: { account: Account, onClose: () => void }) => {
  const [valuedHoldings, setValuedHoldings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    if (!account || !account.holdings) return;
    
    let isMounted = true;
    setLoading(true);
    setLogs([]); // Clear logs

    // Set callback to collect logs
    setUIErrorCallback((msg: string) => {
      if (isMounted) setLogs(prev => [...prev.slice(-4), msg]); // Keep last 5 logs
    });
    
    getValuedHoldings(account.holdings).then(res => {
      if (isMounted) {
        setValuedHoldings(res);
        setLoading(false);
        setLastUpdated(new Date());
      }
    });

    return () => {
      isMounted = false;
      setUIErrorCallback(null);
    };
  }, [account.id, account.name]);

  return (
    <div className="stock-modal-overlay" onClick={onClose}>
      <div className="stock-modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>{account.name} 보유 종목 상세</h3>
            {lastUpdated && (
              <span className="last-updated" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                시세 업데이트: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>
          <div className="modal-actions" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button 
              className="refresh-btn" 
              onClick={(e) => {
                e.stopPropagation();
                setLoading(true);
                getValuedHoldings(account.holdings!).then(res => {
                  setValuedHoldings(res);
                  setLoading(false);
                  setLastUpdated(new Date());
                });
              }}
              style={{
                background: 'var(--accent-primary)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                padding: '4px 12px',
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              🔄 새로고침
            </button>
            <button className="close-btn" onClick={onClose}>&times;</button>
          </div>
        </div>
        <div className="modal-body">
          {loading ? (
            <div className="loading-state" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <div className="spinner" style={{ marginBottom: '16px', fontSize: '24px' }}>⏳</div>
              네이버/야후 증권 시세 정보를 가져오는 중...
              {logs.length > 0 && (
                <div className="status-logs" style={{ marginTop: '20px', fontSize: '11px', textAlign: 'left', background: '#f8f9fa', padding: '10px', borderRadius: '4px', border: '1px solid #ddd' }}>
                  {logs.map((log, i) => <div key={i} style={{ color: log.includes('Error') || log.includes('failed') ? '#d32f2f' : '#666' }}>{log}</div>)}
                </div>
              )}
            </div>
          ) : (
            <div className="table-responsive">
              <table className="stock-table">
                <thead>
                  <tr>
                    <th>종목</th>
                    <th>코드</th>
                    <th>수량</th>
                    <th>평단가</th>
                    <th>현재가</th>
                    <th>평가손익</th>
                    <th>수익률</th>
                    <th>평가금액</th>
                  </tr>
                </thead>
                <tbody>
                  {valuedHoldings.filter(h => h.quantity > 0).map((h, i) => (
                    <tr key={i}>
                      <td>{h.symbol}</td>
                      <td style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                        {h.code || '-'}
                      </td>
                      <td>{h.quantity}</td>
                      <td>{formatCurrency(h.avgPrice, h.currency)}</td>
                      <td>{formatCurrency(h.realtimePrice, h.currency)}</td>
                      <td className={h.gainLoss >= 0 ? 'text-up' : 'text-down'}>
                        {formatCurrency(h.gainLoss, h.currency)}
                      </td>
                      <td className={h.returnRate >= 0 ? 'text-up' : 'text-down'}>
                        {h.returnRate.toFixed(2)}%
                      </td>
                      <td className="text-bold">{formatCurrency(h.valuation, h.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// 계좌명에서 금융기관명 추출
const getInstitutionKey = (name: string): string => {
  const cleaned = name.replace(/^(국내|미국|해외)\s*/i, '').trim();
  const institutions: [string, string][] = [
    ['KB증권', 'KB증권'], ['키움증권', '키움증권'], ['미래에셋', '미래에셋'], ['삼성증권', '삼성증권'],
    ['한국투자', '한국투자'], ['NH투자', 'NH투자'], ['대신증권', '대신증권'], ['교보증권', '교보증권'],
    ['신한투자', '신한투자'], ['하나증권', '하나증권'],
    ['국민은행', 'KB국민은행'], ['KB은행', 'KB국민은행'], ['신한은행', '신한은행'], ['하나은행', '하나은행'],
    ['우리은행', '우리은행'], ['농협', '농협'], ['기업은행', '기업은행'], ['새마을금고', '새마을금고'],
    ['우체국', '우체국'], ['카카오뱅크', '카카오뱅크'], ['토스뱅크', '토스뱅크'],
    ['업비트', '업비트'], ['빗썸', '빗썸'], ['코인원', '코인원'],
    ['키움', '키움'], ['KB', 'KB'], ['하나', '하나'], ['신한', '신한'],
  ];
  for (const [keyword, label] of institutions) {
    if (cleaned.includes(keyword)) return label;
  }
  return cleaned.split(/[\s_]/)[0] || name;
};

export default function AccountDetails({ accounts, exchangeRate }: Props) {
  const [activeTab, setActiveTab] = useState<TabType>('All');
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);

  const filteredAccounts = accounts.filter(acc => {
    if (activeTab === 'All') return true;
    if (activeTab === 'Husband') return acc.owner === 'Husband';
    if (activeTab === 'Wife') return acc.owner === 'Wife';
    return false;
  });

  const stocks = filteredAccounts.filter(a => a.type === 'Stock');
  const banks = filteredAccounts.filter(a => a.type === 'Bank');
  const cryptos = filteredAccounts.filter(a => a.type === 'Crypto');

  const formatAccountBalance = (amount: number, currency: string) => {
    if (currency === 'USD') {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    }
    return new Intl.NumberFormat('ko-KR').format(amount) + '원';
  };

  const getOwnerClass = (owner: Owner) => {
    switch (owner) {
      case 'Husband': return 'owner-husband';
      case 'Wife': return 'owner-wife';
      case 'Joint': return 'owner-joint';
      default: return '';
    }
  };

  const renderAccountItem = (acc: Account) => (
    <div
      className={`account-item ${getOwnerClass(acc.owner)} ${acc.type === 'Stock' ? 'clickable' : ''}`}
      key={acc.id}
      onClick={() => acc.type === 'Stock' && setSelectedAccount(acc)}
    >
      <div className="account-info">
        <span className="account-category">{acc.category}</span>
        <span className="account-name">{acc.name} {acc.type === 'Stock' && <span className="detail-hint">🔍</span>}</span>
      </div>
      <div className="account-balance">
        {formatAccountBalance(acc.balance, acc.currency)}
        {acc.currency === 'USD' && (
          <div className="krw-eq" style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            ({new Intl.NumberFormat('ko-KR').format(Math.round(acc.balance * exchangeRate))}원)
          </div>
        )}
      </div>
    </div>
  );

  const renderAccountGroup = (title: string, data: Account[], icon: string) => {
    if (data.length === 0) return null;

    const totalKRW = data.reduce((sum, curr) => {
      return sum + (curr.currency === 'USD' ? curr.balance * exchangeRate : curr.balance);
    }, 0);
    const totalUSD = data.filter(a => a.currency === 'USD').reduce((sum, a) => sum + a.balance, 0);

    // 기관별 그룹핑
    const institutionMap = new Map<string, Account[]>();
    data.forEach(acc => {
      const key = getInstitutionKey(acc.name);
      if (!institutionMap.has(key)) institutionMap.set(key, []);
      institutionMap.get(key)!.push(acc);
    });

    return (
      <div className="account-group">
        <div className="group-header">
          <h4 className="group-title text-secondary">
            <span className="group-icon">{icon}</span> {title}
          </h4>
          <span className="group-total-label">
            합계: <span className="total-amount">{new Intl.NumberFormat('ko-KR').format(Math.round(totalKRW))}원</span>
            {totalUSD > 0 && (
              <span style={{ marginLeft: '10px', color: 'var(--color-secondary, #2db7f2)', fontWeight: 600 }}>
                ({new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalUSD)})
              </span>
            )}
          </span>
        </div>

        <div className="institution-groups">
          {Array.from(institutionMap.entries()).map(([instName, instAccounts]) => {
            const instTotal = instAccounts.reduce((sum, acc) =>
              sum + (acc.currency === 'USD' ? acc.balance * exchangeRate : acc.balance), 0);
            return (
              <div key={instName} className="institution-group">
                <div className="institution-header">
                  <span className="institution-name">{instName}</span>
                  <span className="institution-total">
                    {new Intl.NumberFormat('ko-KR').format(Math.round(instTotal))}원
                  </span>
                </div>
                <div className="account-list">
                  {instAccounts.map(renderAccountItem)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="card account-details">
      <span className="dev-label">&lt;AccountDetails /&gt;</span>
      <div className="flex-between account-header">
        <h3 className="text-secondary portfolio-title" style={{ marginBottom: 0 }}>계좌별 상세 현황</h3>
        <div className="tabs">
          <button
            className={`tab-btn ${activeTab === 'All' ? 'active' : ''}`}
            onClick={() => setActiveTab('All')}
          >전체</button>
          <button
            className={`tab-btn owner-husband ${activeTab === 'Husband' ? 'active' : ''}`}
            onClick={() => setActiveTab('Husband')}
          >엄기훈</button>
          <button
            className={`tab-btn owner-wife ${activeTab === 'Wife' ? 'active' : ''}`}
            onClick={() => setActiveTab('Wife')}
          >최수진</button>
        </div>
      </div>

      <div className="account-sections">
        {renderAccountGroup('주식 계좌 (Stock)', stocks, '📈')}
        {renderAccountGroup('은행 계좌 (Bank)', banks, '🏦')}
        {renderAccountGroup('가상자산 (Crypto)', cryptos, '🪙')}
      </div>

      {selectedAccount && (
        <StockModal
          account={selectedAccount}
          onClose={() => setSelectedAccount(null)}
        />
      )}
    </div>
  );
}
