import { pool } from './connection';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

function maskDatabaseUri(uri: string): string {
  try {
    const url = new URL(uri);
    if (url.password) {
      url.password = '****';
    }
    return url.toString();
  } catch {
    return '(invalid URI)';
  }
}

function prompt(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function run() {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.error('No migration files found in lib/db/migrations/');
    process.exit(1);
  }

  const databaseUri = process.env.DATABASE_URI;
  if (!databaseUri) {
    console.error('DATABASE_URI environment variable is not set');
    process.exit(1);
  }

  console.log(`\nTarget database: ${maskDatabaseUri(databaseUri)}`);
  console.log('DANGER: If this is not the database you want to update, update your .env.local file.\n');
  console.log('Available migrations:');
  files.forEach((file, i) => {
    console.log(`  ${i + 1}) ${file}`);
  });

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  try {
    const answer = await prompt(rl, `\nSelect migration [1-${files.length}]: `);
    const index = parseInt(answer, 10) - 1;

    if (isNaN(index) || index < 0 || index >= files.length) {
      console.error('Invalid selection');
      process.exit(1);
    }

    const selected = files[index];
    const confirm = await prompt(rl, `Run "${selected}"? [y/N] `);

    if (confirm.toLowerCase() !== 'y') {
      console.log('Aborted');
      process.exit(0);
    }

    rl.close();

    const client = await pool.connect();
    try {
      const sql = fs.readFileSync(path.join(migrationsDir, selected), 'utf8');
      await client.query(sql);
      console.log(`Migration "${selected}" completed successfully`);
    } finally {
      client.release();
      await pool.end();
    }
  } catch (error) {
    rl.close();
    console.error('Migration failed:', error);
    await pool.end();
    process.exit(1);
  }
}

run();
