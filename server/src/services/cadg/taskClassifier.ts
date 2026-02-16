/**
 * Task Classifier
 * PRD: Context-Aware Agentic Document Generation (CADG)
 *
 * Classifies user queries into task types using:
 * 1. Keyword matching (fast)
 * 2. Pattern matching (medium)
 * 3. LLM classification (fallback for ambiguous queries)
 */

import {
  TaskType,
  TaskClassificationResult,
  AggregatedContext,
} from './types.js';

import Anthropic from '@anthropic-ai/sdk';
import { config } from '../../config/index.js';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: config.anthropicApiKey,
});

// ============================================================================
// Stop Words & Stemming
// Common words removed before matching to reduce noise.
// ============================================================================
const STOP_WORDS = new Set([
  'a', 'the', 'for', 'to', 'me', 'my', 'our', 'this', 'that',
  'can', 'you', 'please', 'help', 'need', 'want', 'would', 'like', 'i',
  'an', 'is', 'it', 'of', 'in', 'on', 'and', 'or', 'with', 'be', 'do',
]);

/**
 * Basic stemming: strip common English suffixes to normalize word forms.
 * e.g., "forecasting" → "forecast", "analyzed" → "analyz", "metrics" → "metric"
 */
function basicStem(word: string): string {
  if (word.length <= 3) return word;
  // Order matters: check longer suffixes first
  if (word.endsWith('tion') && word.length > 5) return word.slice(0, -4);
  if (word.endsWith('ing') && word.length > 5) return word.slice(0, -3);
  if (word.endsWith('ed') && word.length > 4) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss') && word.length > 3) return word.slice(0, -1);
  return word;
}

/**
 * Tokenize and clean a query: lowercase, split, remove stop words, stem each word.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 0 && !STOP_WORDS.has(w))
    .map(basicStem);
}

// ============================================================================
// Synonym Expansion Map
// Maps common words to their synonyms so natural language variations work.
// Applied to queries BEFORE keyword and phrase matching.
// ============================================================================
const SYNONYM_GROUPS: string[][] = [
  // Action verbs: create/build/generate/make/prepare/draft/set up/put together/design/compose
  ['create', 'build', 'generate', 'make', 'prepare', 'draft', 'set up', 'put together', 'design', 'compose', 'develop', 'produce', 'craft', 'assemble', 'construct'],
  // Plan/strategy family
  ['plan', 'strategy', 'roadmap', 'blueprint', 'playbook', 'approach', 'framework', 'outline', 'agenda', 'scheme'],
  // Review/assessment family
  ['review', 'assessment', 'evaluation', 'analysis', 'audit', 'check', 'overview', 'examination', 'inspection', 'appraisal'],
  // Meeting/call family
  ['meeting', 'call', 'session', 'sync', 'discussion', 'conversation', 'conference', 'huddle'],
  // Customer/client family
  ['customer', 'client', 'account', 'company', 'organization', 'org', 'partner'],
  // Risk/danger family
  ['risk', 'danger', 'threat', 'concern', 'issue', 'problem', 'warning', 'jeopardy', 'hazard'],
  // Renewal/contract family
  ['renewal', 'contract', 'subscription', 'license', 'agreement', 'deal'],
];

// Build reverse lookup: word → all its synonyms (excluding itself)
const SYNONYM_LOOKUP: Map<string, string[]> = new Map();
for (const group of SYNONYM_GROUPS) {
  for (const word of group) {
    SYNONYM_LOOKUP.set(word, group.filter(w => w !== word));
  }
}

/**
 * Expand a query with synonyms to improve matching.
 * Returns array of query variants: original + one variant per synonym substitution.
 */
function expandWithSynonyms(query: string): string[] {
  const expanded: string[] = [query];

  // Check multi-word synonyms first (e.g., "put together", "set up")
  const multiWordKeys = Array.from(SYNONYM_LOOKUP.keys()).filter(k => k.includes(' '));
  for (const key of multiWordKeys) {
    if (query.includes(key)) {
      const synonyms = SYNONYM_LOOKUP.get(key) || [];
      for (const syn of synonyms) {
        expanded.push(query.replace(key, syn));
      }
    }
  }

  // Check single-word synonyms
  const words = query.split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const synonyms = SYNONYM_LOOKUP.get(word);
    if (synonyms) {
      for (const syn of synonyms) {
        if (!syn.includes(' ')) {
          const newWords = [...words];
          newWords[i] = syn;
          expanded.push(newWords.join(' '));
        }
      }
    }
  }

  return expanded;
}

// ============================================================================
// Agent → Task Type Mapping (for contextual boosting)
// When an active agent is specified, its task types get a confidence boost
// if multiple results have similar scores (within 0.1).
// ============================================================================
type ActiveAgentType = 'onboarding' | 'adoption' | 'renewal' | 'risk' | 'strategic';

const AGENT_TASK_TYPES: Record<ActiveAgentType, TaskType[]> = {
  onboarding: ['kickoff_plan', 'milestone_plan', 'stakeholder_map', 'training_schedule'],
  adoption: ['usage_analysis', 'feature_campaign', 'champion_development', 'training_program'],
  renewal: ['renewal_forecast', 'value_summary', 'expansion_proposal', 'negotiation_brief'],
  risk: ['risk_assessment', 'save_play', 'escalation_report', 'resolution_plan'],
  strategic: ['qbr_generation', 'executive_briefing', 'account_plan', 'transformation_roadmap'],
};

