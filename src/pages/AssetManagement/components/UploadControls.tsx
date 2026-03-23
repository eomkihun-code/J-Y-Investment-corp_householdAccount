import { useRef } from 'react';
import '../styles/UploadControls.css';
import type { Account, CashFlow } from '../types';
import { parseExcelCash, parseExcelStocks, parseExcelIncome } from '../utils/excelParser';

interface Props {
  onCashUploaded: (data: Account[]) => void;
  onStocksUploaded: (data: Account[]) => void;
  onIncomeUploaded: (data: CashFlow[]) => void;
  
  onClearCash: () => void;
  onClearStocks: () => void;
  onClearIncome: () => void;
  onOpenManualEditor: () => void;
}

export default function UploadControls({
  onCashUploaded, onStocksUploaded, onIncomeUploaded,
  onClearCash, onClearStocks, onClearIncome,
  onOpenManualEditor
}: Props) {
  const cashRef = useRef<HTMLInputElement>(null);
  const stocksRef = useRef<HTMLInputElement>(null);
  const incomeRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'cash' | 'stocks' | 'income'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (type === 'income') {
        const data = await parseExcelIncome(file);
        onIncomeUploaded(data);
      } else if (type === 'cash') {
        const data = await parseExcelCash(file);
        onCashUploaded(data);
      } else if (type === 'stocks') {
        const data = await parseExcelStocks(file);
        onStocksUploaded(data);
      }
    } catch (error) {
      console.error(`Failed to parse ${type} excel:`, error);
      alert('엑셀 파일을 읽는 중 오류가 발생했습니다. 양식을 확인해주세요.');
    } finally {
      // Reset input so the same file can be uploaded again if needed
      e.target.value = '';
    }
  };

  return (
    <div className="upload-controls-container">
      <span className="dev-label">&lt;UploadControls /&gt;</span>
      
      <div className="upload-group">
        <span className="upload-label">현금 계좌</span>
        <input 
          type="file" 
          accept=".xlsx, .xls" 
          ref={cashRef}
          className="hidden-input"
          onChange={(e) => handleFileUpload(e, 'cash')}
        />
        <button className="icon-btn upload-btn" onClick={() => cashRef.current?.click()} title="엑셀 업로드">
          ⬆️
        </button>
        <button className="icon-btn clear-btn" onClick={onClearCash} title="데이터 지우기">
          🗑️
        </button>
      </div>

      <div className="upload-group">
        <span className="upload-label">주식 매매</span>
        <input 
          type="file" 
          accept=".xlsx, .xls" 
          ref={stocksRef}
          className="hidden-input"
          onChange={(e) => handleFileUpload(e, 'stocks')}
        />
        <button className="icon-btn upload-btn" onClick={() => stocksRef.current?.click()} title="엑셀 업로드">
          ⬆️
        </button>
        <button className="icon-btn clear-btn" onClick={onClearStocks} title="데이터 지우기">
          🗑️
        </button>
      </div>

      <div className="upload-group">
        <span className="upload-label">수입 (Income)</span>
        <input 
          type="file" 
          accept=".xlsx, .xls" 
          ref={incomeRef}
          className="hidden-input"
          onChange={(e) => handleFileUpload(e, 'income')}
        />
        <button className="icon-btn upload-btn" onClick={() => incomeRef.current?.click()} title="엑셀 업로드">
          ⬆️
        </button>
        <button className="icon-btn clear-btn" onClick={onClearIncome} title="데이터 지우기">
          🗑️
        </button>
      </div>

      <button className="manual-assets-btn" onClick={onOpenManualEditor}>
        📍 부동산/기타 자산 관리
      </button>
    </div>
  );
}
