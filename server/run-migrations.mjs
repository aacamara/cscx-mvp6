#!/usr/bin/env node
/**
 * Run Supabase migrations using pg client
 */

import pg from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const DATABASE_PASSWORD = process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD;

if (!SUPABASE_URL) {
  console.error('Missing SUPABASE_URL');
  process.exit(1);
}

// Extract project ref from URL
const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)/)?.[1];
if (!projectRef) {
  console.error('Could not extract project ref from SUPABASE_URL');
  process.exit(1);
}

// Construct database connection string
// Try pooler format for Supabase
const connectionString = process.env.DATABASE_URL ||
  `postgresql://postgres.${projectRef}:${DATABASE_PASSWORD}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;

const migrations = [
  '068_analytics_events.sql',
  '069_user_feedback.sql'
];

async function runMigrations() {
  console.log('Running migrations for project:', projectRef);

  if (!DATABASE_PASSWORD && !process.env.DATABASE_URL) {
    console.log('\nNo database password found. Please set SUPABASE_DB_PASSWORD or DATABASE_URL.');
    console.log('\nAlternatively, run these migrations in the Supabase SQL Editor:');
    console.log(`https://supabase.com/dashboard/project/${projectRef}/sql/new\n`);

    console.log('='.repeat(60));
    console.log('MIGRATION SQL TO RUN:');
    console.log('='.repeat(60));

    for (const file of migrations) {
      const path = join(__dirname, '../database/migrations', file);
      const sql = readFileSync(path, 'utf8');
      console.log(`\n-- ${file}`);
      console.log(sql);
    }

    console.log('='.repeat(60));
    return;
  }

  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database\n');

    for (const file of migrations) {
      const path = join(__dirname, '../database/migrations', file);
      console.log(`Running: ${file}`);

      try {
        const sql = readFileSync(path, 'utf8');
        await client.query(sql);
        console.log(`  Done\n`);
      } catch (err) {
        console.error(`  Error: ${err.message}\n`);
      }
    }

    console.log('All migrations complete!');
  } catch (err) {
    console.error('Connection error:', err.message);
    console.log('\nPlease run migrations manually in the Supabase SQL Editor:');
    console.log(`https://supabase.com/dashboard/project/${projectRef}/sql/new`);
  } finally {
    await client.end();
  }
}

runMigrations();