// Keyword patterns for each task type (20+ patterns per CADG card)
const KEYWORD_PATTERNS: Record<TaskType, string[]> = {
  // ============================================================================
  // Onboarding Specialist Cards
  // ============================================================================
  kickoff_plan: [
    'kickoff plan', 'kickoff agenda', 'kickoff meeting', 'kickoff deck',
    'kickoff prep', 'kickoff call', 'kickoff presentation', 'kickoff doc',
    'build kickoff', 'create kickoff', 'prepare kickoff', 'generate kickoff',
    'new customer kickoff', 'customer kickoff', 'launch kickoff', 'project kickoff',
    'first meeting', 'welcome meeting', 'intro meeting', 'introduction meeting',
    'onboarding kickoff', 'implementation kickoff', 'start meeting', 'kick off',
    'kick-off', 'initial meeting', 'welcome call',
  ],
  milestone_plan: [
    '30-60-90', '30 60 90', '30/60/90', 'milestone plan', 'milestones',
    'first 90 days', 'first 30 days', 'first 60 days', 'onboarding timeline',
    'implementation plan', 'launch plan', 'rollout plan', 'deployment plan',
    'go live plan', 'golive plan', 'go-live', 'project timeline', 'project plan',
    'onboarding milestones', 'implementation milestones', 'phase plan', 'phased rollout',
    'success milestones', 'target milestones', 'milestone tracker', 'timeline tracker',
    '90 day plan', '90-day plan', 'ninety day', 'first three months',
  ],
  stakeholder_map: [
    'stakeholder map', 'stakeholder mapping', 'stakeholders', 'org chart',
    'organizational chart', 'org structure', 'organization chart', 'who to know',
    'key contacts', 'key stakeholders', 'decision makers', 'power map',
    'influence map', 'relationship map', 'contact map', 'people map',
    'map the org', 'map stakeholders', 'identify stakeholders', 'stakeholder analysis',
    'executive sponsors', 'champions', 'blockers', 'evaluators', 'decision tree',
    'buying committee', 'influencers', 'account contacts',
  ],
  training_schedule: [
    'training schedule', 'training plan', 'training calendar', 'training timeline',
    'training program', 'training sessions', 'schedule training', 'plan training',
    'user training', 'admin training', 'end user training', 'team training',
    'onboarding training', 'product training', 'platform training', 'system training',
    'learning path', 'learning schedule', 'education plan', 'certification path',
    'workshop schedule', 'webinar schedule', 'training dates', 'session calendar',
    'training rollout', 'enablement schedule', 'enablement plan',
  ],

  // ============================================================================
  // Adoption Specialist Cards
  // ============================================================================
  usage_analysis: [
    'usage analysis', 'usage report', 'usage metrics', 'usage data',
    'analyze usage', 'usage trends', 'usage patterns', 'usage breakdown',
    'product usage', 'feature usage', 'how are they using', 'what are they using',
    'login frequency', 'active users', 'dau', 'mau', 'wau',
    'engagement metrics', 'engagement report', 'adoption metrics', 'adoption report',
    'usage dashboard', 'activity report', 'activity analysis', 'user activity',
    'usage summary', 'utilization', 'utilization report',
  ],
  feature_campaign: [
    'feature campaign', 'feature adoption', 'drive adoption', 'increase adoption',
    'adoption campaign', 'feature rollout', 'feature launch', 'feature push',
    'promote feature', 'feature awareness', 'feature enablement', 'feature push',
    'underutilized features', 'unused features', 'low adoption', 'boost usage',
    'feature education', 'feature training', 'feature comms', 'feature communication',
    'adoption drive', 'adoption initiative', 'adoption plan', 'adoption strategy',
    'get them using', 'increase usage', 'improve adoption',
  ],
  champion_development: [
    'champion development', 'develop champions', 'build champions', 'champion program',
    'power users', 'super users', 'advocates', 'internal advocates',
    'champion training', 'champion plan', 'identify champions', 'find champions',
    'user champions', 'product champions', 'customer champions', 'champion network',
    'advocacy program', 'ambassador program', 'champion strategy', 'champion building',
    'nurture champions', 'grow champions', 'champion enablement', 'champion development plan',
    'internal promoters', 'product evangelists',
  ],
  training_program: [
    'training program', 'training curriculum', 'training course', 'training content',
    'create training', 'build training', 'develop training', 'design training',
    'learning program', 'education program', 'certification program', 'learning path',
    'training modules', 'training outline', 'course outline', 'curriculum design',
    'user education', 'customer education', 'team education', 'self-service training',
    'training materials', 'training assets', 'learning objectives', 'training plan',
    'skill building', 'competency training', 'role-based training',
  ],

  // ============================================================================
  // Renewal Specialist Cards
  // ============================================================================
  renewal_forecast: [
    'renewal forecast', 'renewal prediction', 'renewal probability', 'renewal likelihood',
    'forecast renewal', 'predict renewal', 'renewal outlook', 'renewal projections',
    'will they renew', 'renewal risk', 'renewal chance', 'renewal odds',
    'renewal analysis', 'renewal assessment', 'renewal review', 'renewal health',
    'renew or churn', 'renewal status', 'renewal confidence', 'renewal score',
    'contract renewal', 'subscription renewal', 'license renewal', 'renewal date',
    'upcoming renewal', 'pending renewal', 'renewal pipeline',
  ],
  value_summary: [
    'value summary', 'value delivered', 'value realization', 'value report',
    'roi summary', 'roi report', 'return on investment', 'business value',
    'outcomes achieved', 'success metrics', 'success summary', 'value metrics',
    'customer value', 'value statement', 'value proposition', 'value narrative',
    'impact summary', 'results summary', 'achievements', 'wins',
    'value documentation', 'quantify value', 'measure value', 'demonstrate value',
    'time saved', 'cost savings', 'efficiency gains',
  ],
  expansion_proposal: [
    'expansion proposal', 'expansion plan', 'growth proposal', 'upsell proposal',
    'upgrade proposal', 'expand account', 'grow account', 'account expansion',
    'additional seats', 'add users', 'add licenses', 'more users',
    'new modules', 'add modules', 'feature upgrade', 'tier upgrade',
    'expansion opportunity', 'upsell opportunity', 'cross-sell', 'land and expand',
    'contract expansion', 'scope expansion', 'service expansion', 'capacity expansion',
    'volume increase', 'usage increase', 'growth plan',
  ],
  negotiation_brief: [
    'negotiation brief', 'negotiation prep', 'negotiation strategy', 'negotiation plan',
    'contract negotiation', 'pricing negotiation', 'renewal negotiation', 'deal negotiation',
    'prepare negotiation', 'negotiation talking points', 'negotiation leverage',
    'price discussion', 'discount discussion', 'terms discussion', 'contract terms',
    'walk away point', 'batna', 'counter offer', 'bargaining',
    'concession strategy', 'deal terms', 'pricing strategy', 'value justification',
    'budget objections', 'price objections', 'internal brief',
  ],

  // ============================================================================
  // Risk Specialist Cards
  // ============================================================================
  risk_assessment: [
    'risk assessment', 'risk analysis', 'risk evaluation', 'risk review',
    'assess risk', 'analyze risk', 'evaluate risk', 'churn risk',
    'at risk', 'at-risk', 'risk factors', 'risk indicators',
    'warning signs', 'red flags', 'danger signs', 'risk signals',
    'health risk', 'account risk', 'customer risk', 'retention risk',
    'risk score', 'risk level', 'risk report', 'risk dashboard',
    'risk identification', 'risk detection', 'early warning',
  ],
  save_play: [
    'save play', 'save plan', 'retention play', 'retention plan',
    'save account', 'save customer', 'rescue plan', 'recovery plan',
    'prevent churn', 'stop churn', 'churn prevention', 'win back',
    'save strategy', 'intervention plan', 'remediation plan', 'action plan',
    'turn around', 'turnaround', 'course correction', 'get back on track',
    'relationship repair', 'account recovery', 'customer save', 'retention strategy',
    'save motion', 'rescue motion', 'recovery strategy',
  ],
  escalation_report: [
    'escalation report', 'escalation summary', 'escalation brief', 'escalation doc',
    'create escalation', 'write escalation', 'escalation document', 'escalation memo',
    'escalate issue', 'escalate problem', 'executive escalation', 'management escalation',
    'issue escalation', 'problem escalation', 'critical escalation', 'urgent escalation',
    'escalation email', 'escalation request', 'raise escalation', 'submit escalation',
    'escalation timeline', 'escalation history', 'escalation path', 'escalation chain',
    'executive attention', 'leadership attention',
  ],
  resolution_plan: [
    'resolution plan', 'resolution strategy', 'issue resolution', 'problem resolution',
    'fix plan', 'remediation', 'corrective action', 'action items',
    'resolve issues', 'solve problems', 'address issues', 'address concerns',
    'recovery roadmap', 'improvement plan', 'fix roadmap', 'resolution roadmap',
    'issue tracker', 'problem tracker', 'resolution tracker', 'action tracker',
    'path forward', 'way forward', 'next steps', 'corrective measures',
    'resolution timeline', 'resolution owners',
  ],

  // ============================================================================
  // Strategic CSM Cards
  // ============================================================================
  qbr_generation: [
    'qbr', 'quarterly business review', 'business review', 'executive business review',
    'create a qbr', 'build me a qbr', 'generate qbr', 'prepare qbr',
    'q1 review', 'q2 review', 'q3 review', 'q4 review', 'quarterly review',
    'executive review', 'business recap', 'quarterly recap', 'quarterly meeting',
    'quarterly presentation', 'qbr deck', 'qbr presentation', 'qbr slides',
    'strategic review', 'performance review', 'partnership review', 'account review',
    'ebr', 'mbr', 'monthly business review',
  ],
  executive_briefing: [
    'executive briefing', 'exec briefing', 'c-suite briefing', 'leadership briefing',
    'executive summary', 'exec summary', 'executive update', 'leadership update',
    'board briefing', 'board presentation', 'executive deck', 'exec deck',
    'c-level presentation', 'vp briefing', 'cxo briefing', 'senior leadership',
    'executive overview', 'strategic briefing', 'high level summary', 'brief executive',
    'prepare for executive', 'exec meeting', 'executive meeting prep',
    'ceo briefing', 'cfo briefing', 'cto briefing',
  ],
  account_plan: [
    'account plan', 'account strategy', 'strategic account plan', 'account planning',
    'create account plan', 'build account plan', 'account roadmap', 'account blueprint',
    'customer plan', 'customer strategy', 'partnership plan', 'relationship plan',
    'strategic plan', 'growth plan', 'success plan', 'joint success plan',
    'mutual action plan', 'mutual success plan', 'map', 'jap', 'joint action plan',
    'account objectives', 'account goals', 'account priorities', 'strategic objectives',
    'annual plan', 'yearly plan', 'fiscal year plan',
  ],
  transformation_roadmap: [
    'transformation roadmap', 'transformation plan', 'digital transformation', 'business transformation',
    'change roadmap', 'change management', 'transformation strategy', 'transformation journey',
    'modernization roadmap', 'evolution plan', 'maturity roadmap', 'capability roadmap',
    'long term vision', 'multi-year plan', 'strategic roadmap', 'vision roadmap',
    'future state', 'target state', 'desired state', 'end state',
    'phase approach', 'staged approach', 'transformation phases', 'transformation milestones',
    'organizational change', 'process transformation', 'technology transformation',
  ],

  // ============================================================================
  // General Mode Cards (portfolio-level, no customer required)
  // ============================================================================
  portfolio_dashboard: [
    'portfolio dashboard', 'portfolio view', 'portfolio overview', 'portfolio report',
    'my customers', 'my accounts', 'all customers', 'all accounts',
    'customer list', 'account list', 'book of business', 'customer portfolio',
    'portfolio health', 'portfolio summary', 'portfolio metrics', 'portfolio status',
    'csm dashboard', 'csm view', 'csm portfolio', 'my portfolio',
    'customer dashboard', 'account dashboard', 'overall health', 'portfolio snapshot',
    'territory view', 'territory dashboard', 'segment dashboard',
  ],
  team_metrics: [
    'team metrics', 'team performance', 'team dashboard', 'team report',
    'csm metrics', 'csm performance', 'csm kpis', 'team kpis',
    'team health', 'team stats', 'team statistics', 'team numbers',
    'compare csms', 'csm comparison', 'csm leaderboard', 'team leaderboard',
    'team summary', 'team overview', 'manager dashboard', 'manager view',
    'org metrics', 'department metrics', 'cs metrics', 'success metrics',
    'benchmark team', 'team benchmarks', 'team goals',
  ],
  renewal_pipeline: [
    'renewal pipeline', 'renewals pipeline', 'upcoming renewals', 'renewal calendar',
    'renewals this quarter', 'renewals this month', 'renewals next quarter',
    'renewal forecast', 'renewal report', 'renewal tracker', 'renewal list',
    'contracts expiring', 'expiring contracts', 'due for renewal', 'renewal due',
    'renewal schedule', 'renewal timeline', 'renewal queue', 'renewal backlog',
    'pipeline view', 'pipeline report', 'contract pipeline', 'subscription pipeline',
    'arr at risk', 'revenue at risk', 'renewal revenue',
  ],
  at_risk_overview: [
    'at risk overview', 'at-risk overview', 'risk overview', 'risk dashboard',
    'at risk customers', 'at-risk accounts', 'risky accounts', 'troubled accounts',
    'churn watch', 'churn list', 'watch list', 'concern list',
    'red accounts', 'yellow accounts', 'unhealthy customers', 'struggling customers',
    'risk list', 'risk report', 'risk summary', 'critical accounts',
    'intervention needed', 'needs attention', 'requires attention', 'action needed',
    'save opportunities', 'recovery opportunities', 'retention focus',
  ],

  // ============================================================================
  // Legacy/existing types
  // ============================================================================
  data_analysis: [
    'analyze', 'analysis', 'what are the trends',
    'show me data', 'breakdown', 'metrics report',
    'compare', 'benchmark', 'portfolio analysis',
  ],
  presentation_creation: [
    'deck', 'presentation', 'slides', 'slide deck',
    'create deck', 'build presentation',
    'powerpoint', 'pitch deck',
  ],
  document_creation: [
    'document', 'doc', 'write a', 'create a plan',
    'proposal', 'summary document',
  ],
  email_drafting: [
    'email', 'draft email', 'write email', 'compose',
    'send message', 'follow up email', 'outreach',
    'send to', 'email to', 'message to',
  ],
  meeting_prep: [
    'meeting prep', 'prepare for meeting', 'prep me',
    'before the call', 'talking points', 'agenda',
    'call prep', 'brief me', 'get me ready',
  ],
  transcription_summary: [
    'summarize meeting', 'meeting summary', 'call summary',
    'meeting notes', 'transcript', 'summarize recording',
    'action items from', 'recap of',
  ],
  health_analysis: [
    'health score', 'why is health', 'health dropping',
    'health declining', 'health improving', 'analyze health',
    'what happened to health', 'health trend',
  ],
  expansion_planning: [
    'expansion', 'upsell', 'cross-sell', 'grow',
    'increase arr', 'expansion opportunity',
    'upgrade', 'additional seats', 'new module',
  ],
  custom: [],
};

