import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OLD_SUPABASE_URL = 'https://zrlonpwblvgovgwweajy.supabase.co';
const OLD_SUPABASE_KEY = 'sb_publishable_lxK8cPXAJPD2003Nfkk5Pg_hFzHwO_1';

const oldSupabase = createClient(OLD_SUPABASE_URL, OLD_SUPABASE_KEY);

const backupDir = path.join(__dirname, 'backup_data');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

async function fetchAll(table) {
  let all = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await oldSupabase
      .from(table)
      .select('*')
      .range(page * pageSize, (page + 1) * pageSize - 1);
    
    if (error) {
      console.error(`Error fetching ${table}:`, error);
      throw error;
    }
    all = all.concat(data);
    if (data.length < pageSize) break;
    page++;
  }
  return all;
}

async function runBackup() {
  console.log('Starting full data backup from old Supabase...');
  const tables = [
    'roles',
    'rank',
    'hub',
    'departments',
    'users',
    'events',
    'event_assignments',
    'event_signatures'
  ];

  const summary = {};

  for (const table of tables) {
    console.log(`Fetching table: ${table}...`);
    const data = await fetchAll(table);
    const filePath = path.join(backupDir, `${table}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    summary[table] = data.length;
    console.log(`Saved ${table}: ${data.length} records to ${filePath}`);
  }

  console.log('\n--- BACKUP COMPLETE ---');
  console.table(summary);
}

runBackup().catch(err => {
  console.error('Backup failed:', err);
  process.exit(1);
});
