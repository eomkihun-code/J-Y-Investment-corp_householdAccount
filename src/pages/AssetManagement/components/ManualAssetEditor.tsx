import { useState } from 'react';
import '../styles/ManualAssetEditor.css';
import type { Account, Owner, AssetType } from '../types';

interface Props {
  accounts: Account[];
  onUpdate: (updated: Account[]) => void;
  onClose: () => void;
}

export default function ManualAssetEditor({ accounts, onUpdate, onClose }: Props) {
  const [localAccounts, setLocalAccounts] = useState<Account[]>([...accounts]);

  const handleUpdateField = (id: string, field: keyof Account, value: any) => {
    setLocalAccounts(prev => prev.map(acc => 
      acc.id === id ? { ...acc, [field]: value } : acc
    ));
  };

  const handleAddAsset = () => {
    const newAsset: Account = {
      id: `manual-${Date.now()}`,
      name: '새 자산',
      balance: 0,
      owner: 'Joint',
      type: 'RealEstate',
      currency: 'KRW',
      category: '부동산'
    };
    setLocalAccounts([...localAccounts, newAsset]);
  };

  const handleRemoveAsset = (id: string) => {
    setLocalAccounts(localAccounts.filter(acc => acc.id !== id));
  };

  const handleSave = () => {
    onUpdate(localAccounts);
    onClose();
  };

  return (
    <div className="manual-editor-overlay">
      <div className="manual-editor-content">
        <div className="manual-editor-header">
          <h3>📍 부동산 / 기타 자산 관리</h3>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        
        <div className="manual-editor-body">
          <div className="asset-edit-list">
            {localAccounts.map(acc => (
              <div className="asset-edit-item" key={acc.id}>
                <button 
                  className="delete-asset-btn" 
                  onClick={() => handleRemoveAsset(acc.id)}
                  title="삭제"
                >🗑️</button>
                
                <div className="input-group full-width">
                  <label>자산명</label>
                  <input 
                    type="text" 
                    value={acc.name} 
                    onChange={e => handleUpdateField(acc.id, 'name', e.target.value)}
                    placeholder="예: 한강자이아파트"
                  />
                </div>

                <div className="input-group">
                  <label>금액 (원)</label>
                  <input 
                    type="number" 
                    value={acc.balance} 
                    onChange={e => handleUpdateField(acc.id, 'balance', Number(e.target.value))}
                  />
                </div>

                <div className="input-group">
                  <label>소유주</label>
                  <select 
                    value={acc.owner} 
                    onChange={e => handleUpdateField(acc.id, 'owner', e.target.value as Owner)}
                  >
                    <option value="Husband">엄기훈</option>
                    <option value="Wife">최수진</option>
                    <option value="Joint">공동</option>
                  </select>
                </div>

                <div className="input-group">
                  <label>구분</label>
                  <select 
                    value={acc.type} 
                    onChange={e => handleUpdateField(acc.id, 'type', e.target.value as AssetType)}
                  >
                    <option value="RealEstate">부동산</option>
                    <option value="Crypto">가상자산</option>
                    <option value="Bank">은행(수동)</option>
                    <option value="Stock">주식(수동)</option>
                  </select>
                </div>

                <div className="input-group">
                  <label>카테고리</label>
                  <input 
                    type="text" 
                    value={acc.category} 
                    onChange={e => handleUpdateField(acc.id, 'category', e.target.value)}
                    placeholder="예: 실거주, 비트코인 등"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="manual-editor-footer">
          <button className="add-btn" onClick={handleAddAsset}>➕ 자산 추가</button>
          <button className="save-btn" onClick={handleSave}>저장하기</button>
        </div>
      </div>
    </div>
  );
}