// Phrase patterns (more specific than keywords)
const PHRASE_PATTERNS: Record<TaskType, RegExp[]> = {
  // ============================================================================
  // Onboarding Specialist Cards
  // ============================================================================
  kickoff_plan: [
    /build\s+(me\s+)?(a\s+)?kickoff/i,
    /create\s+(a\s+)?kickoff/i,
    /prepare\s+(the\s+)?kickoff/i,
    /kickoff\s+(plan|agenda|meeting|deck)/i,
    /new\s+customer\s+kickoff/i,
    /welcome\s+(meeting|call)/i,
    /first\s+(meeting|call)\s+(with|for)/i,
  ],
  milestone_plan: [
    /30.?60.?90/i,
    /first\s+(30|60|90)\s+days/i,
    /(milestone|implementation|onboarding)\s+plan/i,
    /create\s+(a\s+)?(milestone|implementation)\s+plan/i,
    /go.?live\s+(plan|timeline)/i,
    /project\s+(timeline|plan)/i,
    /rollout\s+(plan|timeline)/i,
  ],
  stakeholder_map: [
    /stakeholder\s+(map|mapping)/i,
    /map\s+(the\s+)?(org|organization|stakeholders)/i,
    /org(anizational)?\s+chart/i,
    /(key|identify)\s+(contacts|stakeholders)/i,
    /who\s+(are\s+)?(the\s+)?(key\s+)?(people|contacts)/i,
    /decision\s+makers/i,
    /power\s+map/i,
  ],
  training_schedule: [
    /training\s+(schedule|calendar|plan|timeline)/i,
    /schedule\s+(the\s+)?training/i,
    /plan\s+(the\s+)?training/i,
    /(user|admin|team)\s+training/i,
    /learning\s+(path|schedule)/i,
    /workshop\s+schedule/i,
    /enablement\s+(schedule|plan)/i,
  ],

  // ============================================================================
  // Adoption Specialist Cards
  // ============================================================================
  usage_analysis: [
    /usage\s+(analysis|report|metrics)/i,
    /analyz[e|ing]\s+(the\s+)?usage/i,
    /how\s+(are\s+)?they\s+using/i,
    /(active\s+users|dau|mau)/i,
    /engagement\s+(metrics|report)/i,
    /adoption\s+(metrics|report)/i,
    /product\s+usage/i,
  ],
  feature_campaign: [
    /feature\s+(campaign|adoption|rollout)/i,
    /(drive|increase|boost)\s+(feature\s+)?adoption/i,
    /adoption\s+(campaign|initiative|drive)/i,
    /(underutilized|unused|low\s+adoption)\s+features/i,
    /promote\s+(a\s+)?feature/i,
    /get\s+them\s+using/i,
  ],
  champion_development: [
    /champion\s+(development|program|plan)/i,
    /(develop|build|identify)\s+champions/i,
    /(power|super)\s+users/i,
    /advocacy\s+program/i,
    /ambassador\s+program/i,
    /internal\s+(advocates|promoters)/i,
  ],
  training_program: [
    /training\s+(program|curriculum|course)/i,
    /create\s+(a\s+)?training\s+(program|course)/i,
    /learning\s+(program|path)/i,
    /certification\s+program/i,
    /training\s+modules/i,
    /curriculum\s+design/i,
  ],

  // ============================================================================
  // Renewal Specialist Cards
  // ============================================================================
  renewal_forecast: [
    /renewal\s+(forecast|prediction|probability)/i,
    /forecast\s+(the\s+)?renewal/i,
    /will\s+they\s+renew/i,
    /renewal\s+(risk|chance|odds)/i,
    /predict\s+(the\s+)?renewal/i,
    /(renew\s+or\s+churn|renewal\s+likelihood)/i,
  ],
  value_summary: [
    /value\s+(summary|delivered|realization)/i,
    /roi\s+(summary|report)/i,
    /(outcomes|results)\s+achieved/i,
    /success\s+(metrics|summary)/i,
    /(quantify|demonstrate|measure)\s+value/i,
    /(time|cost)\s+(saved|savings)/i,
  ],
  expansion_proposal: [
    /expansion\s+(proposal|plan|opportunity)/i,
    /(upsell|upgrade)\s+proposal/i,
    /(expand|grow)\s+(the\s+)?account/i,
    /add(itional)?\s+(seats|users|licenses)/i,
    /(land\s+and\s+expand|cross.?sell)/i,
    /(new|add)\s+modules/i,
  ],
  negotiation_brief: [
    /negotiation\s+(brief|prep|strategy)/i,
    /(contract|pricing|renewal)\s+negotiation/i,
    /prepare\s+(for\s+)?negotiation/i,
    /(price|discount|terms)\s+discussion/i,
    /walk\s*away\s+point/i,
    /counter\s+offer/i,
  ],

  // ============================================================================
  // Risk Specialist Cards
  // ============================================================================
  risk_assessment: [
    /risk\s+(assessment|analysis|evaluation)/i,
    /assess\s+(the\s+)?risk/i,
    /churn\s+risk/i,
    /at.?risk\s+(customer|account|assessment|evaluation|analysis)/i,
    /(warning|danger)\s+signs/i,
    /red\s+flags/i,
    /risk\s+(factors|indicators|signals)/i,
  ],
  save_play: [
    /save\s+(play|plan|strategy)/i,
    /retention\s+(play|plan|strategy)/i,
    /(save|rescue)\s+(the\s+)?(account|customer)/i,
    /(prevent|stop)\s+churn/i,
    /churn\s+prevention/i,
    /(turn\s*around|recovery)\s+plan/i,
    /get\s+back\s+on\s+track/i,
  ],
  escalation_report: [
    /escalation\s+(report|summary|brief)/i,
    /(create|write)\s+(an?\s+)?escalation/i,
    /(escalate|raise)\s+(this\s+)?(issue|problem)/i,
    /(executive|management)\s+escalation/i,
    /urgent\s+escalation/i,
    /escalation\s+(timeline|path)/i,
  ],
  resolution_plan: [
    /resolution\s+(plan|strategy|roadmap)/i,
    /(issue|problem)\s+resolution/i,
    /(fix|remediation)\s+plan/i,
    /corrective\s+action/i,
    /(resolve|address)\s+(the\s+)?(issues|problems|concerns)/i,
    /(path|way)\s+forward/i,
  ],

  // ============================================================================
  // Strategic CSM Cards
  // ============================================================================
  qbr_generation: [
    /build\s+(me\s+)?a?\s*qbr/i,
    /create\s+(a\s+)?qbr/i,
    /generate\s+(a\s+)?q(br|uarterly)/i,
    /prepare\s+(the\s+)?qbr/i,
    /q[1-4]\s+(business\s+)?review/i,
    /quarterly\s+(business\s+)?review/i,
  ],
  executive_briefing: [
    /(executive|exec|c.?suite|leadership)\s+briefing/i,
    /(executive|exec)\s+(summary|update)/i,
    /(board|executive)\s+(presentation|deck)/i,
    /c.?level\s+presentation/i,
    /brief\s+(the\s+)?executive/i,
    /(ceo|cfo|cto|vp)\s+briefing/i,
  ],
  account_plan: [
    /(account|strategic\s+account)\s+plan/i,
    /create\s+(an?\s+)?account\s+plan/i,
    /(customer|partnership|relationship)\s+plan/i,
    /(mutual\s+)?(action|success)\s+plan/i,
    /joint\s+(action|success)\s+plan/i,
    /strategic\s+(plan|objectives)/i,
  ],
  transformation_roadmap: [
    /transformation\s+(roadmap|plan|strategy)/i,
    /(digital|business)\s+transformation/i,
    /change\s+(roadmap|management)/i,
    /modernization\s+roadmap/i,
    /(maturity|capability)\s+roadmap/i,
    /long\s+term\s+vision/i,
    /(future|target|desired)\s+state/i,
  ],

  // ============================================================================
  // General Mode Cards
  // ============================================================================
  portfolio_dashboard: [
    /portfolio\s+(dashboard|view|overview)/i,
    /(my|all)\s+(customers|accounts)/i,
    /book\s+of\s+business/i,
    /customer\s+portfolio/i,
    /(csm|territory)\s+dashboard/i,
    /portfolio\s+(health|summary|metrics)/i,
  ],
  team_metrics: [
    /team\s+(metrics|performance|dashboard)/i,
    /csm\s+(metrics|performance|kpis)/i,
    /(compare|csm)\s+csms/i,
    /team\s+(leaderboard|stats)/i,
    /manager\s+(dashboard|view)/i,
    /(org|department|cs)\s+metrics/i,
  ],
  renewal_pipeline: [
    /renewal(s)?\s+pipeline/i,
    /upcoming\s+renewals/i,
    /renewals\s+this\s+(quarter|month)/i,
    /contracts?\s+expiring/i,
    /due\s+for\s+renewal/i,
    /(arr|revenue)\s+at\s+risk/i,
  ],
  at_risk_overview: [
    /at.?risk\s+(overview|dashboard|customers|accounts)/i,
    /risk\s+(overview|dashboard)/i,
    /(churn|watch)\s+list/i,
    /(red|yellow|unhealthy)\s+(accounts|customers)/i,
    /(critical|troubled)\s+accounts/i,
    /(needs|requires)\s+attention/i,
  ],

  // ============================================================================
  // Legacy/existing types
  // ============================================================================
  data_analysis: [
    /analyz[e|ing]\s+(the\s+)?(data|metrics|trends)/i,
    /show\s+me\s+(the\s+)?data/i,
    /what\s+(are\s+)?(the\s+)?trends/i,
    /break\s*down\s+(the\s+)?/i,
  ],
  presentation_creation: [
    /create\s+(a\s+)?(deck|presentation|slides)/i,
    /build\s+(me\s+)?(a\s+)?(deck|presentation)/i,
  ],
  document_creation: [
    /create\s+(a\s+)?(plan|document|proposal)/i,
    /write\s+(a\s+)?(plan|document)/i,
  ],
  email_drafting: [
    /draft\s+(an?\s+)?email/i,
    /write\s+(an?\s+)?email/i,
    /send\s+(an?\s+)?(email|message)\s+to/i,
    /compose\s+(an?\s+)?/i,
  ],
  meeting_prep: [
    /prep\s+(me\s+)?for\s+(the\s+)?/i,
    /prepare\s+(me\s+)?for\s+(the\s+)?/i,
    /get\s+me\s+ready\s+for/i,
    /brief\s+me\s+(on|for)/i,
    /meeting\s+prep/i,
  ],
  transcription_summary: [
    /summariz[e|ing]\s+(the\s+)?(meeting|call|recording)/i,
    /meeting\s+(notes|summary)/i,
    /action\s+items\s+from/i,
  ],
  health_analysis: [
    /why\s+is\s+(the\s+)?health/i,
    /(health|score)\s+(is\s+)?(dropping|declining|falling)/i,
    /analyz[e|ing]\s+(the\s+)?health/i,
    /what\s+happened\s+to\s+(the\s+)?health/i,
  ],
  expansion_planning: [
    /expansion\s+(opportunity|plan|strategy)/i,
    /(upsell|cross.?sell)\s+(opportunity|strategy)/i,
    /grow\s+(the\s+)?account/i,
  ],
  custom: [],
};

