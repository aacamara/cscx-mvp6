/**
 * Run database migration script
 * Usage: npx tsx scripts/run-migration.ts
 */

import postgres from 'postgres';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

async function runMigration() {
  // Get database password from service key (it's the JWT token)
  const supabaseUrl = process.env.SUPABASE_URL;
  const dbPassword = process.env.SUPABASE_DB_PASSWORD || process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !dbPassword) {
    console.error('❌ SUPABASE_URL and SUPABASE_DB_PASSWORD (or SUPABASE_SERVICE_KEY) are required');
    process.exit(1);
  }

  // Extract project ref from URL (e.g., jzrdwhvmahdiiwhvcwgb from https://jzrdwhvmahdiiwhvcwgb.supabase.co)
  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
  if (!projectRef) {
    console.error('❌ Could not extract project reference from SUPABASE_URL');
    process.exit(1);
  }

  // Construct connection string for Supabase pooler
  const connectionString = `postgres://postgres.${projectRef}:${dbPassword}@aws-0-us-west-1.pooler.supabase.com:6543/postgres`;

  console.log('🔌 Connecting to Supabase PostgreSQL...');
  console.log(`   Project: ${projectRef}`);

  const sql = postgres(connectionString, {
    ssl: 'require',
    max: 1,
    idle_timeout: 20,
    connect_timeout: 30,
  });

  try {
    // Test connection
    const result = await sql`SELECT current_database(), current_user`;
    console.log(`   Connected to: ${result[0].current_database} as ${result[0].current_user}\n`);

    // Read migration file
    const migrationPath = join(__dirname, '../../database/migrations/002_google_workspace.sql');
    console.log(`📄 Reading migration from: ${migrationPath}`);

    const migrationSql = readFileSync(migrationPath, 'utf-8');

    console.log('🚀 Running migration...');
    console.log('   This may take a moment...\n');

    // Execute the entire migration
    await sql.unsafe(migrationSql);

    console.log('✅ Migration completed successfully!\n');

    // Verify key objects were created
    console.log('🔍 Verifying migration...');

    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('knowledge_documents', 'knowledge_chunks', 'gmail_threads', 'calendar_events', 'csm_playbooks')
    `;
    console.log(`   Tables created: ${tables.map(t => t.table_name).join(', ')}`);

    const functions = await sql`
      SELECT routine_name
      FROM information_schema.routines
      WHERE routine_schema = 'public'
      AND routine_name IN ('search_knowledge', 'get_customer_context')
    `;
    console.log(`   Functions created: ${functions.map(f => f.routine_name).join(', ')}`);

    const extensions = await sql`
      SELECT extname FROM pg_extension WHERE extname IN ('vector', 'pg_trgm')
    `;
    console.log(`   Extensions enabled: ${extensions.map(e => e.extname).join(', ')}`);

    console.log('\n✅ All done! The knowledge base and email agent are now fully operational.\n');

  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);

    if (error.message.includes('password authentication failed')) {
      console.log('\n💡 Tip: The SUPABASE_SERVICE_KEY might not work as a database password.');
      console.log('   Try setting SUPABASE_DB_PASSWORD to your actual database password.');
      console.log('   You can find it in Supabase Dashboard > Settings > Database > Connection string');
    }

    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigration().catch(console.error);
