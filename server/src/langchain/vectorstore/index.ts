/**
 * Vector Store Service for RAG
 * Enables semantic search across knowledge bases, contracts, and customer data
 */

import { Document } from "@langchain/core/documents";

// In-memory vector store for MVP (replace with Supabase pgvector in production)
interface StoredDocument {
  id: string;
  content: string;
  embedding: number[];
  metadata: Record<string, unknown>;
  createdAt: Date;
}

interface SearchResult {
  document: StoredDocument;
  score: number;
}

export class VectorStoreService {
  private documents: Map<string, StoredDocument> = new Map();
  private collections: Map<string, Set<string>> = new Map();

  constructor() {
    // Initialize default collections
    this.collections.set('knowledge_base', new Set());
    this.collections.set('contracts', new Set());
    this.collections.set('playbooks', new Set());
    this.collections.set('customer_notes', new Set());

    // Seed with sample CS knowledge base
    this.seedKnowledgeBase();
  }

  /**
   * Add a document to the vector store
   */
  async addDocument(
    content: string,
    metadata: Record<string, unknown>,
    collection: string = 'knowledge_base'
  ): Promise<string> {
    const id = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Generate simple embedding (in production, use OpenAI or similar)
    const embedding = this.generateSimpleEmbedding(content);

    const doc: StoredDocument = {
      id,
      content,
      embedding,
      metadata: { ...metadata, collection },
      createdAt: new Date()
    };

    this.documents.set(id, doc);

    // Add to collection
    if (!this.collections.has(collection)) {
      this.collections.set(collection, new Set());
    }
    this.collections.get(collection)!.add(id);

    return id;
  }

  /**
   * Search for similar documents
   */
  async similaritySearch(
    query: string,
    k: number = 5,
    collection?: string,
    filter?: Record<string, unknown>
  ): Promise<SearchResult[]> {
    const queryEmbedding = this.generateSimpleEmbedding(query);

    let candidates: StoredDocument[] = [];

    if (collection) {
      const docIds = this.collections.get(collection);
      if (docIds) {
        candidates = Array.from(docIds)
          .map(id => this.documents.get(id)!)
          .filter(Boolean);
      }
    } else {
      candidates = Array.from(this.documents.values());
    }

    // Apply filters
    if (filter) {
      candidates = candidates.filter(doc => {
        return Object.entries(filter).every(([key, value]) =>
          doc.metadata[key] === value
        );
      });
    }

    // Calculate similarity scores
    const results: SearchResult[] = candidates.map(doc => ({
      document: doc,
      score: this.cosineSimilarity(queryEmbedding, doc.embedding)
    }));

    // Sort by score and return top k
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }

  /**
   * Search with keyword matching (hybrid search)
   */
  async hybridSearch(
    query: string,
    k: number = 5,
    collection?: string
  ): Promise<SearchResult[]> {
    // Get semantic results
    const semanticResults = await this.similaritySearch(query, k * 2, collection);

    // Get keyword results
    const keywords = query.toLowerCase().split(/\s+/);
    const keywordMatches = Array.from(this.documents.values())
      .filter(doc => {
        if (collection && doc.metadata.collection !== collection) return false;
        const content = doc.content.toLowerCase();
        return keywords.some(kw => content.includes(kw));
      })
      .map(doc => ({
        document: doc,
        score: keywords.filter(kw => doc.content.toLowerCase().includes(kw)).length / keywords.length
      }));

    // Combine and deduplicate
    const seen = new Set<string>();
    const combined: SearchResult[] = [];

    for (const result of [...semanticResults, ...keywordMatches]) {
      if (!seen.has(result.document.id)) {
        seen.add(result.document.id);
        combined.push(result);
      }
    }

    return combined
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }

  /**
   * Get documents by collection
   */
  async getCollection(collection: string): Promise<StoredDocument[]> {
    const docIds = this.collections.get(collection);
    if (!docIds) return [];

    return Array.from(docIds)
      .map(id => this.documents.get(id)!)
      .filter(Boolean);
  }

  /**
   * Delete a document
   */
  async deleteDocument(id: string): Promise<boolean> {
    const doc = this.documents.get(id);
    if (!doc) return false;

    this.documents.delete(id);

    const collection = doc.metadata.collection as string;
    if (collection && this.collections.has(collection)) {
      this.collections.get(collection)!.delete(id);
    }

    return true;
  }

  /**
   * Simple embedding generation (replace with real embeddings in production)
   */
  private generateSimpleEmbedding(text: string): number[] {
    // This is a simplified TF-IDF-like embedding for MVP
    // In production, use OpenAI embeddings or similar
    const words = text.toLowerCase().split(/\W+/).filter(w => w.length > 2);
    const wordFreq = new Map<string, number>();

    for (const word of words) {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    }

    // Create a fixed-size embedding based on common CS terms
    const csTerms = [
      'onboarding', 'customer', 'success', 'renewal', 'churn', 'adoption',
      'health', 'score', 'meeting', 'kickoff', 'training', 'support',
      'arr', 'revenue', 'contract', 'stakeholder', 'champion', 'executive',
      'risk', 'expansion', 'upsell', 'value', 'roi', 'implementation',
      'integration', 'api', 'feature', 'product', 'feedback', 'nps',
      'csat', 'engagement', 'usage', 'login', 'active', 'inactive',
      'escalation', 'ticket', 'issue', 'resolution', 'sla', 'qbr',
      'ebr', 'playbook', 'cadence', 'touchpoint', 'milestone', 'goal'
    ];

    return csTerms.map(term => {
      const freq = wordFreq.get(term) || 0;
      // Also check for partial matches
      const partialMatch = words.filter(w => w.includes(term) || term.includes(w)).length;
      return freq + partialMatch * 0.5;
    });
  }

