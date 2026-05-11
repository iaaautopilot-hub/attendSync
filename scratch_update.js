import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const VITE_SUPABASE_URL = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1];
const VITE_SUPABASE_ANON_KEY = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1];

const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

async function testUpdate() {
  const { data, error } = await supabase
    .from('users')
    .update({ full_name: 'Suhardiman Tester' })
    .eq('staff_id', '1003668')
    .select();
    
  console.log('Update result data:', data);
  console.log('Update result error:', error);
}

testUpdate();
