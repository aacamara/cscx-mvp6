/**
 * Run Supabase Migrations
 * Executes SQL migration files against the Supabase database
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabase = createClient(
  config.supabaseUrl!,
  config.supabaseServiceKey!
);

async function runMigration(filename: string, sql: string): Promise<boolean> {
  console.log(`\n📄 Running migration: ${filename}`);

  try {
    // Split by semicolons but be careful with functions/triggers
    // For complex SQL, we'll run the whole file at once
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      // Try running directly if RPC doesn't exist
      console.log('  ⚠️  RPC not available, trying direct query...');

      // Split into statements (simple split, won't work for all cases)
      const statements = sql
        .split(/;\s*$/m)
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (const statement of statements) {
        if (statement.length < 10) continue;

        const { error: stmtError } = await supabase
          .from('_migrations_temp')
          .select('*')
          .limit(0);

        // This is a workaround - Supabase JS client doesn't support raw SQL
        // You'll need to run these in the Supabase Dashboard SQL Editor
      }

      console.log(`  ⚠️  Migration ${filename} needs to be run manually in Supabase Dashboard`);
      return false;
    }

    console.log(`  ✅ Migration ${filename} completed successfully`);
    return true;
  } catch (err) {
    console.error(`  ❌ Error running ${filename}:`, err);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting Supabase Migrations\n');
  console.log(`📍 Target: ${config.supabaseUrl}`);

  const migrationsDir = join(__dirname, '../../../database/migrations');

  // Get migrations 008-011
  const targetMigrations = ['008', '009', '010', '011'];

  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .filter(f => targetMigrations.some(t => f.startsWith(t)))
    .sort();

  console.log(`\n📋 Migrations to run: ${files.length}`);
  files.forEach(f => console.log(`   - ${f}`));

  const results: { file: string; success: boolean }[] = [];

  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), 'utf-8');
    const success = await runMigration(file, sql);
    results.push({ file, success });
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 Migration Results:');
  console.log('='.repeat(50));

  results.forEach(r => {
    const icon = r.success ? '✅' : '⚠️';
    console.log(`${icon} ${r.file}`);
  });

  const failed = results.filter(r => !r.success);
  if (failed.length > 0) {
    console.log(`\n⚠️  ${failed.length} migration(s) need manual execution.`);
    console.log('Run these SQL files in the Supabase Dashboard SQL Editor:');
    console.log('https://supabase.com/dashboard/project/jzrdwhvmahdiiwhvcwgb/sql');
    failed.forEach(f => console.log(`   - ${f.file}`));
  }
}

main().catch(console.error);