/**
 * Apply contextual agent boosting to keyword match results.
 * When an activeAgent is provided, boosts confidence of that agent's task types
 * by +0.15, but only when multiple task types have similar scores (within 0.1).
 */
function applyAgentBoosting(
  keywordResult: { taskType: TaskType; confidence: number },
  allScores: Map<TaskType, number>,
  activeAgent?: ActiveAgentType
): { taskType: TaskType; confidence: number } {
  if (!activeAgent || !(activeAgent in AGENT_TASK_TYPES)) return keywordResult;

  const agentTaskTypes = AGENT_TASK_TYPES[activeAgent];
  const bestScore = keywordResult.confidence;

  // Check if any of the active agent's task types have similar scores (within 0.1)
  let bestBoostedType: TaskType | null = null;
  let bestBoostedScore = 0;

  for (const taskType of agentTaskTypes) {
    const rawScore = allScores.get(taskType) || 0;
    if (rawScore <= 0) continue;

    // Convert raw score to confidence (same formula as matchKeywords)
    const confidence = Math.min(0.9, rawScore + 0.3);

    // Only boost if within 0.1 of the best match
    if (bestScore - confidence <= 0.1) {
      const boosted = Math.min(0.95, confidence + 0.15);
      if (boosted > bestBoostedScore) {
        bestBoostedScore = boosted;
        bestBoostedType = taskType;
      }
    }
  }

  // If boosted score beats the original best, use the boosted result
  if (bestBoostedType && bestBoostedScore > bestScore) {
    return { taskType: bestBoostedType, confidence: bestBoostedScore };
  }

  return keywordResult;
}

