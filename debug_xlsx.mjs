import * as XLSX from 'xlsx';
import { readFileSync } from 'fs';

const buf = readFileSync('./sample_transactions_v2.xlsx');
const wb = XLSX.read(buf, { type: 'buffer' });

wb.SheetNames.forEach(sheetName => {
  console.log(`\n=== Sheet: ${sheetName} ===`);
  const ws = wb.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(ws);
  console.log(`Total rows: ${data.length}`);
  
  const searchKeywords = ['월세', '급여', '관리비', '교육', '고정비'];
  const matches = data.filter(row => {
    const str = JSON.stringify(row);
    return searchKeywords.some(kw => str.includes(kw));
  });
  
  console.log(`Matches for keywords ${searchKeywords.join(', ')}: ${matches.length}`);
  matches.forEach((m, idx) => console.log(`  Match ${idx + 1}:`, JSON.stringify(m)));
});
