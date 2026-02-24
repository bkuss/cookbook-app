import { pool } from './connection';
import * as fs from 'fs';
import * as path from 'path';

async function migrate(filename: string) {
  const migrationPath = path.join(__dirname, 'migrations', filename);

  if (!fs.existsSync(migrationPath)) {
    console.error(`Migration file not found: ${migrationPath}`);
    process.exit(1);
  }

  const client = await pool.connect();

  try {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    await client.query(sql);
    console.log(`Migration "${filename}" completed successfully`);
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

const filename = process.argv[2];

if (!filename) {
  console.error('Usage: tsx lib/db/migrate.ts <filename>');
  console.error('Example: tsx lib/db/migrate.ts 000_all.sql');
  process.exit(1);
}

migrate(filename).catch(console.error);
