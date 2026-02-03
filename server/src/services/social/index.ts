/**
 * Social Services Index (PRD-019)
 *
 * Exports all social mention processing services.
 */

export { mentionParser, processUpload, parseCSV } from './mentionParser.js';
export {
  socialSentimentAnalyzer,
  analyzeMentionSentiment,
  analyzeMentionsBatch,
  aggregateThemes,
  generateResponseOptions,
  identifyHighRiskMentions,
} from './sentimentAnalyzer.js';
export {
  customerMatcher,
  matchMentionToCustomer,
  matchMentionsBatch,
  confirmCustomerMatch,
  identifyAdvocates,
} from './customerMatcher.js';