  /**
   * Cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Seed the knowledge base with CS best practices
   */
  private async seedKnowledgeBase() {
    const csKnowledge = [
      {
        content: `Onboarding Best Practices:
1. Schedule kickoff call within 48 hours of contract signing
2. Identify key stakeholders and their success criteria
3. Create a 30-60-90 day plan with clear milestones
4. Set up regular check-in cadence (weekly for first month, bi-weekly after)
5. Ensure technical implementation is tracked separately from business outcomes
6. Document all decisions and share meeting notes within 24 hours
7. Identify quick wins in the first 2 weeks to build momentum`,
        metadata: { type: 'playbook', topic: 'onboarding', priority: 'high' }
      },
      {
        content: `Customer Health Score Components:
- Product Usage (30%): DAU/MAU, feature adoption, login frequency
- Engagement (25%): Meeting attendance, email response rate, NPS responses
- Support (20%): Ticket volume, resolution time, escalations
- Financial (15%): Payment history, expansion conversations
- Relationship (10%): Champion strength, executive sponsor engagement

Red flags: >20% drop in usage, no login in 14 days, missed meetings, payment delays`,
        metadata: { type: 'framework', topic: 'health_score', priority: 'high' }
      },
      {
        content: `Renewal Playbook (90-60-30 Day Cadence):
90 Days Out:
- Review account health and usage trends
- Identify any open issues or feature requests
- Schedule renewal discovery call
- Prepare value realization report

60 Days Out:
- Present ROI/value summary to stakeholders
- Discuss any pricing or package changes
- Address competitive threats
- Get verbal commitment

30 Days Out:
- Send contract for signature
- Escalate if no response within 1 week
- Prepare expansion proposal if appropriate
- Document any at-risk signals`,
        metadata: { type: 'playbook', topic: 'renewal', priority: 'high' }
      },
      {
        content: `Churn Prevention Strategies:
Early Warning Signs:
- Decreased login frequency (>30% drop)
- Key champion leaves company
- Support ticket spike
- Missed QBR or check-in meetings
- Negative NPS or CSAT feedback
- Delayed payments
- Competitor mentions in conversations

Intervention Tactics:
1. Immediate outreach within 24 hours of red flag
2. Executive sponsor engagement for high-value accounts
3. Success plan reset with new goals
4. Additional training or enablement
5. Product team escalation for feature gaps
6. Commercial flexibility (if appropriate)`,
        metadata: { type: 'playbook', topic: 'churn_prevention', priority: 'critical' }
      },
      {
        content: `Expansion and Upsell Framework:
Timing Indicators:
- High product usage (>80% of entitlement)
- Positive health score trend
- Champion advocating internally
- New use cases emerging
- Company growth signals (hiring, funding)

Approach:
1. Lead with value, not price
2. Tie expansion to customer goals
3. Involve champion as internal advocate
4. Prepare business case with ROI
5. Offer pilot for new products
6. Bundle with renewal for better terms`,
        metadata: { type: 'playbook', topic: 'expansion', priority: 'medium' }
      },
      {
        content: `QBR (Quarterly Business Review) Template:
Agenda:
1. Executive Summary (5 min)
2. Goals Review - Last Quarter (10 min)
3. Usage & Adoption Metrics (10 min)
4. ROI & Value Delivered (10 min)
5. Roadmap & Upcoming Features (10 min)
6. Goals for Next Quarter (10 min)
7. Open Discussion (15 min)

Best Practices:
- Send pre-read 48 hours before
- Include executive sponsor
- Focus on business outcomes, not features
- Have specific asks prepared
- Follow up within 24 hours with notes and action items`,
        metadata: { type: 'template', topic: 'qbr', priority: 'medium' }
      },
      {
        content: `Stakeholder Mapping Framework:
Roles to Identify:
- Economic Buyer: Approves budget, signs contracts
- Champion: Internal advocate, daily user
- Technical Owner: Manages implementation
- End Users: People using the product daily
- Detractor: May oppose renewal or expansion

For each stakeholder track:
- Name, title, contact info
- Influence level (high/medium/low)
- Sentiment (positive/neutral/negative)
- Last interaction date
- Key concerns and goals`,
        metadata: { type: 'framework', topic: 'stakeholder_management', priority: 'high' }
      },
      {
        content: `Email Templates for Common Scenarios:

Welcome Email Subject: Welcome to [Product] - Let's Get Started!
Key elements: Enthusiasm, clear next steps, CSM intro, calendar link

Check-in Email Subject: Quick Check-in - How's Everything Going?
Key elements: Specific question, offer help, suggest meeting if needed

At-Risk Outreach Subject: We'd Love to Reconnect
Key elements: Acknowledge gap, express concern, offer value, no pressure

Renewal Reminder Subject: Your Renewal is Coming Up - Let's Discuss
Key elements: Timeline, value recap, meeting request, flexibility mention`,
        metadata: { type: 'template', topic: 'email_templates', priority: 'medium' }
      }
    ];

    for (const item of csKnowledge) {
      await this.addDocument(item.content, item.metadata, 'knowledge_base');
    }

    console.log(`📚 Knowledge base seeded with ${csKnowledge.length} documents`);
  }
}

// Export singleton
export const vectorStore = new VectorStoreService();
