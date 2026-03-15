import React, { useCallback, useState } from 'react';
import { FileSpreadsheet, CheckCircle, Database, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import type { Transaction, TransactionType } from '../types/transaction';

interface ExcelUploadWidgetProps {
  onUploadSuccess: (transactions: Transaction[], fileName: string) => void;
  existingCount: number;
  uploadedFiles: string[];
}

// 추출된 로우 데이터를 정제하는 통합 함수 (사용자 요청 로직 반영)
function refineData(rawData: any[]): Transaction[] {
  const transactions: Transaction[] = [];

  for (const row of rawData) {
    // 1. 헤더 공백 제거 및 동적 키 찾기 (사용자 요청: header.trim().replace(/\s+/g, ''))
    // PapaParse의 경우 transformHeader를 쓰지만, Excel(XLSX)은 직접 찾아야 함
    const keys = Object.keys(row);
    
    // 금액 키 찾기 (사용자 요청: key.includes('금액'))
    const amountKey = keys.find(key => key.toLowerCase().includes('금액'));
    // 날짜 키 찾기
    const dateKey = keys.find(key => 
      ['승인일자', '날짜', '일자', '결제일'].some(kw => key.toLowerCase().includes(kw))
    );
    // 가맹점명 키 찾기
    const descKey = keys.find(key => 
      ['가맹점명', '가맹점', '항목', '내용', '상호명', '사용처'].some(kw => key.toLowerCase().includes(kw))
    );
    // 카드사 키 찾기
    const cardKey = keys.find(key => 
      ['카드사', '카드종류', '카드'].some(kw => key.toLowerCase().includes(kw))
    );
    // 카테고리 키 찾기
    const categoryKey = keys.find(key => 
      ['대분류', '분류', '카테고리'].some(kw => key.toLowerCase().includes(kw))
    );

    if (!amountKey || !dateKey || !descKey) continue;

    const rawAmount = row[amountKey];
    const rawDate = String(row[dateKey] || '').trim();
    const description = String(row[descKey] || '').trim();
    const cardType = cardKey ? String(row[cardKey] || '').trim() : '';
    const category = categoryKey ? String(row[categoryKey] || '').trim() : '기타';

    // 2. 결제 금액 0원(포인트 결제) 방어 로직 (사용자 요청)
    if (rawAmount === undefined || rawAmount === null || String(rawAmount).trim() === '') continue;

    // 3. 완벽한 숫자 형변환 (마이너스 부호 유지, 사용자 요청)
    const cleanAmountStr = String(rawAmount).replace(/[^0-9-]/g, '');
    const amount = parseInt(cleanAmountStr, 10);

    if (isNaN(amount) || !description) continue;

    // 4. 날짜 파싱
    let dateStr = new Date().toISOString();
    const match = rawDate.match(/(\d{2,4})[^\d]+(\d{1,2})[^\d]+(\d{1,2})/);
    if (match) {
      let year = parseInt(match[1]);
      if (year < 100) year = year > 50 ? 1900 + year : 2000 + year;
      const month = match[2].padStart(2, '0');
      const day = match[3].padStart(2, '0');
      dateStr = new Date(`${year}-${month}-${day}T00:00:00`).toISOString();
    }

    // 5. 타입 설정 (환불은 마이너스 지출로 유지)
    let type: TransactionType = 'expense';
    if (description.includes('입금') || category === '수입') {
      type = 'income';
    }

    transactions.push({
      id: crypto.randomUUID(),
      date: dateStr,
      description,
      amount,
      type,
      category: category || '기타',
      cardType: cardType
    });
  }

  return transactions;
}

export default function CsvUploadWidget({ onUploadSuccess, existingCount, uploadedFiles }: ExcelUploadWidgetProps) {
  const [isHovering, setIsHovering] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const processFile = (file: File) => {
    setIsUploading(true);
    setSuccessMsg('');
    const reader = new FileReader();
    const fileName = file.name;
    const isCsv = fileName.toLowerCase().endsWith('.csv');

    reader.onload = (e) => {
      try {
        let finalTransactions: Transaction[] = [];

        if (isCsv) {
          // 1. CSV 파싱 (PapaParse 사용 - 사용자 요청 설정)
          const text = e.target?.result as string;
          const parseResult = Papa.parse(text, {
            header: true,
            skipEmptyLines: true,
            quoteChar: '"',
            transformHeader: (header) => header.trim().replace(/\s+/g, '')
          });
          finalTransactions = refineData(parseResult.data);
        } else {
          // 2. Excel 파싱 (xlsx 사용)
          const arrayBuffer = e.target?.result as ArrayBuffer;
          const workbook = XLSX.read(arrayBuffer, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          
          if (!worksheet) throw new Error("시트를 찾을 수 없습니다.");
          
          const rawData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
          // 엑셀 데이터의 헤더도 공백 제거 처리하여 refineData에 전달
          const normalizedData = (rawData as any[]).map(row => {
            const newRow: any = {};
            Object.keys(row).forEach(key => {
              newRow[key.trim().replace(/\s+/g, '')] = row[key];
            });
            return newRow;
          });
          finalTransactions = refineData(normalizedData);
        }

        setIsUploading(false);
        
        if (finalTransactions.length === 0) {
          alert('파일에서 유효한 거래 내역을 찾지 못했습니다.\n시트 구조나 데이터를 확인해주세요.');
          return;
        }
        
        setSuccessMsg(`${finalTransactions.length}건의 거래 내역을 불러왔습니다.`);
        setTimeout(() => setSuccessMsg(''), 4000);
        
        onUploadSuccess(finalTransactions, fileName);
        
      } catch (err) {
        console.error("Error parsing file:", err);
        setIsUploading(false);
        alert("파일 분석에 실패했습니다. 양식이 맞는지 확인해주세요.\n[필수: 승인일자, 가맹점명, 승인금액 열이 포함되어야 합니다]");
      }
    };
    
    if (isCsv) {
      reader.readAsText(file, 'euc-kr'); // 한국어 CSV 고려 (필요시 utf-8로 시도 가능)
    } else {
      reader.readAsArrayBuffer(file);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsHovering(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const ext = file.name.toLowerCase();
      if (ext.endsWith('.xlsx') || ext.endsWith('.xls') || ext.endsWith('.csv')) {
        processFile(file);
      } else {
        alert("엑셀 파일(.xlsx, .xls) 또는 CSV 파일(.csv)만 업로드 가능합니다.");
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
          accept=".xlsx,.xls,.csv" 
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              processFile(e.target.files[0]);
              e.target.value = '';
            }
          }}
          disabled={isUploading}
        />
        
        {isUploading ? (
          <div style={{ color: 'var(--primary)' }}>
            <div className="loader" style={{ margin: '0 auto 1rem', width: '30px', height: '30px', border: '3px solid rgba(99,102,241,0.3)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
            <p>데이터 분석 중...</p>
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
              추가 파일(엑셀/CSV)을 업로드하려면 여기를 클릭하거나 끌어다 놓으세요
            </p>
          </div>
        ) : (
          <>
            <FileSpreadsheet size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem' }} />
            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>데이터 파일 업로드 (Drag & Drop)</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
              결제내역이 포함된 엑셀(.xlsx) 또는 CSV(.csv) 파일을 여기에 끌어다 놓으세요.
            </p>
            <div style={{ padding: '0.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <strong>필수 포함 항목:</strong> 승인일자, 가맹점명, 승인금액 (공백이나 따옴표 포함 정석 CSV 지원)
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
