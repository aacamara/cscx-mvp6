/**
 * Data Access Tools Test
 * Tests all agent data access tools with mock context
 */

import {
  searchKnowledgeBaseTool,
  getPlaybookTool,
  searchSimilarCasesTool,
  getCustomer360Tool,
  getHealthTrendsTool,
  getCustomerHistoryTool,
  getEngagementMetricsTool,
  getRiskSignalsTool,
  getRenewalForecastTool,
  getPortfolioInsightsTool,
  compareToCohortTool,
} from '../index.js';
import { AgentContext } from '../../types.js';

// Mock context for testing
const mockContext: AgentContext = {
  customer: {
    id: 'test-customer-123',
    name: 'Acme Corp',
    industry: 'Technology',
    arr: 120000,
    mrr: 10000,
    tier: 'enterprise',
    status: 'active',
    healthScore: 75,
    csmName: 'Test CSM',
    primaryContact: {
      name: 'John Doe',
      email: 'john@acme.com',
      role: 'VP Engineering'
    }
  },
  contract: {
    id: 'contract-123',
    startDate: new Date('2024-01-01'),
    endDate: new Date('2025-01-01'),
    value: 120000,
    stakeholders: [
      { name: 'John Doe', role: 'VP Engineering', email: 'john@acme.com', isPrimary: true },
      { name: 'Jane Smith', role: 'CTO', email: 'jane@acme.com', isPrimary: false }
    ]
  },
  currentPhase: 'monitoring',
  riskSignals: [],
  userId: 'test-user-123'
};

