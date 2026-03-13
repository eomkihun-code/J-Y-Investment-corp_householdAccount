import React, { useCallback, useState } from 'react';
import { FileSpreadsheet, CheckCircle, Database, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import type { Transaction, TransactionType } from '../types/transaction';

interface ExcelUploadWidgetProps {
  onUploadSuccess: (transactions: Transaction[], fileName: string) => void;
  existingCount: number;
  uploadedFiles: string[];
}

// 헤더 이름으로 열 인덱스 자동 감지
function detectColumns(header: string[]): { card: number; date: number; desc: number; amount: number; category: number } {
  const h = header.map(s => (s || '').toString().trim().replace(/\s+/g, ''));
  
  const find = (keywords: string[]): number => {
    return h.findIndex(col => keywords.some(kw => col.includes(kw)));
  };

  const card = find(['카드사', '카드종류', '카드']);
  const date = find(['승인일자', '날짜', '일자', '결제일']);
  const desc = find(['가맹점명', '가맹점', '항목', '내용', '상호명', '사용처']);
  const amount = find(['승인금액', '사용금액', '금액', '결제금액']);
  const category = find(['대분류', '분류', '카테고리']);

  return { card, date, desc, amount, category };
}

export default function CsvUploadWidget({ onUploadSuccess, existingCount, uploadedFiles }: ExcelUploadWidgetProps) {
  const [isHovering, setIsHovering] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const processExcelFile = (file: File) => {
    setIsUploading(true);
    setSuccessMsg('');
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        if (!arrayBuffer) throw new Error("File is empty");
        
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        
        // Sheet1 (첫 번째 시트) 파싱
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        if (!worksheet) throw new Error("시트를 찾을 수 없습니다.");
        
        // raw: false → 엑셀에 표시된 텍스트 그대로 가져옴 (시리얼 넘버 대신 날짜 문자열)
        const rawData: string[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' });
        
        if (rawData.length < 2) throw new Error("데이터가 부족합니다.");

        // 헤더 행에서 열 인덱스 자동 감지
        const headerRow = rawData[0].map(String);
        const cols = detectColumns(headerRow);
        
        console.log('[ExcelParser] 감지된 헤더:', headerRow);
        console.log('[ExcelParser] 감지된 열 인덱스:', cols);
        
        // 필수 열 검증
        if (cols.date === -1 || cols.desc === -1 || cols.amount === -1) {
          alert(`엑셀 헤더를 인식할 수 없습니다.\n감지된 헤더: ${headerRow.join(', ')}\n\n필수 열: 승인일자(또는 날짜), 가맹점명(또는 항목), 승인금액(또는 사용금액)`);
          setIsUploading(false);
          return;
        }

        const newTransactions: Transaction[] = [];
        let rowCount = 0;

        for (let i = 1; i < rawData.length; i++) {
          const row = rawData[i];
          if (!row || row.every(cell => !cell || String(cell).trim() === '')) continue;

          // 열 인덱스 기반 데이터 추출
          const cardType = cols.card >= 0 ? String(row[cols.card] || '').trim() : '';
          const rawDate = String(row[cols.date] || '').trim();
          const description = String(row[cols.desc] || '').trim();
          const rawAmount = String(row[cols.amount] || '').replace(/[,원\s]/g, '').trim();
          const category = cols.category >= 0 ? String(row[cols.category] || '').trim() : '기타';

          if (!description) continue;

          // 금액 파싱
          const amount = parseFloat(rawAmount) || 0;
          if (amount === 0) continue;

          // 날짜 파싱 (raw: false이므로 문자열로 제공됨)
          let dateStr = new Date().toISOString();
          const match = rawDate.match(/(\d{2,4})[^\d]+(\d{1,2})[^\d]+(\d{1,2})/);
          if (match) {
            let year = parseInt(match[1]);
            if (year < 100) year = year > 50 ? 1900 + year : 2000 + year;
            const month = match[2].padStart(2, '0');
            const day = match[3].padStart(2, '0');
            dateStr = new Date(`${year}-${month}-${day}T00:00:00`).toISOString();
          }

          // 타입 설정
          let type: TransactionType = 'expense';
          const finalAmount = Math.abs(amount);
          
          if (amount < 0 || description.includes('입금') || description.includes('환불') || category === '수입') {
            type = 'income';
          }

          newTransactions.push({
            id: crypto.randomUUID(),
            date: dateStr,
            description,
            amount: finalAmount,
            type,
            category: category || '기타',
            cardType: cardType
          });
          rowCount++;
        }

        setIsUploading(false);
        
        if (rowCount === 0) {
          alert('엑셀 파일에서 유효한 거래 내역을 찾지 못했습니다.\n시트 구조를 확인해주세요.');
          return;
        }
        
        setSuccessMsg(`${sheetName} 시트에서 ${rowCount}건의 거래 내역을 불러왔습니다.`);
        setTimeout(() => setSuccessMsg(''), 4000);
        
        onUploadSuccess(newTransactions, file.name);
        
      } catch (err) {
        console.error("Error parsing excel file:", err);
        setIsUploading(false);
        alert("엑셀 파일 분석에 실패했습니다. 양식이 맞는지 확인해주세요.\n[필수: 승인일자, 가맹점명, 승인금액 열이 포함되어야 합니다]");
      }
    };
    
    reader.readAsArrayBuffer(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsHovering(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const ext = file.name.toLowerCase();
      if (ext.endsWith('.xlsx') || ext.endsWith('.xls')) {
        processExcelFile(file);
      } else {
        alert("엑셀 파일(.xlsx, .xls)만 업로드 가능합니다.");
      }
    }
  }, []);

  const hasData = existingCount > 0;

  return (
    <div>
      {/* 저장된 데이터 상태 표시 */}
      {hasData && (
        <div className="glass" style={{ 
          padding: '1rem 1.5rem', 
          marginBottom: '0.75rem', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          background: 'rgba(16, 185, 129, 0.04)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: '8px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '10px', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Database size={20} />
            </div>
            <div>
              <p style={{ fontWeight: '600', fontSize: '0.95rem', marginBottom: '2px' }}>
                📊 {existingCount.toLocaleString()}건의 거래 내역이 저장되어 있습니다
              </p>
              {uploadedFiles.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  {uploadedFiles.map((fname, idx) => (
                    <span key={idx} style={{ 
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                      fontSize: '0.78rem', color: 'var(--text-muted)', 
                      background: 'rgba(255,255,255,0.05)', padding: '2px 8px', 
                      borderRadius: '4px', border: '1px solid var(--glass-border)'
                    }}>
                      <FileText size={12} />
                      {fname}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>전체 삭제 전까지 유지됩니다</p>
        </div>
      )}

      {/* 업로드 드롭존 */}
      <div 
        className={`glass ${isHovering ? 'drag-hover' : ''}`}
        style={{ 
          padding: hasData ? '1.25rem' : '2rem', 
          textAlign: 'center', 
          borderStyle: 'dashed',
          borderWidth: '2px',
          borderColor: isHovering ? 'var(--primary)' : 'var(--glass-border)',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          background: isHovering ? 'rgba(99, 102, 241, 0.05)' : 'var(--glass-bg)',
          position: 'relative'
        }}
        onDragOver={(e) => { e.preventDefault(); setIsHovering(true); }}
        onDragLeave={() => setIsHovering(false)}
        onDrop={handleDrop}
        onClick={() => document.getElementById('excel-upload-input')?.click()}
      >
        <input 
          id="excel-upload-input"
          type="file" 
          accept=".xlsx,.xls" 
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              processExcelFile(e.target.files[0]);
              e.target.value = '';
            }
          }}
          disabled={isUploading}
        />
        
        {isUploading ? (
          <div style={{ color: 'var(--primary)' }}>
            <div className="loader" style={{ margin: '0 auto 1rem', width: '30px', height: '30px', border: '3px solid rgba(99,102,241,0.3)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
            <p>엑셀 데이터 분석 중...</p>
          </div>
        ) : successMsg ? (
          <div style={{ color: 'var(--success)' }}>
            <CheckCircle size={32} style={{ margin: '0 auto 1rem' }} />
            <p>{successMsg}</p>
          </div>
        ) : hasData ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
            <FileSpreadsheet size={22} style={{ color: 'var(--text-muted)' }} />
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              추가 엑셀 파일을 업로드하려면 여기를 클릭하거나 끌어다 놓으세요
            </p>
          </div>
        ) : (
          <>
            <FileSpreadsheet size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem' }} />
            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>엑셀 파일 업로드 (Drag & Drop)</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
              결제내역이 포함된 엑셀 파일(.xlsx)을 여기에 끌어다 놓으세요.
            </p>
            <div style={{ padding: '0.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <strong>Sheet1 필수 양식:</strong> 승인일자, 가맹점명, 승인금액 (카드사·대분류는 선택)
            </div>
          </>
        )}

        <style>
          {`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}
        </style>
      </div>
    </div>
  );
}
