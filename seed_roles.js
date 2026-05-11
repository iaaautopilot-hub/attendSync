import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const VITE_SUPABASE_URL = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1];
const VITE_SUPABASE_ANON_KEY = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1];

const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

async function seedRoles() {
  console.log('Seeding roles...');
  const rolesToInsert = [
    { role_name: 'Admin' },
    { role_name: 'Instructor' },
    { role_name: 'Chairman' }
  ];

  for (const role of rolesToInsert) {
    const { data, error } = await supabase.from('roles').insert([role]).select();
    if (error) {
      console.error(`Error inserting role ${role.role_name}:`, error.message);
    } else {
      console.log(`Inserted role: ${role.role_name}`, data);
    }
  }
}

seedRoles();
