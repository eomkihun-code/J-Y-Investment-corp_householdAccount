import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// 1. Load environment variables
const envContent = fs.readFileSync('.env.local', 'utf8');
const env = envContent.split('\n').reduce((acc, line) => {
    const [k, ...v] = line.split('=');
    if (k && v.length > 0) acc[k.trim()] = v.join('=').trim();
    return acc;
}, {});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const USER_ID = '5be27267-8d73-49c2-b631-cf5388f4dc12'; // Found from existing migrate script

async function migrateFixedCosts() {
    try {
        // 2. Read cleaned 고정비.json
        const jsonData = JSON.parse(fs.readFileSync('고정비.json', 'utf8'));
        console.log(`Read ${jsonData.length} items from 고정비.json`);

        // 3. Delete existing fixed costs for this user to avoid duplicates
        console.log(`Deleting existing fixed costs for user ${USER_ID}...`);
        const { error: deleteError } = await supabase
            .from('fixed_costs')
            .delete()
            .eq('user_id', USER_ID);

        if (deleteError) throw deleteError;

        // 4. Map and Insert new data
        const fixedCosts = jsonData.map(row => ({
            user_id: USER_ID,
            category: row['카테고리'] || '기타',
            item: row['상세 항목'] || row['항목'] || '미지정',
            amount: parseInt(String(row['금액 (원)'] || '0').replace(/[^0-9-]/g, ''), 10) || 0,
            note: row['비고'] || '',
            auto_transfer: row['자동 이체 현황'] || '미설정'
        }));

        console.log(`Inserting ${fixedCosts.length} items to Supabase...`);
        const { data, error: insertError } = await supabase
            .from('fixed_costs')
            .insert(fixedCosts)
            .select();

        if (insertError) throw insertError;

        console.log('✅ Migration Successful!');
        console.log(`Inserted ${data.length} records.`);
    } catch (err) {
        console.error('❌ Migration Failed:', err.message);
        process.exit(1);
    }
}

migrateFixedCosts();
