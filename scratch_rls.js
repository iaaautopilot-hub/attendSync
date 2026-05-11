import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const VITE_SUPABASE_URL = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1];
const VITE_SUPABASE_ANON_KEY = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1];

const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

async function checkPolicies() {
  // Query using RPC or by fetching from a public view if they exposed one, but usually pg_policies is not accessible via anon.
  // Instead, maybe we can just check if we can insert/update dummy data to see if it's completely blocked.
  const { error } = await supabase.from('users').update({ full_name: 'test' }).eq('staff_id', 'NON_EXISTENT');
  console.log('Update non-existent error:', error?.message || 'No error (allowed or zero rows updated without error)');
}

checkPolicies();
