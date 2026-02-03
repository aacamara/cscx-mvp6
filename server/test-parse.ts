import { ClaudeService } from './src/services/claude.js';
import { GeminiService } from './src/services/gemini.js';

async function test() {
  console.log('Testing AI services...');

  // Test Gemini first
  console.log('\n=== Testing Gemini ===');
  try {
    const gemini = new GeminiService();
    const geminiResult = await gemini.generate('Say hello in one word');
    console.log('Gemini success:', geminiResult);
  } catch (err) {
    console.error('Gemini error:', err);
  }

  // Test Claude
  console.log('\n=== Testing Claude ===');
  try {
    const claude = new ClaudeService();
    const claudeResult = await claude.generate('Say hello in one word');
    console.log('Claude success:', claudeResult);
  } catch (err) {
    console.error('Claude error:', err);
  }

  // Test contract parsing
  console.log('\n=== Testing Contract Parsing ===');
  try {
    const claude = new ClaudeService();
    const contractText = 'Service Agreement between Acme Corp. Annual value: $150,000. 50 user licenses.';
    const result = await claude.parseContract(contractText);
    console.log('Parse success:', JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Parse error:', err);
  }
}

test().catch(console.error);