/**
 * Classifies a user query into a task type.
 * Optionally accepts activeAgent for contextual boosting of ambiguous matches.
 */
export async function classify(
  userQuery: string,
  context?: Partial<AggregatedContext>,
  activeAgent?: ActiveAgentType
): Promise<TaskClassificationResult> {
  const normalizedQuery = userQuery.toLowerCase().trim();

  // Step 0: Expand query with synonyms for better matching
  const expandedQueries = expandWithSynonyms(normalizedQuery);

  // Step 1: Try phrase pattern matching (highest confidence)
  // Check original query first, then expanded variants
  const phraseMatch = matchPhrasePatterns(normalizedQuery, expandedQueries);
  if (phraseMatch.taskType !== 'custom') {
    return {
      taskType: phraseMatch.taskType,
      confidence: phraseMatch.confidence,
      suggestedMethodology: getMethodologyForTask(phraseMatch.taskType),
      requiredSources: getRequiredSources(phraseMatch.taskType),
    };
  }

  // Step 2: Try keyword matching with synonym-expanded queries (medium confidence)
  const { best: keywordMatch, allScores } = matchKeywordsWithScores(normalizedQuery, expandedQueries);

  // Apply agent boosting if an active agent is specified
  const boostedMatch = applyAgentBoosting(keywordMatch, allScores, activeAgent);

  if (boostedMatch.taskType !== 'custom' && boostedMatch.confidence >= 0.7) {
    return {
      taskType: boostedMatch.taskType,
      confidence: boostedMatch.confidence,
      suggestedMethodology: getMethodologyForTask(boostedMatch.taskType),
      requiredSources: getRequiredSources(boostedMatch.taskType),
    };
  }

  // Step 3: Fall back to LLM classification (for ambiguous or low-confidence queries)
  if (boostedMatch.confidence < 0.3) {
    // Low confidence: rely entirely on LLM, fall back to keyword match if LLM fails
    const llmResult = await classifyWithLLM(userQuery);
    if (llmResult.taskType !== 'custom' || boostedMatch.taskType === 'custom') {
      return llmResult;
    }
    // LLM returned custom but we had a keyword match - use keyword match as fallback
    return {
      taskType: boostedMatch.taskType,
      confidence: boostedMatch.confidence,
      suggestedMethodology: getMethodologyForTask(boostedMatch.taskType),
      requiredSources: getRequiredSources(boostedMatch.taskType),
    };
  }

  // Step 4: Secondary LLM check for medium-confidence zone (0.3-0.7)
  // Keyword match exists but isn't strong - use LLM to confirm or override
  const llmResult = await classifyWithLLM(userQuery);
  if (llmResult.taskType !== 'custom' && llmResult.confidence > boostedMatch.confidence) {
    return llmResult;
  }

  // LLM didn't improve on keyword match - use keyword result as fallback
  return {
    taskType: boostedMatch.taskType,
    confidence: boostedMatch.confidence,
    suggestedMethodology: getMethodologyForTask(boostedMatch.taskType),
    requiredSources: getRequiredSources(boostedMatch.taskType),
  };
}

