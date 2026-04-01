import { useState, useMemo, useEffect } from 'react';
import { Landmark, ChevronDown, ChevronUp, CreditCard, Table, Plus, Trash2, X, FileSpreadsheet, Pencil, Check } from 'lucide-react';
import type { Transaction } from '../types/transaction';
import { supabase } from '../lib/supabaseClient';
import * as XLSX from 'xlsx';

interface BudgetManagerProps {
  transactions: Transaction[];
}

interface FixedCost {
  id: string;
  category: string;
  item: string;
  amount: number;
  note: string;
  autoTransfer: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  '교육비': '#60a5fa',
  '아파트 관리비': '#f59e0b',
  '보험료': '#f472b6',
  '통신비': '#34d399',
  '렌탈/멤버십': '#a78bfa',
  '대출이자': '#fb923c',
};

const PAYMENT_METHODS = [
  '현대 M카드',
  '우리카드',
  '코웨이 M카드',
  '경기화폐',
  '우리은행',
  'NH은행',
  '새마을',
  '현금',
  '기타'
];

export default function BudgetManager({ transactions: _transactions }: BudgetManagerProps) {
  void _transactions;

  const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([]);
  const [session, setSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCost, setNewCost] = useState<Partial<FixedCost>>({
    category: '교육비',
    item: '',
    amount: 0,
    note: '',
    autoTransfer: '현대 M카드'
  });

  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [showPaymentSummary, setShowPaymentSummary] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCost, setEditCost] = useState<Partial<FixedCost>>({});

  // 세션 및 데이터 로드
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchFixedCosts(session.user.id);
      } else {
        setIsLoading(false);
      }
    });
  }, []);

  const fetchFixedCosts = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('fixed_costs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      if (data) {
        const mapped = data.map(d => ({
          id: d.id,
          category: d.category,
          item: d.item,
          amount: Number(d.amount),
          note: d.note || '',
          autoTransfer: d.auto_transfer || '기타'
        }));
        setFixedCosts(mapped);
      }
    } catch (e) {
      console.error("Failed to fetch fixed costs", e);
    } finally {
      setIsLoading(false);
    }
  };

  const grouped = useMemo(() => {
    const map = new Map<string, FixedCost[]>();
    fixedCosts.forEach(item => {
      if (!map.has(item.category)) map.set(item.category, []);
      map.get(item.category)!.push(item);
    });
    return Array.from(map.entries());
  }, [fixedCosts]);

  useEffect(() => {
    if (collapsedCategories.size === 0 && grouped.length > 0) {
      setCollapsedCategories(new Set(grouped.map(([cat]) => cat)));
    }
  }, [grouped]);

  const toggleCategory = (cat: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const paymentTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    fixedCosts.forEach(item => {
      const method = item.autoTransfer || '기타/미정';
      totals[method] = (totals[method] || 0) + item.amount;
    });
    return Object.entries(totals).sort((a, b) => b[1] - a[1]);
  }, [fixedCosts]);

  const totalMonthly = fixedCosts.reduce((s, c) => s + c.amount, 0);

  const handleAddCost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCost.item || !newCost.amount || !session) return;
    
    try {
      const { data, error } = await supabase
        .from('fixed_costs')
        .insert([{
          user_id: session.user.id,
          category: newCost.category || '기타',
          item: newCost.item,
          amount: newCost.amount,
          note: newCost.note || '',
          auto_transfer: newCost.autoTransfer || '기타'
        }])
        .select();

      if (error) throw error;

      if (data) {
        const added = data[0];
        setFixedCosts(prev => [...prev, {
          id: added.id,
          category: added.category,
          item: added.item,
          amount: Number(added.amount),
          note: added.note || '',
          autoTransfer: added.auto_transfer || '기타'
        }]);
      }
      
      setNewCost({ category: '교육비', item: '', amount: 0, note: '', autoTransfer: '현대 M카드' });
      setShowAddForm(false);
    } catch (e) {
      console.error("Add fixed cost failed", e);
    }
  };

  const handleDeleteCost = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!session) return;

    try {
      const { error } = await supabase
        .from('fixed_costs')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setFixedCosts(prev => prev.filter(c => c.id !== id));
    } catch (e) {
      console.error("Delete fixed cost failed", e);
    }
  };

  const handleEditStart = (item: FixedCost, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(item.id);
    setEditCost(item);
  };

  const handleEditCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
    setEditCost({});
  };

  const handleEditSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editingId || !editCost.item || !editCost.amount || !session) return;
    try {
      const { error } = await supabase
        .from('fixed_costs')
        .update({
          category: editCost.category || '기타',
          item: editCost.item,
          amount: editCost.amount,
          note: editCost.note || '',
          auto_transfer: editCost.autoTransfer || '기타'
        })
        .eq('id', editingId);
      
      if (error) throw error;
      setFixedCosts(prev => prev.map(c => c.id === editingId ? { ...c, ...editCost } as FixedCost : c));
      setEditingId(null);
      setEditCost({});
    } catch (e) {
      console.error('Update fixed cost failed', e);
    }
  };
  
  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !session) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const dataBuffer = evt.target?.result as ArrayBuffer;
        if (!dataBuffer) throw new Error("파일이 비어있습니다.");

        const wb = XLSX.read(dataBuffer, { type: 'array' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

        console.log("Parsed Excel rows:", data.length);
        if (data.length < 2) {
          alert("데이터가 없거나 형식이 올바르지 않습니다.");
          return;
        }

        const headers = (data[0] || []).map(h => String(h || '').trim());
        console.log("Excel Headers:", headers);

        const categoryIdx = headers.findIndex(h => h.includes('카테고리'));
        const itemIdx = headers.findIndex(h => h.includes('항목') || h.includes('내역') || h.includes('상세'));
        const amountIdx = headers.findIndex(h => h.includes('금액'));
        const noteIdx = headers.findIndex(h => h.includes('비고'));
        const autoTransferIdx = headers.findIndex(h => h.includes('자동') || h.includes('결제') || h.includes('이체'));

        if (itemIdx === -1 || amountIdx === -1) {
          alert(`필수 항목을 찾을 수 없습니다.\n찾은 헤더: ${headers.join(', ')}\n(항목/상세/내역 및 금액 필드가 필요합니다)`);
          return;
        }

        const newCosts = data.slice(1).map((row, idx) => {
          if (!row || row.length === 0) return null;
          
          const rawAmount = row[amountIdx];
          const amount = typeof rawAmount === 'number' ? rawAmount : Number(String(rawAmount || 0).replace(/[^0-9.-]/g, ''));
          const item = row[itemIdx] ? String(row[itemIdx]).trim() : '';
          
          if (!item || isNaN(amount)) {
            console.warn(`Row ${idx + 1} skipped: invalid item or amount`, { item, amount });
            return null;
          }

          return {
            user_id: session.user.id,
            category: categoryIdx !== -1 ? String(row[categoryIdx] || '기타').trim() : '기타',
            item: item,
            amount: amount,
            note: noteIdx !== -1 ? String(row[noteIdx] || '').trim() : '',
            auto_transfer: autoTransferIdx !== -1 ? String(row[autoTransferIdx] || '기타').trim() : '기타'
          };
        }).filter(Boolean);

        console.log("Maligned new costs:", newCosts);
        if (newCosts.length === 0) {
          alert("업로드할 수 있는 유효한 데이터가 없습니다.");
          return;
        }

        const { error } = await supabase
          .from('fixed_costs')
          .insert(newCosts);

        if (error) throw error;
        
        fetchFixedCosts(session.user.id);
        alert(`${newCosts.length}건의 고정비가 업로드되었습니다.`);
      } catch (err: any) {
        console.error("Excel upload failed:", err);
        alert(`파일 처리 중 오류가 발생했습니다: ${err.message || '알 수 없는 오류'}`);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const getMethodColor = (method: string) => {
    if (method.includes('현대')) return '#f472b6';
    if (method.includes('코웨이')) return '#60a5fa';
    if (method.includes('경기')) return '#34d399';
    if (method.includes('우리')) return '#3b82f6';
    if (method.includes('은행') || method.includes('새마을')) return '#fb923c';
    if (method.includes('현금')) return '#a3a3a3';
    return 'var(--text-muted)';
  };

  if (isLoading) return null;

  return (
    <div className="glass notranslate" style={{ padding: '2rem' }}>
      {/* Header */}
      <div className="budget-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ padding: '10px', background: 'rgba(251, 146, 60, 0.1)', borderRadius: '12px', color: '#fb923c' }}>
            <Landmark size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '600' }}>고정비용</h3>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>월 예상 지출 합계</p>
            <p style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--danger)' }}>
              ₩ {totalMonthly.toLocaleString()}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              className="btn btn-ghost"
              style={{ padding: '10px', borderRadius: '12px' }}
              onClick={() => setShowAddForm(!showAddForm)}
              title="항목 추가"
            >
              <Plus size={20} />
            </button>
            <button 
              className="btn btn-ghost"
              style={{ padding: '10px', borderRadius: '12px' }}
              onClick={() => document.getElementById('fixed-cost-excel-input')?.click()}
              title="엑셀 업로드"
            >
              <FileSpreadsheet size={20} />
            </button>
            <input 
              id="fixed-cost-excel-input"
              type="file" 
              accept=".xlsx,.xls,.csv" 
              style={{ display: 'none' }}
              onChange={handleExcelUpload}
            />
            <button 
              className={`btn ${showPaymentSummary ? 'btn-primary' : 'btn-ghost'}`}
              style={{ padding: '10px', borderRadius: '12px' }}
              onClick={() => setShowPaymentSummary(!showPaymentSummary)}
              title="결제 요약"
            >
              {showPaymentSummary ? <Table size={20} /> : <CreditCard size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <form onSubmit={handleAddCost} className="glass mobile-stack" style={{ marginBottom: '2rem', padding: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', border: '1px solid var(--primary)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>카테고리</label>
            <select 
              className="input-field"
              value={newCost.category}
              onChange={e => setNewCost({...newCost, category: e.target.value})}
            >
              {Object.keys(CATEGORY_COLORS).map(cat => <option key={cat} value={cat}>{cat}</option>)}
              <option value="기타">기타</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>항목명</label>
            <input 
              className="input-field"
              placeholder="항목명"
              value={newCost.item}
              onChange={e => setNewCost({...newCost, item: e.target.value})}
              required
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>금액</label>
            <input 
              type="number"
              className="input-field"
              placeholder="금액"
              value={newCost.amount || ''}
              onChange={e => setNewCost({...newCost, amount: parseInt(e.target.value) || 0})}
              required
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>비고</label>
            <input 
              className="input-field"
              placeholder="비고"
              value={newCost.note}
              onChange={e => setNewCost({...newCost, note: e.target.value})}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>결제수단</label>
            <select 
              className="input-field"
              value={newCost.autoTransfer}
              onChange={e => setNewCost({...newCost, autoTransfer: e.target.value})}
            >
              {PAYMENT_METHODS.map(method => <option key={method} value={method}>{method}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
            <button type="button" className="btn btn-ghost" style={{ flex: 1, height: '42px', border: '1px solid var(--glass-border)' }} onClick={() => setShowAddForm(false)}>취소</button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1, height: '42px' }}>추가</button>
          </div>
        </form>
      )}

      {/* Payment Summary */}
      {showPaymentSummary && (
        <div style={{ marginBottom: '2rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
          {paymentTotals.map(([method, amount]) => (
            <div 
              key={method} 
              onClick={() => setSelectedMethod(method)}
              style={{ 
                padding: '1rem', 
                background: 'rgba(255,255,255,0.03)', 
                borderRadius: '12px',
                borderLeft: `4px solid ${getMethodColor(method)}`,
                cursor: 'pointer',
                transition: 'transform 0.2s',
              }}
              onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{method}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <p style={{ fontWeight: '700', fontSize: '1.1rem' }}>₩ {amount.toLocaleString()}</p>
                <span style={{ fontSize: '0.7rem', color: 'var(--primary)', opacity: 0.8 }}>자세히 보기 →</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selectedMethod && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem' }} onClick={() => setSelectedMethod(null)}>
          <div className="glass" style={{ width: '100%', maxWidth: '500px', padding: '2rem', maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: getMethodColor(selectedMethod) }} />
                <h4 style={{ fontSize: '1.2rem', fontWeight: '600' }}>{selectedMethod} 상세 내역</h4>
              </div>
              <button className="btn btn-ghost" onClick={() => setSelectedMethod(null)}><X size={24} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {fixedCosts.filter(c => (c.autoTransfer || '기타/미정') === selectedMethod).map(item => (
                <div key={item.id} style={{ padding: '1.2rem', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontWeight: '600', fontSize: '1rem' }}>{item.item}</p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>{item.category} • {item.note || '비고 없음'}</p>
                  </div>
                  <p style={{ fontWeight: '700', fontSize: '1rem', color: getMethodColor(selectedMethod), whiteSpace: 'nowrap', marginLeft: '1rem' }}>
                    ₩ {item.amount.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
            <button className="btn btn-primary" style={{ width: '100%', marginTop: '2rem' }} onClick={() => setSelectedMethod(null)}>닫기</button>
          </div>
        </div>
      )}

      {/* Category Groups */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {grouped.map(([category, items]) => {
          const catTotal = items.reduce((s, i) => s + i.amount, 0);
          const isCollapsed = collapsedCategories.has(category);
          const catColor = CATEGORY_COLORS[category] || 'var(--primary)';

          return (
            <div key={category} style={{ border: '1px solid var(--glass-border)', borderRadius: '12px', overflow: 'hidden' }}>
              <button
                onClick={() => toggleCategory(category)}
                style={{
                  width: '100%', padding: '0.85rem 1.25rem',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: 'rgba(255,255,255,0.03)', border: 'none', cursor: 'pointer', color: 'inherit',
                  borderBottom: isCollapsed ? 'none' : '1px solid var(--glass-border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '4px', height: '24px', borderRadius: '2px', background: catColor }} />
                  <span style={{ fontWeight: '600' }}>{category}</span>
                  <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>{items.length}건</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontWeight: '600', color: catColor }}>₩ {catTotal.toLocaleString()}</span>
                  {isCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                </div>
              </button>

              {!isCollapsed && (
                <div>
                  {items.map((item, idx) => (
                    editingId === item.id ? (
                      <div
                        key={item.id}
                        className="budget-row"
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'minmax(120px, 1fr) minmax(100px, 1fr) auto auto',
                          gap: '1rem',
                          padding: '0.7rem 1.25rem',
                          alignItems: 'center',
                          borderBottom: idx < items.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                          fontSize: '0.9rem',
                          background: 'rgba(255,255,255,0.05)'
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <input className="input-field" style={{ padding: '4px 8px', fontSize: '0.9rem' }} value={editCost.item || ''} onChange={e => setEditCost({...editCost, item: e.target.value})} placeholder="항목명" />
                          <input className="input-field" style={{ padding: '4px 8px', fontSize: '0.8rem' }} value={editCost.note || ''} onChange={e => setEditCost({...editCost, note: e.target.value})} placeholder="비고" />
                        </div>
                        <div>
                          <input type="number" className="input-field" style={{ padding: '4px 8px', fontSize: '0.9rem', width: '100px' }} value={editCost.amount || ''} onChange={e => setEditCost({...editCost, amount: parseInt(e.target.value) || 0})} placeholder="금액" />
                        </div>
                        <div className="mobile-hide">
                          <select className="input-field" style={{ padding: '4px 8px', fontSize: '0.8rem' }} value={editCost.autoTransfer || '기타'} onChange={e => setEditCost({...editCost, autoTransfer: e.target.value})}>
                            {PAYMENT_METHODS.map(method => <option key={method} value={method}>{method}</option>)}
                          </select>
                        </div>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button className="btn btn-primary" style={{ padding: '4px' }} onClick={handleEditSave}><Check size={16} /></button>
                          <button className="btn btn-ghost" style={{ padding: '4px', opacity: 0.6 }} onClick={handleEditCancel}><X size={16} /></button>
                        </div>
                      </div>
                    ) : (
                      <div
                        key={item.id}
                        className="budget-row"
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr auto auto auto',
                          gap: '1rem',
                          padding: '0.7rem 1.25rem',
                          alignItems: 'center',
                          borderBottom: idx < items.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                          fontSize: '0.9rem'
                        }}
                      >
                        <div>
                          <p style={{ fontWeight: '500' }}>{item.item}</p>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.note}</p>
                        </div>
                        <div style={{ fontWeight: '600' }}>₩ {item.amount.toLocaleString()}</div>
                        <div className="mobile-hide" style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '6px', background: `${getMethodColor(item.autoTransfer)}22`, color: getMethodColor(item.autoTransfer), border: `1px solid ${getMethodColor(item.autoTransfer)}44` }}>
                          {item.autoTransfer || '—'}
                        </div>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button className="btn btn-ghost" style={{ padding: '4px', color: 'var(--primary)', opacity: 0.6 }} onClick={(e) => handleEditStart(item, e)}>
                            <Pencil size={16} />
                          </button>
                          <button className="btn btn-ghost" style={{ padding: '4px', color: 'var(--danger)', opacity: 0.6 }} onClick={(e) => handleDeleteCost(item.id, e)}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    )
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
