import { createClient } from '@supabase/supabase-js';
import xlsx from 'xlsx';
import fs from 'fs';

// 환경 변수 로드
const envContent = fs.readFileSync('.env.local', 'utf8');
const env = envContent.split('\n').reduce((acc, line) => {
    const [k, ...v] = line.split('=');
    if (k && v.length > 0) acc[k.trim()] = v.join('=').trim();
    return acc;
}, {});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const USER_ID = '5be27267-8d73-49c2-b631-cf5388f4dc12';
const EXCEL_PATH = 'C:/Job/3.Study/월 고정비용.xlsx';

async function migrate() {
    try {
        console.log('엑셀 파일 읽는 중:', EXCEL_PATH);
        const workbook = xlsx.readFile(EXCEL_PATH);
        const sheetName = '상세 리스트';
        const sheet = workbook.Sheets[sheetName];
        
        if (!sheet) {
            throw new Error(`시트 "${sheetName}"를 찾을 수 없습니다.`);
        }

        const rawData = xlsx.utils.sheet_to_json(sheet);
        console.log(`총 ${rawData.length}개의 데이터를 찾았습니다.`);

        // 헤더 감지 로직
        const headers = Object.keys(rawData[0] || {});
        const clean = (s) => (s || '').toString().toLowerCase().trim().replace(/[\s\(\)\[\]]/g, '');
        
        const findKey = (keywords) => {
            const cleanKeywords = keywords.map(kw => kw.toLowerCase().replace(/[\s\(\)\[\]]/g, ''));
            return headers.find(h => cleanKeywords.some(kw => clean(h).includes(kw)));
        };

        const categoryKey = findKey(['카테고리', '분류']);
        const itemKey = findKey(['상세항목', '항목', '내용', '가맹점']);
        const amountKey = findKey(['금액', '승인금액']);
        const noteKey = findKey(['비고', '메모']);

        console.log('감지된 키:', { categoryKey, itemKey, amountKey, noteKey });

        const fixedCosts = rawData.map(row => ({
            user_id: USER_ID,
            category: row[categoryKey] || '기타',
            item: row[itemKey],
            amount: parseInt(String(row[amountKey] || '0').replace(/[^0-9.-]/g, ''), 10) || 0,
            note: row[noteKey] || '',
            auto_transfer: '미설정'
        })).filter(item => item.item);

        console.log(`${fixedCosts.length}개의 유효한 데이터를 Supabase에 삽입하는 중...`);

        const { data, error } = await supabase
            .from('fixed_costs')
            .insert(fixedCosts);

        if (error) {
            throw error;
        }

        console.log('✅ 마이그레이션 성공!');
        console.log(JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('❌ 마이그레이션 실패:', err.message);
        process.exit(1);
    }
}

migrate();
