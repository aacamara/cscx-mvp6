import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // CORS
  corsOrigin: process.env.CORS_ORIGIN || '*',

  // Rate Limiting
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),

  // Supabase
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',

  // AI APIs - Primary: Claude (Anthropic), Fallback: Gemini
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',

  // Storage
  storageBucket: process.env.STORAGE_BUCKET || 'contracts',

  // Google Workspace OAuth
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/google/auth/callback',
    // Default folder for all generated documents (optional - uses user's root if not set)
    defaultFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID || '',
  },

  // App URLs
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  // Integrations (optional - legacy)
  salesforceClientId: process.env.SALESFORCE_CLIENT_ID || '',
  salesforceClientSecret: process.env.SALESFORCE_CLIENT_SECRET || '',
  hubspotApiKey: process.env.HUBSPOT_API_KEY || '',
  zoomClientId: process.env.ZOOM_CLIENT_ID || '',
  zoomClientSecret: process.env.ZOOM_CLIENT_SECRET || '',

  // Otter AI Integration
  otterWebhookSecret: process.env.OTTER_WEBHOOK_SECRET || '',
};

// Validate required config
export function validateConfig(): void {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Anthropic API key is now primary - required for production
  if (!config.anthropicApiKey) {
    if (config.nodeEnv === 'production') {
      errors.push('ANTHROPIC_API_KEY is required for production');
    } else {
      warnings.push('ANTHROPIC_API_KEY not set - Claude-powered features will fail');
    }
  }

  // Gemini is optional fallback
  if (!config.geminiApiKey && !config.anthropicApiKey) {
    errors.push('At least one AI API key (ANTHROPIC_API_KEY or GEMINI_API_KEY) is required');
  }

  // Database is optional but recommended
  if (!config.supabaseUrl || !config.supabaseServiceKey) {
    warnings.push('Supabase not configured - using in-memory storage (data will not persist)');
  }

  // Log warnings
  if (warnings.length > 0) {
    console.warn('\n⚠️  Configuration Warnings:');
    warnings.forEach(w => console.warn(`   - ${w}`));
    console.warn('');
  }

  // Log errors and exit if critical
  if (errors.length > 0) {
    console.error('\n❌ Configuration Errors:');
    errors.forEach(e => console.error(`   - ${e}`));
    console.error('\nPlease set the required environment variables and restart.');
    if (config.nodeEnv === 'production') {
      process.exit(1);
    }
  }

  // Log success info
  console.log('📋 Configuration loaded:');
  console.log(`   - Environment: ${config.nodeEnv}`);
  console.log(`   - Port: ${config.port}`);
  console.log(`   - Claude API: ${config.anthropicApiKey ? '✓ configured' : '✗ not set'}`);
  console.log(`   - Gemini API: ${config.geminiApiKey ? '✓ configured' : '✗ not set'}`);
  console.log(`   - Supabase: ${config.supabaseUrl ? '✓ configured' : '✗ in-memory mode'}`);
  console.log(`   - Google OAuth: ${config.google.clientId ? '✓ configured' : '✗ not set'}`);
  console.log('');
}

validateConfig();
