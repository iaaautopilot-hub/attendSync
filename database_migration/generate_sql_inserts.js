import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backupDir = path.join(__dirname, 'backup_data');

function escapeSqlVal(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number') return val.toString();
  if (Array.isArray(val)) {
    // Array format for PostgreSQL: ARRAY['a', 'b']
    if (val.length === 0) return "'{}'::text[]";
    const escapedItems = val.map(item => `'${item.replace(/'/g, "''")}'`);
    return `ARRAY[${escapedItems.join(', ')}]::text[]`;
  }
  if (typeof val === 'object') {
    return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
  }
  // String escaping
  return `'${val.toString().replace(/'/g, "''")}'`;
}

function generateInsertsForTable(tableName, rows) {
  if (!rows || rows.length === 0) return `-- Table ${tableName} has no rows\n\n`;

  let sql = `-- ==========================================\n`;
  sql += `-- Table: ${tableName} (${rows.length} rows)\n`;
  sql += `-- ==========================================\n`;

  const columns = Object.keys(rows[0]);
  const colList = columns.map(c => `"${c}"`).join(', ');

  const chunkSize = 100;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    sql += `INSERT INTO public."${tableName}" (${colList}) VALUES\n`;
    const valRows = chunk.map(row => {
      const vals = columns.map(c => escapeSqlVal(row[c]));
      return `(${vals.join(', ')})`;
    });
    sql += valRows.join(',\n') + '\nON CONFLICT DO NOTHING;\n\n';
  }

  return sql;
}

function run() {
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

  let fullSql = `-- Complete Data Migration Script\n-- Generated on: ${new Date().toISOString()}\n\n`;

  for (const table of tables) {
    const filePath = path.join(backupDir, `${table}.json`);
    if (!fs.existsSync(filePath)) {
      console.warn(`File not found: ${filePath}`);
      continue;
    }
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    console.log(`Generating SQL for ${table} (${data.length} rows)...`);
    const tableSql = generateInsertsForTable(table, data);
    
    // Also save separate table sql files for easy loading in Supabase SQL editor
    fs.writeFileSync(path.join(__dirname, `data_${table}.sql`), tableSql, 'utf-8');
    fullSql += tableSql;
  }

  fs.writeFileSync(path.join(__dirname, '02_all_data.sql'), fullSql, 'utf-8');
  console.log('Saved 02_all_data.sql and individual table data scripts.');
}

run();
