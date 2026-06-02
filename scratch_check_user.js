import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const VITE_SUPABASE_URL = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1];
const VITE_SUPABASE_ANON_KEY = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1];

const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

async function checkUsers() {
  const { data: users, error } = await supabase.from('users').select('username, full_name, multi_roles');
  console.log('Users:');
  users.forEach(u => console.log(u.username, u.full_name, u.multi_roles));

  const { data: events } = await supabase.from('events').select('id, name, department');
  console.log('\nEvents:');
  events.forEach(e => console.log(e.name, '->', e.department));
}

checkUsers();
