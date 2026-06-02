import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const VITE_SUPABASE_URL = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1];
const VITE_SUPABASE_ANON_KEY = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1];

const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

async function checkLeaders() {
  const { data: events, error } = await supabase.from('events').select('id, subject, department, event_assignments(users(full_name))');
  if (error) console.error(error);
  console.log('\nEvents and Leaders:');
  if (events) events.forEach(e => {
    const leaders = e.event_assignments.map(a => a.users?.full_name).join(', ');
    console.log(`[${e.department}] ${e.subject} -> Leaders: ${leaders}`);
  });
}

checkLeaders();
