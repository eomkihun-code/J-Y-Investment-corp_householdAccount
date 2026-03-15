import React, { useCallback, useState } from 'react';
import { FileSpreadsheet, CheckCircle, Database, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import type { Transaction, TransactionType } from '../types/transaction';

interface ExcelUploadWidgetProps {
  onUploadSuccess: (transactions: Transaction[], fileName: string) => void;
  existingCount: number;
  uploadedFiles: string[];
}

// 추출된 로우 데이터를 정제하는 통합 함수 (사용자 요청: 완벽한 평탄화 및 방어 로직)
function refineData(rows: any[][]): Transaction[] {
  if (rows.length < 2) return [];

  // 1. 헤더 추출 및 정제 (공백 제거) - 첫 번째 줄을 헤더로 삼음
  const rawHeaders = rows[0];
  const cleanHeaders = rawHeaders.map(h => String(h || '').trim().replace(/\s+/g, ''));

  // 동적 키 인덱스 찾기 (지능형 키워드 매칭)
  const amountIdx = cleanHeaders.findIndex(h => h.includes('금액'));
  const dateIdx = cleanHeaders.findIndex(h => 
    ['승인일자', '날짜', '일자', '결제일'].some(kw => h.includes(kw))
  );
  const descIdx = cleanHeaders.findIndex(h => 
    ['가맹점명', '가맹점', '항목', '내용', '상호명', '사용처', '상세'].some(kw => h.includes(kw))
  );
  const cardIdx = cleanHeaders.findIndex(h => 
    ['카드사', '카드종류', '카드', '방법', '이체'].some(kw => h.includes(kw))
  );
  const categoryIdx = cleanHeaders.findIndex(h => 
    ['대분류', '분류', '카테고리'].some(kw => h.includes(kw))
  );

  // 필수 항목 누락 시 중단 (날짜는 필수가 아님 - 고정비 등 대응)
  if (amountIdx === -1 || descIdx === -1) {
    console.error("필수 컬럼을 찾을 수 없습니다. (금액/항목 필드 필요)", cleanHeaders);
    return [];
  }

  const transactions: Transaction[] = [];

  // 2. 데이터 로우 순회 (헤더 다음인 index 1부터 시작)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    // 빈 줄이거나 데이터가 너무 없으면 스킵
    if (!row || row.length === 0 || (row.length === 1 && !row[0])) continue;

    const rawAmount = row[amountIdx];
    const rawDate = row[dateIdx];
    const description = String(row[descIdx] || '').trim();
    const cardType = cardIdx !== -1 ? String(row[cardIdx] || '').trim() : '';
    const categoryName = categoryIdx !== -1 ? String(row[categoryIdx] || '').trim() : '기타';

    // 3. 결제 금액 방어 로직 (0원 유실 방지, 마이너스 부호 유지)
    if (rawAmount === undefined || rawAmount === null || String(rawAmount).trim() === '') continue;

    // 정규식 /[^0-9-]/g 사용하여 숫자와 마이너스 부호만 남김 (사용자 요청)
    const cleanAmountStr = String(rawAmount).replace(/[^0-9-]/g, '');
    const amount = Number(cleanAmountStr);

    if (isNaN(amount) || !description) continue;

    // 4. 날짜 데이터 안전 변환 (엑셀 일치번호 및 다양한 문자열 포맷 대응)
    let dateStr = '';
    if (typeof rawDate === 'number') {
      // 엑셀 시리얼 날짜 코드인 경우
      const dateObj = XLSX.SSF.parse_date_code(rawDate);
      dateStr = `${dateObj.y}-${String(dateObj.m).padStart(2, '0')}-${String(dateObj.d).padStart(2, '0')}`;
    } else {
      const dateString = String(rawDate || '').trim();
      // 날짜 형태 추출 (YYYY-MM-DD 등)
      const match = dateString.match(/(\d{2,4})[^\d]+(\d{1,2})[^\d]+(\d{1,2})/);
      if (match) {
        let year = parseInt(match[1]);
        if (year < 100) year = year > 50 ? 1900 + year : 2000 + year;
        const month = match[2].padStart(2, '0');
        const day = match[3].padStart(2, '0');
        dateStr = `${year}-${month}-${day}`;
      } else {
        dateStr = format(new Date(), 'yyyy-MM-dd');
      }
    }

    // 5. 평탄화된 수입/지출 객체 생성
    let type: TransactionType = 'expense';
    // 금액이 양수이면서 특정 키워드(입금, 수입)가 포함된 경우만 수입으로 간주
    if (amount > 0 && (description.includes('입금') || categoryName === '수입')) {
      type = 'income';
    }

    transactions.push({
      id: crypto.randomUUID(),
      date: new Date(dateStr).toISOString(),
      description,
      amount,
      type,
      category: categoryName || '기타',
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
    const fileName = file.name;
    const isJson = fileName.toLowerCase().endsWith('.json');

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        if (isJson) {
          const text = e.target?.result as string;
          const jsonData = JSON.parse(text);
          
          const finalData = Array.isArray(jsonData) ? jsonData.map((item: any) => ({
            id: item.id || crypto.randomUUID(),
            date: item.date || item.승인일자 || new Date().toISOString(),
            description: item.description || item.상세항목 || item['상세 항목'] || item.가맹점명 || '내역 없음',
            amount: Number(String(item.amount || item.금액 || item['금액 (원)'] || item['승인금액(원)'] || 0).replace(/[^0-9-]/g, '')),
            type: item.type || (Number(item.amount) > 0 ? 'income' : 'expense'),
            category: item.category || item.대분류 || item.카테고리 || '기타',
            cardType: item.cardType || item.카드사 || item['자동 이체 현황'] || ''
          })) : [];

          setIsUploading(false);
          setSuccessMsg(`${finalData.length}건의 JSON 데이터를 불러왔습니다.`);
          onUploadSuccess(finalData, fileName);
          return;
        }

        const arrayBuffer = e.target?.result as ArrayBuffer;
        if (!arrayBuffer) throw new Error("파일이 비어있습니다.");

        const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: false });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        if (!worksheet) throw new Error("첫 번째 시트를 찾을 수 없습니다.");
        
        const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];
        const finalTransactions = refineData(rawRows);

        setIsUploading(false);
        if (finalTransactions.length === 0) {
          alert('유효한 거래 내역을 찾지 못했습니다. 파일의 열 이름(금액, 날짜, 가맹점 등)을 확인해 주세요.');
          return;
        }
        
        setSuccessMsg(`${finalTransactions.length}건의 데이터를 완벽하게 정제하여 불러왔습니다.`);
        setTimeout(() => setSuccessMsg(''), 4000);
        onUploadSuccess(finalTransactions, fileName);
        
      } catch (err) {
        console.error("Parsing failed:", err);
        setIsUploading(false);
        alert("파일 분석 중 오류가 발생했습니다. 올바른 형식의 파일인지 확인해 주세요.");
      }
    };
    
    if (isJson) {
      reader.readAsText(file);
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
      if (ext.endsWith('.xlsx') || ext.endsWith('.xls') || ext.endsWith('.csv') || ext.endsWith('.json')) {
        processFile(file);
      } else {
        alert("엑셀(.xlsx), CSV(.csv), 또는 JSON(.json) 파일만 업로드 가능합니다.");
      }
    }
  }, []);

  const hasData = existingCount > 0;

  return (
    <div>
      {/* 저장된 데이터 상태 표시 */}
      {hasData && (
        <div className="glass mobile-stack" style={{ 
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
          accept=".xlsx,.xls,.csv,.json" 
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
              <strong>필수 포함 항목:</strong> 승인일자, 가맹점명, 승인금액 (공백이나 따옴표 포함 정석 CSV 지원, 평탄화 JSON 보장)
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