/**
 * Check if a query is a generative request (vs a simple question).
 * Only matches explicit generative/imperative verbs that indicate the user
 * wants CADG to produce a document, plan, or artifact.
 * Conversational queries ("What should I focus on?") should NOT match.
 */
export function isGenerativeRequest(userQuery: string): boolean {
  const generativeIndicators = [
    // Explicit generative verbs at the start of the query
    /^(create|build|generate|make|write|draft|prepare|compose|design|develop|produce|craft|construct)\b/i,
    // Generative verbs with an object (anywhere in query)
    /(create|build|generate|write|draft|prepare|compose|design|develop|produce|craft)\s+(a|an|the|me)\b/i,
    // "put together" / "set up" with an object
    /(put together|set up)\s+(a|an|the|me)\b/i,
  ];

  return generativeIndicators.some(pattern => pattern.test(userQuery));
}

/**
 * Match against phrase patterns.
 * First pass: check original query against ALL task types (prevents synonym false positives).
 * Second pass: check synonym-expanded variants if no original match found.
 */
function matchPhrasePatterns(query: string, expandedQueries?: string[]): { taskType: TaskType; confidence: number } {
  // First pass: check the ORIGINAL query against all task types
  for (const [taskType, patterns] of Object.entries(PHRASE_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(query)) {
        return {
          taskType: taskType as TaskType,
          confidence: 0.95,
        };
      }
    }
  }

  // Second pass: check synonym-expanded variants (skip original, already checked)
  if (expandedQueries && expandedQueries.length > 1) {
    const expandedOnly = expandedQueries.slice(1); // Skip index 0 (original query)
    for (const [taskType, patterns] of Object.entries(PHRASE_PATTERNS)) {
      for (const pattern of patterns) {
        const matched = expandedOnly.some(q => pattern.test(q));
        if (matched) {
          return {
            taskType: taskType as TaskType,
            confidence: 0.95,
          };
        }
      }
    }
  }

  return { taskType: 'custom', confidence: 0 };
}

