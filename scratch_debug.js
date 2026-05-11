import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const VITE_SUPABASE_URL = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1];
const VITE_SUPABASE_ANON_KEY = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1];

const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

async function debugUpdate() {
  // 1. Fetch user to see current full_name
  const { data: user1 } = await supabase.from('users').select('*').eq('staff_id', '1003668').single();
  console.log('Before update, full_name:', user1?.full_name);

  // 2. Attempt update
  const newName = user1?.full_name === 'Suhardiman Tester' ? 'Suhardiman' : 'Suhardiman Tester';
  const { data: updateData, error: updateError } = await supabase
    .from('users')
    .update({ full_name: newName })
    .eq('staff_id', '1003668')
    .select();
    
  console.log('Update return data:', updateData);
  console.log('Update return error:', updateError);

  // 3. Fetch again
  const { data: user2 } = await supabase.from('users').select('*').eq('staff_id', '1003668').single();
  console.log('After update, full_name:', user2?.full_name);
}

debugUpdate();