async function runTests() {
  console.log('='.repeat(60));
  console.log('AGENT DATA ACCESS TOOLS TEST');
  console.log('='.repeat(60));
  console.log('');

  const results: { tool: string; success: boolean; error?: string }[] = [];

  // Test 1: search_knowledge_base
  console.log('1. Testing search_knowledge_base...');
  try {
    const result = await searchKnowledgeBaseTool.execute(
      { query: 'churn prevention', limit: 5 },
      mockContext
    );
    console.log('   Result:', result.success ? 'SUCCESS' : 'FAILED');
    if (result.data) console.log('   Found:', result.data.totalResults, 'results');
    results.push({ tool: 'search_knowledge_base', success: result.success });
  } catch (e) {
    console.log('   ERROR:', (e as Error).message);
    results.push({ tool: 'search_knowledge_base', success: false, error: (e as Error).message });
  }
  console.log('');

  // Test 2: get_playbook
  console.log('2. Testing get_playbook...');
  try {
    const result = await getPlaybookTool.execute(
      { situation: 'churn_risk' },
      mockContext
    );
    console.log('   Result:', result.success ? 'SUCCESS' : 'FAILED');
    if (result.data) console.log('   Playbook:', result.data.name);
    results.push({ tool: 'get_playbook', success: result.success });
  } catch (e) {
    console.log('   ERROR:', (e as Error).message);
    results.push({ tool: 'get_playbook', success: false, error: (e as Error).message });
  }
  console.log('');

  // Test 3: search_similar_cases
  console.log('3. Testing search_similar_cases...');
  try {
    const result = await searchSimilarCasesTool.execute(
      { situation: 'Customer showing signs of disengagement', limit: 3 },
      mockContext
    );
    console.log('   Result:', result.success ? 'SUCCESS' : 'FAILED');
    if (result.data) console.log('   Found:', result.data.cases?.length || 0, 'similar cases');
    results.push({ tool: 'search_similar_cases', success: result.success });
  } catch (e) {
    console.log('   ERROR:', (e as Error).message);
    results.push({ tool: 'search_similar_cases', success: false, error: (e as Error).message });
  }
  console.log('');

  // Test 4: get_customer_360
  console.log('4. Testing get_customer_360...');
  try {
    const result = await getCustomer360Tool.execute({}, mockContext);
    console.log('   Result:', result.success ? 'SUCCESS' : 'FAILED');
    if (result.data) {
      console.log('   Customer:', result.data.overview?.name);
      console.log('   Health Score:', result.data.health?.score);
    }
    results.push({ tool: 'get_customer_360', success: result.success });
  } catch (e) {
    console.log('   ERROR:', (e as Error).message);
    results.push({ tool: 'get_customer_360', success: false, error: (e as Error).message });
  }
  console.log('');

  // Test 5: get_health_trends
  console.log('5. Testing get_health_trends...');
  try {
    const result = await getHealthTrendsTool.execute(
      { timeRange: '30d' },
      mockContext
    );
    console.log('   Result:', result.success ? 'SUCCESS' : 'FAILED');
    if (result.data) {
      console.log('   Current Score:', result.data.currentScore);
      console.log('   Trend:', result.data.trend);
    }
    results.push({ tool: 'get_health_trends', success: result.success });
  } catch (e) {
    console.log('   ERROR:', (e as Error).message);
    results.push({ tool: 'get_health_trends', success: false, error: (e as Error).message });
  }
  console.log('');

  // Test 6: get_customer_history
  console.log('6. Testing get_customer_history...');
  try {
    const result = await getCustomerHistoryTool.execute(
      { limit: 10 },
      mockContext
    );
    console.log('   Result:', result.success ? 'SUCCESS' : 'FAILED');
    if (result.data) console.log('   Interactions:', result.data.interactions?.length || 0);
    results.push({ tool: 'get_customer_history', success: result.success });
  } catch (e) {
    console.log('   ERROR:', (e as Error).message);
    results.push({ tool: 'get_customer_history', success: false, error: (e as Error).message });
  }
  console.log('');

  // Test 7: get_engagement_metrics
  console.log('7. Testing get_engagement_metrics...');
  try {
    const result = await getEngagementMetricsTool.execute(
      { timeRange: '30d' },
      mockContext
    );
    console.log('   Result:', result.success ? 'SUCCESS' : 'FAILED');
    if (result.data) {
      console.log('   DAU/MAU:', result.data.dauMauRatio);
      console.log('   Adoption:', result.data.overallAdoption + '%');
    }
    results.push({ tool: 'get_engagement_metrics', success: result.success });
  } catch (e) {
    console.log('   ERROR:', (e as Error).message);
    results.push({ tool: 'get_engagement_metrics', success: false, error: (e as Error).message });
  }
  console.log('');

  // Test 8: get_risk_signals
  console.log('8. Testing get_risk_signals...');
  try {
    const result = await getRiskSignalsTool.execute({}, mockContext);
    console.log('   Result:', result.success ? 'SUCCESS' : 'FAILED');
    if (result.data) {
      console.log('   Overall Risk:', result.data.overallRisk);
      console.log('   Signals:', result.data.signals?.length || 0);
    }
    results.push({ tool: 'get_risk_signals', success: result.success });
  } catch (e) {
    console.log('   ERROR:', (e as Error).message);
    results.push({ tool: 'get_risk_signals', success: false, error: (e as Error).message });
  }
  console.log('');

  // Test 9: get_renewal_forecast
  console.log('9. Testing get_renewal_forecast...');
  try {
    const result = await getRenewalForecastTool.execute({}, mockContext);
    console.log('   Result:', result.success ? 'SUCCESS' : 'FAILED');
    if (result.data) {
      console.log('   Renewal Probability:', (result.data.renewalProbability * 100).toFixed(0) + '%');
      console.log('   Days Until Renewal:', result.data.daysUntilRenewal);
    }
    results.push({ tool: 'get_renewal_forecast', success: result.success });
  } catch (e) {
    console.log('   ERROR:', (e as Error).message);
    results.push({ tool: 'get_renewal_forecast', success: false, error: (e as Error).message });
  }
  console.log('');

  // Test 10: get_portfolio_insights
  console.log('10. Testing get_portfolio_insights...');
  try {
    const result = await getPortfolioInsightsTool.execute(
      { focus: 'health' },
      mockContext
    );
    console.log('   Result:', result.success ? 'SUCCESS' : 'FAILED');
    if (result.data) console.log('   Total Customers:', result.data.summary?.totalCustomers);
    results.push({ tool: 'get_portfolio_insights', success: result.success });
  } catch (e) {
    console.log('   ERROR:', (e as Error).message);
    results.push({ tool: 'get_portfolio_insights', success: false, error: (e as Error).message });
  }
  console.log('');

  // Test 11: compare_to_cohort
  console.log('11. Testing compare_to_cohort...');
  try {
    const result = await compareToCohortTool.execute(
      { cohortType: 'tier' },
      mockContext
    );
    console.log('   Result:', result.success ? 'SUCCESS' : 'FAILED');
    if (result.data) {
      console.log('   Cohort:', result.data.cohort?.name);
      console.log('   Percentile:', result.data.comparison?.percentile);
    }
    results.push({ tool: 'compare_to_cohort', success: result.success });
  } catch (e) {
    console.log('   ERROR:', (e as Error).message);
    results.push({ tool: 'compare_to_cohort', success: false, error: (e as Error).message });
  }
  console.log('');

  // Summary
  console.log('='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  console.log(`Passed: ${passed}/${results.length}`);
  console.log(`Failed: ${failed}/${results.length}`);
  console.log('');

  if (failed > 0) {
    console.log('Failed tests:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.tool}: ${r.error || 'Unknown error'}`);
    });
  }

  console.log('');
  console.log('='.repeat(60));
}

// Run tests
runTests().catch(console.error);
