import * as XLSX from 'xlsx';
import { readFileSync } from 'fs';

const buf = readFileSync('./sample_transactions_v2.xlsx');
const wb = XLSX.read(buf, { type: 'buffer' });

console.log('Sheet names:', wb.SheetNames);

const ws = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

console.log('\nTotal rows:', data.length);
console.log('\n=== Header (row 0) ===');
console.log(JSON.stringify(data[0]));

console.log('\n=== First 10 data rows ===');
for (let i = 1; i <= Math.min(10, data.length - 1); i++) {
  const row = data[i];
  console.log(`Row ${i}:`, JSON.stringify(row));
  console.log(`  Col[0] type=${typeof row[0]}, val=${row[0]}`);
  console.log(`  Col[1] type=${typeof row[1]}, val=${row[1]}`);
  console.log(`  Col[2] type=${typeof row[2]}, val=${row[2]}`);
  console.log(`  Col[3] type=${typeof row[3]}, val=${row[3]}`);
  console.log(`  Col[4] type=${typeof row[4]}, val=${row[4]}`);
}
