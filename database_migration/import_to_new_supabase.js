import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backupDir = path.join(__dirname, 'backup_data');

const NEW_SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://nqjhcopbxroxabithxpm.supabase.co';
const NEW_SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_5j0CYMyR3DtM919K6G0GOQ_xM4K0Mvk';

const newSupabase = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_KEY);

async function checkSchemaExists() {
  const { error } = await newSupabase.from('roles').select('id').limit(1);
  if (error && error.code === 'PGRST205') {
    return false;
  }
  return true;
}

async function insertInBatches(table, rows, batchSize = 50) {
  if (!rows || rows.length === 0) {
    console.log(`- ${table}: 0 rows to insert.`);
    return;
  }

  console.log(`- Inserting ${rows.length} rows into ${table} in batches of ${batchSize}...`);
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const { error } = await newSupabase.from(table).upsert(chunk, { ignoreDuplicates: true });
    if (error) {
      console.error(`  Error in batch ${i} - ${i + chunk.length} for ${table}:`, error.message);
      throw error;
    }
    process.stdout.write(`  Inserted ${Math.min(i + batchSize, rows.length)}/${rows.length}\r`);
  }
  console.log(`  Done inserting ${rows.length} rows into ${table}.`);
}

async function verifyCounts(tables) {
  console.log('\n--- VERIFYING NEW SUPABASE ROW COUNTS ---');
  const summary = {};
  for (const table of tables) {
    const { count, error } = await newSupabase.from(table).select('*', { count: 'exact', head: true });
    summary[table] = error ? `Error: ${error.message}` : count;
  }
  console.table(summary);
}

async function runImport() {
  console.log(`Target Supabase URL: ${NEW_SUPABASE_URL}`);
  
  const schemaExists = await checkSchemaExists();
  if (!schemaExists) {
    console.error('\n[ERROR] Tables do not exist yet in the new Supabase project!');
    console.error('Please run database_migration/01_schema.sql in the Supabase SQL Editor first.');
    console.error('After running the SQL script in Supabase, run this script again:\n  node database_migration/import_to_new_supabase.js\n');
    process.exit(1);
  }

  const tables = [
    'roles',
    'departments',
    'rank',
    'hub',
    'users',
    'events',
    'event_assignments',
    'event_signatures'
  ];

  for (const table of tables) {
    const filePath = path.join(backupDir, `${table}.json`);
    if (!fs.existsSync(filePath)) {
      console.warn(`File not found: ${filePath}, skipping...`);
      continue;
    }
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    await insertInBatches(table, data, 50);
  }

  await verifyCounts(tables);
  console.log('\nSUCCESS: All data successfully migrated to the new Supabase project!');
}

runImport().catch(err => {
  console.error('\nMigration failed:', err);
  process.exit(1);
});
