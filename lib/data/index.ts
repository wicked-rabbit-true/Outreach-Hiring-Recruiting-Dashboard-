// The one place that chooses the data source: DATA_SOURCE=mysql | sheets (default: sheets).
// V2 (GoHighLevel): add lib/data/ghl.ts and one more branch here.
import type { DataSource } from '@/lib/types';
import { env } from '@/settings/settings';
import { GoogleSheetsSource } from './sheets';
import { MysqlSource } from './mysql';

let source: DataSource | null = null;

export function getSource(): DataSource {
  if (!source) source = env('dataSource').toLowerCase() === 'mysql' ? new MysqlSource() : new GoogleSheetsSource();
  return source;
}