/**
 * Match against keywords with synonym expansion and fuzzy word-level matching.
 * Returns the best match and all raw scores for agent boosting.
 */
function matchKeywordsWithScores(query: string, expandedQueries?: string[]): {
  best: { taskType: TaskType; confidence: number };
  allScores: Map<TaskType, number>;
} {
  const queries = expandedQueries || [query];
  const contentWords = query.split(/\s+/).filter(w => !STOP_WORDS.has(w));

  // Tokenize all query variants (stemmed, stop words removed)
  const tokenizedQueries = queries.map(q => tokenize(q));

  let bestMatch: { taskType: TaskType; score: number } = { taskType: 'custom', score: 0 };
  const allScores = new Map<TaskType, number>();

  for (const [taskType, keywords] of Object.entries(KEYWORD_PATTERNS)) {
    if (taskType === 'custom') continue;

    let matchScore = 0;
    for (const keyword of keywords) {
      const lowerKeyword = keyword.toLowerCase();

      // First: try exact substring match against expanded queries (highest value)
      const exactMatch = queries.some(q => q.includes(lowerKeyword));
      if (exactMatch) {
        const wordCount = keyword.split(' ').length;
        matchScore += wordCount * 1.5; // Multi-word exact matches score highest
        continue;
      }

      // Second: try stemmed word-level match
      const keywordTokens = tokenize(lowerKeyword);
      if (keywordTokens.length === 0) continue;

      // Check if all stemmed keyword tokens appear in any tokenized query variant
      const stemMatch = tokenizedQueries.some(queryTokens =>
        keywordTokens.every(kt => queryTokens.some(qt => qt === kt || qt.startsWith(kt) || kt.startsWith(qt)))
      );

      if (stemMatch) {
        matchScore += keywordTokens.length; // Multi-word stem matches still score more
      }
    }

    const score = matchScore / Math.max(contentWords.length, 3); // Normalize by query content length
    allScores.set(taskType as TaskType, score);

    if (score > bestMatch.score) {
      bestMatch = { taskType: taskType as TaskType, score };
    }
  }

  return {
    best: {
      taskType: bestMatch.taskType,
      confidence: Math.min(0.9, bestMatch.score + 0.3), // Cap at 0.9 for keyword matches
    },
    allScores,
  };
}

/**
 * Match against keywords with synonym expansion and fuzzy word-level matching.
 * Uses tokenization (stop word removal + stemming) for individual word matching.
 * Multi-word keyword matches still score higher than single-word matches.
 */
function matchKeywords(query: string, expandedQueries?: string[]): { taskType: TaskType; confidence: number } {
  return matchKeywordsWithScores(query, expandedQueries).best;
}

/**
 * Use LLM to classify ambiguous queries
 */
async function classifyWithLLM(userQuery: string): Promise<TaskClassificationResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: `Classify this user query into exactly ONE task type. Reply with ONLY the task type and confidence (0-1).

Task types:
ONBOARDING:
- kickoff_plan: Creating kickoff meeting plans, agendas, decks
- milestone_plan: Creating 30-60-90 day plans, implementation timelines
- stakeholder_map: Mapping stakeholders, org charts, key contacts
- training_schedule: Scheduling training sessions, calendars

ADOPTION:
- usage_analysis: Analyzing product usage, engagement metrics, DAU/MAU
- feature_campaign: Creating feature adoption campaigns, rollout plans
- champion_development: Identifying and developing power users/champions
- training_program: Creating training curricula, learning programs

RENEWAL:
- renewal_forecast: Forecasting renewal probability, risk factors
- value_summary: Summarizing value delivered, ROI, outcomes
- expansion_proposal: Creating expansion/upsell proposals
- negotiation_brief: Preparing for contract/pricing negotiations

RISK:
- risk_assessment: Assessing churn risk, warning signs
- save_play: Creating save/retention plays for at-risk accounts
- escalation_report: Creating escalation reports for leadership
- resolution_plan: Creating issue resolution plans, action items

STRATEGIC:
- qbr_generation: Creating quarterly business reviews
- executive_briefing: Creating executive/C-suite briefings
- account_plan: Creating strategic account plans
- transformation_roadmap: Creating transformation/change roadmaps

GENERAL (no customer required):
- portfolio_dashboard: Creating portfolio dashboards, book of business views
- team_metrics: Creating team/CSM performance reports
- renewal_pipeline: Creating renewal pipeline reports
- at_risk_overview: Creating at-risk customer overviews

LEGACY:
- data_analysis: General data analysis
- presentation_creation: General presentations
- document_creation: General documents
- email_drafting: Writing emails
- meeting_prep: Preparing for meetings
- transcription_summary: Summarizing recordings
- health_analysis: Analyzing health scores
- expansion_planning: General expansion planning
- custom: Doesn't fit any category

Query: "${userQuery}"

Reply format: task_type|confidence
Example: kickoff_plan|0.85`
      }],
    }, { signal: controller.signal });

    clearTimeout(timeout);

    const response = (message.content[0] as { type: 'text'; text: string }).text.trim();
    const [taskType, confidenceStr] = response.split('|');

    const validTaskTypes: TaskType[] = [
      // Onboarding
      'kickoff_plan', 'milestone_plan', 'stakeholder_map', 'training_schedule',
      // Adoption
      'usage_analysis', 'feature_campaign', 'champion_development', 'training_program',
      // Renewal
      'renewal_forecast', 'value_summary', 'expansion_proposal', 'negotiation_brief',
      // Risk
      'risk_assessment', 'save_play', 'escalation_report', 'resolution_plan',
      // Strategic
      'qbr_generation', 'executive_briefing', 'account_plan', 'transformation_roadmap',
      // General Mode
      'portfolio_dashboard', 'team_metrics', 'renewal_pipeline', 'at_risk_overview',
      // Legacy
      'data_analysis', 'presentation_creation', 'document_creation',
      'email_drafting', 'meeting_prep', 'transcription_summary',
      'health_analysis', 'expansion_planning', 'custom'
    ];

    const normalizedType = taskType.trim().toLowerCase() as TaskType;
    const confidence = parseFloat(confidenceStr) || 0.5;

    if (validTaskTypes.includes(normalizedType)) {
      return {
        taskType: normalizedType,
        confidence,
        suggestedMethodology: getMethodologyForTask(normalizedType),
        requiredSources: getRequiredSources(normalizedType),
      };
    }
  } catch (error) {
    console.error('[taskClassifier] LLM classification error:', error);
  }

  // Default fallback
  return {
    taskType: 'custom',
    confidence: 0.3,
    suggestedMethodology: null,
    requiredSources: ['knowledge_base'],
  };
}

