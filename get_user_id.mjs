import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf8');
const env = envContent.split('\n').reduce((acc, line) => {
    const [k, ...v] = line.split('=');
    if (k && v.length > 0) acc[k.trim()] = v.join('=').trim();
    return acc;
}, {});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function getUserId() {
    console.log('Connecting to:', env.VITE_SUPABASE_URL);
    
    // Try transactions first
    let { data, error } = await supabase.from('transactions').select('user_id').limit(1);
    
    if (!error && data && data.length > 0) {
        console.log('USER_ID:' + data[0].user_id);
        return;
    }

    // Try fixed_costs
    ({ data, error } = await supabase.from('fixed_costs').select('user_id').limit(1));
    if (!error && data && data.length > 0) {
        console.log('USER_ID:' + data[0].user_id);
        return;
    }

    console.error('No data found in transactions or fixed_costs tables.');
    process.exit(1);
}

getUserId();
