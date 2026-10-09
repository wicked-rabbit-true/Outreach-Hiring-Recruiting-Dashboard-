// Creates the three tables. Safe to run more than once. Usage: npm run mysql:init
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import mysql from 'mysql2/promise';
import { connectionOptions } from '../lib/data/mysql';

(async () => {
  const conn = await mysql.createConnection({ ...connectionOptions(), multipleStatements: true });
  await conn.query(readFileSync(join(__dirname, '../sql/schema.sql'), 'utf8'));
  await conn.end();
  console.log('MySQL tables are ready: lead_records, assignments, spend');
})().catch((e) => { console.error(e); process.exit(1); });