/**
 * Get the suggested methodology for a task type
 */
function getMethodologyForTask(taskType: TaskType): string | null {
  const methodologies: Record<TaskType, string | null> = {
    // Onboarding Specialist Cards
    kickoff_plan: 'kickoff_methodology',
    milestone_plan: 'milestone_methodology',
    stakeholder_map: 'stakeholder_methodology',
    training_schedule: 'training_schedule_methodology',
    // Adoption Specialist Cards
    usage_analysis: 'usage_analysis_methodology',
    feature_campaign: 'feature_campaign_methodology',
    champion_development: 'champion_methodology',
    training_program: 'training_program_methodology',
    // Renewal Specialist Cards
    renewal_forecast: 'renewal_forecast_methodology',
    value_summary: 'value_summary_methodology',
    expansion_proposal: 'expansion_proposal_methodology',
    negotiation_brief: 'negotiation_methodology',
    // Risk Specialist Cards
    risk_assessment: 'risk_assessment_methodology',
    save_play: 'save_play_methodology',
    escalation_report: 'escalation_methodology',
    resolution_plan: 'resolution_methodology',
    // Strategic CSM Cards
    qbr_generation: 'qbr_methodology',
    executive_briefing: 'executive_briefing_methodology',
    account_plan: 'account_plan_methodology',
    transformation_roadmap: 'transformation_methodology',
    // General Mode Cards
    portfolio_dashboard: 'portfolio_methodology',
    team_metrics: 'team_metrics_methodology',
    renewal_pipeline: 'renewal_pipeline_methodology',
    at_risk_overview: 'at_risk_methodology',
    // Legacy types
    data_analysis: 'data_analysis_methodology',
    presentation_creation: 'presentation_methodology',
    document_creation: 'document_creation_methodology',
    email_drafting: 'email_drafting_methodology',
    meeting_prep: 'meeting_prep_methodology',
    transcription_summary: 'summary_methodology',
    health_analysis: 'health_analysis_methodology',
    expansion_planning: 'expansion_methodology',
    custom: null,
  };
  return methodologies[taskType];
}

/**
 * Get required data sources for a task type
 */
function getRequiredSources(taskType: TaskType): string[] {
  const sources: Record<TaskType, string[]> = {
    // Onboarding Specialist Cards
    kickoff_plan: ['customer_360', 'stakeholders', 'contract_terms', 'onboarding_playbook', 'knowledge_base'],
    milestone_plan: ['customer_360', 'customer_goals', 'product_complexity', 'benchmarks', 'knowledge_base'],
    stakeholder_map: ['customer_360', 'crm_contacts', 'meeting_attendees', 'email_engagement', 'knowledge_base'],
    training_schedule: ['customer_360', 'user_roles', 'feature_list', 'availability_windows', 'learning_paths'],
    // Adoption Specialist Cards
    usage_analysis: ['customer_360', 'usage_metrics', 'feature_adoption', 'login_frequency', 'power_users'],
    feature_campaign: ['customer_360', 'low_adoption_features', 'user_segments', 'success_stories', 'best_practices'],
    champion_development: ['customer_360', 'power_users', 'engagement_scores', 'nps_promoters', 'training_completion'],
    training_program: ['customer_360', 'feature_gaps', 'user_roles', 'learning_styles', 'available_content'],
    // Renewal Specialist Cards
    renewal_forecast: ['customer_360', 'health_trends', 'engagement_metrics', 'risk_signals', 'historical_patterns'],
    value_summary: ['customer_360', 'roi_metrics', 'success_outcomes', 'time_cost_savings', 'customer_quotes'],
    expansion_proposal: ['customer_360', 'usage_gaps', 'growth_signals', 'product_roadmap', 'pricing_tiers'],
    negotiation_brief: ['customer_360', 'contract_history', 'competitor_intel', 'value_delivered', 'market_pricing'],
    // Risk Specialist Cards
    risk_assessment: ['customer_360', 'health_signals', 'engagement_drops', 'support_tickets', 'nps_scores'],
    save_play: ['customer_360', 'risk_factors', 'playbook_templates', 'similar_saves', 'available_resources'],
    escalation_report: ['customer_360', 'issue_timeline', 'stakeholders_involved', 'previous_attempts', 'business_impact'],
    resolution_plan: ['customer_360', 'open_issues', 'dependencies', 'resources', 'timeline_constraints'],
    // Strategic CSM Cards
    qbr_generation: ['knowledge_base', 'customer_360', 'health_trends', 'engagement_metrics', 'drive_previous_qbrs'],
    executive_briefing: ['customer_360', 'key_metrics', 'strategic_goals', 'risk_summary', 'asks_requests'],
    account_plan: ['customer_360', 'customer_goals', 'product_roadmap', 'success_metrics', 'resource_allocation'],
    transformation_roadmap: ['customer_360', 'current_state', 'target_state', 'milestones', 'dependencies'],
    // General Mode Cards (portfolio-level, uses userId)
    portfolio_dashboard: ['all_customers', 'health_scores', 'arr_totals', 'renewal_dates'],
    team_metrics: ['all_csms', 'customer_assignments', 'health_scores', 'activities'],
    renewal_pipeline: ['renewal_dates', 'health_scores', 'arr_values', 'risk_levels'],
    at_risk_overview: ['risk_scores', 'health_trends', 'save_plays', 'owners'],
    // Legacy types
    data_analysis: ['customer_360', 'health_trends', 'engagement_metrics', 'knowledge_base'],
    presentation_creation: ['knowledge_base', 'customer_360', 'drive_templates'],
    document_creation: ['knowledge_base', 'customer_360', 'drive_templates'],
    email_drafting: ['knowledge_base', 'customer_360', 'customer_history', 'gmail_threads'],
    meeting_prep: ['customer_360', 'customer_history', 'risk_signals', 'knowledge_base', 'calendar_events'],
    transcription_summary: ['knowledge_base'],
    health_analysis: ['customer_360', 'health_trends', 'engagement_metrics', 'risk_signals'],
    expansion_planning: ['customer_360', 'engagement_metrics', 'knowledge_base', 'customer_history'],
    custom: ['knowledge_base', 'customer_360'],
  };
  return sources[taskType];
}

export type { ActiveAgentType };

export const taskClassifier = {
  classify,
  isGenerativeRequest,
};
