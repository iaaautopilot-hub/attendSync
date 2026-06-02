import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const VITE_SUPABASE_URL = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1];
const VITE_SUPABASE_ANON_KEY = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1];

const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

async function checkEvents() {
  const { data: events, error } = await supabase.from('events').select('id, subject, department');
  if (error) console.error(error);
  console.log('\nEvents:');
  if (events) events.forEach(e => console.log(e.subject, '->', e.department));
}

checkEvents();
