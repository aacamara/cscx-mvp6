#!/usr/bin/env node
/**
 * Run Supabase Migration Script
 * Executes the database schema migration using the Supabase Management API
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
import dotenv from 'dotenv';
dotenv.config({ path: join(__dirname, '../server/.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment');
  process.exit(1);
}

// Extract project ref from URL
const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)/)?.[1];
if (!projectRef) {
  console.error('❌ Could not extract project ref from SUPABASE_URL');
  process.exit(1);
}

console.log(`📦 Project: ${projectRef}`);
console.log(`🔗 URL: ${SUPABASE_URL}`);

// Read migration file
const migrationPath = join(__dirname, '../database/migrations/001_initial_schema.sql');
let migrationSQL;

try {
  migrationSQL = readFileSync(migrationPath, 'utf8');
  console.log(`📄 Loaded migration: ${migrationPath}`);
  console.log(`📏 Size: ${migrationSQL.length} characters`);
} catch (error) {
  console.error('❌ Could not read migration file:', error.message);
  process.exit(1);
}

// Split migration into smaller statements for execution
// Supabase REST doesn't support raw SQL, so we need to use the Database API
// which requires a different approach

async function runMigration() {
  console.log('\n🚀 Starting migration...\n');

  // The Supabase REST API doesn't support DDL directly
  // We need to use the Management API or direct postgres connection

  // Try using the pg client directly to the pooler
  const { default: pg } = await import('pg');

  // Supabase connection string format for direct connection
  // Note: This requires the database password, not the service key
  // The service key is for the REST API only

  console.log('⚠️  The Supabase REST API does not support DDL (CREATE TABLE, etc.)');
  console.log('');
  console.log('To run the migration, please do ONE of the following:');
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('OPTION 1: Use Supabase Dashboard (Recommended)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('1. Go to: https://supabase.com/dashboard/project/' + projectRef + '/sql/new');
  console.log('2. Copy the contents of: database/migrations/001_initial_schema.sql');
  console.log('3. Paste into the SQL editor and click "Run"');
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('OPTION 2: Use Supabase CLI');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('1. Get your access token from: https://supabase.com/dashboard/account/tokens');
  console.log('2. Run: export SUPABASE_ACCESS_TOKEN=your_token');
  console.log('3. Run: supabase link --project-ref ' + projectRef);
  console.log('4. Run: supabase db push');
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('OPTION 3: Direct Postgres Connection');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('1. Get your database password from Project Settings > Database');
  console.log('2. Run: export DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-us-west-1.pooler.supabase.com:6543/postgres"');
  console.log('3. Run: psql $DATABASE_URL -f database/migrations/001_initial_schema.sql');
  console.log('');

  // Try to open the SQL editor in browser
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  const sqlEditorUrl = `https://supabase.com/dashboard/project/${projectRef}/sql/new`;
  console.log(`Opening SQL Editor: ${sqlEditorUrl}`);

  // Copy migration to clipboard if possible
  try {
    const { execSync } = await import('child_process');
    execSync(`echo "${migrationSQL.replace(/"/g, '\\"')}" | pbcopy`, { stdio: 'pipe' });
    console.log('✅ Migration SQL copied to clipboard!');
    console.log('   Just paste it in the SQL Editor and click Run.');
  } catch (e) {
    console.log('(Could not copy to clipboard automatically)');
  }

  // Try to open browser
  try {
    const { execSync } = await import('child_process');
    execSync(`open "${sqlEditorUrl}"`, { stdio: 'pipe' });
  } catch (e) {
    // Browser open failed, that's ok
  }
}

runMigration().catch(console.error);
