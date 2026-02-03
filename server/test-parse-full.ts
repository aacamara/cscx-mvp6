import { ContractParser } from './src/services/contractParser.js';

async function test() {
  console.log('Testing ContractParser...');

  try {
    const parser = new ContractParser();
    const result = await parser.parse({
      type: 'text',
      content: 'Service Agreement between Acme Corp. Term: Jan 1, 2026 - Dec 31, 2026. Annual value: $150,000. 50 user licenses. Contact: John Smith, VP Sales.'
    });
    console.log('Parse success!');
    console.log('Company:', result.extraction.company_name);
    console.log('ARR:', result.extraction.arr);
    console.log('Summary length:', result.summary?.length);
    console.log('Plan phases:', result.plan?.phases?.length);
  } catch (err) {
    console.error('Full parse error:', err);
  }
}

test().catch(console.error);
