import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const VITE_SUPABASE_URL = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1];
const VITE_SUPABASE_ANON_KEY = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1];

const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

async function testUpdate() {
  const { data, error } = await supabase
    .from('users')
    .update({ multi_roles: ['system administrator'] })
    .eq('staff_id', 'ADMIN-01')
    .select();
    
  console.log('Restore result data:', data);
  console.log('Restore result error:', error);
}

testUpdate();
