import * as XLSX from 'xlsx';
import { readFileSync } from 'fs';

const fileName = './sample_transactions.xlsx';
const buf = readFileSync(fileName);
const wb = XLSX.read(buf, { type: 'buffer' });

console.log(`\n=== File: ${fileName} ===`);
wb.SheetNames.forEach(sheetName => {
  console.log(`\n--- Sheet: ${sheetName} ---`);
  const ws = wb.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
  if (data.length > 0) {
    console.log(`Headers: ${JSON.stringify(data[0])}`);
    console.log(`First row: ${JSON.stringify(data[1])}`);
  } else {
    console.log('Sheet is empty');
  }
});
