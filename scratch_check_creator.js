import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const VITE_SUPABASE_URL = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const VITE_SUPABASE_ANON_KEY = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

async function checkAllEvents() {
  const { data: events } = await supabase.from('events').select('id, subject, created_by');
  console.log('All Events:');
  events.forEach(e => {
    console.log(`- Subject: "${e.subject}" | Created By: ${e.created_by}`);
  });
}

checkAllEvents();
