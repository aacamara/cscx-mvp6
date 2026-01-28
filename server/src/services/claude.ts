import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config/index.js';
import { StreamResult, StreamCallback } from './gemini.js';

/**
 * Robust JSON extraction and parsing from LLM responses
 */
function extractAndParseJSON(text: string): any {
  let jsonString = text.trim();

  // Remove markdown code blocks
  if (jsonString.startsWith('```json')) {
    jsonString = jsonString.substring(7);
  } else if (jsonString.startsWith('```')) {
    jsonString = jsonString.substring(3);
  }
  if (jsonString.endsWith('```')) {
    jsonString = jsonString.slice(0, -3);
  }

  jsonString = jsonString.trim();

  // Try to find JSON object or array in the response
  const jsonMatch = jsonString.match(/[\[{][\s\S]*[\]}]/);
  if (jsonMatch) {
    jsonString = jsonMatch[0];
  }

  // Fix common JSON issues from LLMs
  // Replace smart/curly quotes with regular quotes (Gemini often outputs these)
  jsonString = jsonString.replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"');
  jsonString = jsonString.replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'");

  // Fix possessive forms that got mangled (e.g., Corporation"s -> Corporation's)
  jsonString = jsonString.replace(/"s\b/g, "'s");

  // Replace remaining single quotes with double quotes for JSON compatibility
  jsonString = jsonString.replace(/'/g, '"');

  // Remove trailing commas before } or ]
  jsonString = jsonString.replace(/,\s*([\]}])/g, '$1');

  // Fix unquoted property names (simple cases)
  jsonString = jsonString.replace(/(\{|\,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');

  // Fix newlines inside string values by escaping them
  // This regex finds strings and escapes unescaped newlines within them
  jsonString = jsonString.replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/g, (match) => {
    return match.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
  });

  // Remove control characters that break JSON
  jsonString = jsonString.replace(/[\x00-\x1F\x7F]/g, (char) => {
    if (char === '\n' || char === '\r' || char === '\t') return char;
    return '';
  });

  // Try to parse
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    // Second attempt: try to use a more lenient approach
    try {
      // Remove all newlines and multiple spaces
      const compactJson = jsonString
        .replace(/\n/g, ' ')
        .replace(/\r/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      return JSON.parse(compactJson);
    } catch (e2) {
      console.error('JSON parse failed, raw response:', jsonString.substring(0, 500));
      throw e;
    }
  }
}

// Contract extraction types
export interface ContractExtraction {
  company_name: string;
  arr: number;
  contract_period: string;
  entitlements: Array<{
    type: string;
    description: string;
    quantity: string;
    start_date: string;
    end_date: string;
    dependencies: string;
  }>;
  stakeholders: Array<{
    name: string;
    role: string;
    department: string;
    contact: string;
    responsibilities: string;
    approval_required: boolean;
  }>;
  technical_requirements: Array<{
    requirement: string;
    type: string;
    priority: 'High' | 'Medium' | 'Low';
    owner: string;
    status: string;
    due_date: string;
  }>;
  contract_tasks: Array<{
    task: string;
    description: string;
    assigned_agent: string;
    priority: 'High' | 'Medium' | 'Low';
    dependencies: string;
    due_date: string;
  }>;
  pricing_terms: Array<{
    item: string;
    description: string;
    quantity: string;
    unit_price: string;
    total: string;
    payment_terms: string;
  }>;
  missing_info: string[];
  next_steps: string;
  confidence_scores?: Record<string, number>;
}

export interface CompanyResearch {
  company_name: string;
  domain: string;
  industry: string;
  employee_count: number;
  tech_stack: string[];
  recent_news: string[];
  key_initiatives: string[];
  competitors: string[];
  overview: string;
}

export interface OnboardingPlan {
  timeline_days: number;
  phases: Array<{
    name: string;
    description: string;
    tasks: Array<{
      title: string;
      description: string;
      owner: 'CSM' | 'AE' | 'SA' | 'Customer';
      due_days: number;
      success_criteria: string;
    }>;
    success_metrics: string[];
  }>;
  risk_factors: string[];
  opportunities: string[];
  recommended_touchpoints: string[];
}

export class ClaudeService {
  private client: Anthropic;
  private defaultModel: string = 'claude-sonnet-4-20250514';
  private complexModel: string = 'claude-opus-4-5-20251101';

  constructor() {
    this.client = new Anthropic({
      apiKey: config.anthropicApiKey
    });
  }

  async generate(prompt: string, systemPrompt?: string, useComplexModel: boolean = false): Promise<string> {
    try {
      const model = useComplexModel ? this.complexModel : this.defaultModel;

      const message = await this.client.messages.create({
        model,
        max_tokens: 8192,
        system: systemPrompt || 'You are a helpful AI assistant.',
        messages: [
          { role: 'user', content: prompt }
        ]
      });

      const textBlock = message.content.find(block => block.type === 'text');
      return textBlock?.type === 'text' ? textBlock.text : '';
    } catch (error) {
      console.error('Claude API Error:', error);

      // Fallback to Gemini if Claude fails (e.g., no credits)
      console.log('⚠️  Claude failed, falling back to Gemini...');
      try {
        const { GeminiService } = await import('./gemini.js');
        const gemini = new GeminiService();
        return await gemini.generate(prompt, systemPrompt);
      } catch (geminiError) {
        console.error('Gemini fallback also failed:', geminiError);
        throw new Error('Failed to generate response from AI');
      }
    }
  }

  // JSON-specific generation that uses Gemini JSON mode as fallback
  async generateForJSON(prompt: string, systemPrompt?: string): Promise<string> {
    try {
      const message = await this.client.messages.create({
        model: this.defaultModel,
        max_tokens: 8192,
        system: systemPrompt || 'You are a helpful AI assistant. Return valid JSON only.',
        messages: [
          { role: 'user', content: prompt }
        ]
      });

      const textBlock = message.content.find(block => block.type === 'text');
      return textBlock?.type === 'text' ? textBlock.text : '';
    } catch (error) {
      console.error('Claude API Error (JSON):', error);
      // Throw to let caller use Gemini JSON mode
      throw error;
    }
  }

  async generateWithHistory(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    systemPrompt?: string
  ): Promise<string> {
    try {
      const response = await this.client.messages.create({
        model: this.defaultModel,
        max_tokens: 8192,
        system: systemPrompt || 'You are a helpful AI assistant.',
        messages: messages.map(m => ({
          role: m.role,
          content: m.content
        }))
      });

      const textBlock = response.content.find(block => block.type === 'text');
      return textBlock?.type === 'text' ? textBlock.text : '';
    } catch (error) {
      console.error('Claude Chat Error:', error);

      // Fallback to Gemini
      console.log('⚠️  Claude chat failed, falling back to Gemini...');
      try {
        const { GeminiService } = await import('./gemini.js');
        const gemini = new GeminiService();
        // Combine messages into a single prompt for Gemini
        const combinedPrompt = messages.map(m => `${m.role}: ${m.content}`).join('\n\n');
        return await gemini.generate(combinedPrompt, systemPrompt);
      } catch (geminiError) {
        console.error('Gemini fallback also failed:', geminiError);
        throw new Error('Failed to generate chat response');
      }
    }
  }

  /**
   * Generate a streaming response from Claude
   * @param prompt The user prompt
   * @param systemPrompt Optional system prompt
   * @param onChunk Callback for each text chunk
   * @param onThinking Optional callback when thinking block is detected
   * @param signal Optional AbortSignal for cancellation
   * @returns StreamResult with complete text and token counts
   */
  async generateStream(
    prompt: string,
    systemPrompt?: string,
    onChunk?: StreamCallback,
    onThinking?: () => void,
    signal?: AbortSignal
  ): Promise<StreamResult> {
    try {
      const stream = await this.client.messages.create({
        model: this.defaultModel,
        max_tokens: 8192,
        system: systemPrompt || 'You are a helpful AI assistant.',
        messages: [{ role: 'user', content: prompt }],
        stream: true
      });

      let fullText = '';
      let inputTokens = 0;
      let outputTokens = 0;
      let isThinkingBlock = false;

      // Stream each event
      for await (const event of stream) {
        // Check for cancellation
        if (signal?.aborted) {
          console.log('[ClaudeStream] Aborted by signal');
          break;
        }

        switch (event.type) {
          case 'message_start':
            // Extract input token count from the message start event
            if (event.message?.usage) {
              inputTokens = event.message.usage.input_tokens || 0;
            }
            break;

          case 'content_block_start':
            // Check if this is a thinking block (extended thinking)
            // Thinking blocks have type 'thinking' instead of 'text'
            if (event.content_block && 'type' in event.content_block) {
              if ((event.content_block as { type: string }).type === 'thinking') {
                isThinkingBlock = true;
                // Notify that thinking is happening
                onThinking?.();
              } else {
                isThinkingBlock = false;
              }
            }
            break;

          case 'content_block_delta':
            // Only stream text deltas, not thinking deltas
            if (!isThinkingBlock && event.delta && 'type' in event.delta) {
              if (event.delta.type === 'text_delta' && 'text' in event.delta) {
                const text = (event.delta as { text: string }).text;
                if (text) {
                  fullText += text;
                  onChunk?.(text);
                }
              }
            }
            break;

          case 'content_block_stop':
            // Reset thinking block flag when the block ends
            isThinkingBlock = false;
            break;

          case 'message_delta':
            // Extract output token count from the message delta event
            if (event.usage) {
              outputTokens = event.usage.output_tokens || 0;
            }
            break;

          case 'message_stop':
            // Stream complete
            break;
        }
      }

      return {
        text: fullText,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens
      };
    } catch (error) {
      // Handle aborted streams gracefully
      if (signal?.aborted) {
        console.log('[ClaudeStream] Stream cancelled');
        return {
          text: '',
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0
        };
      }

      console.error('Claude Stream Error:', error);

      // Fallback to Gemini streaming if Claude fails
      console.log('⚠️  Claude streaming failed, falling back to Gemini streaming...');
      try {
        const { GeminiService } = await import('./gemini.js');
        const gemini = new GeminiService();
        return await gemini.generateStream(prompt, systemPrompt, onChunk, signal);
      } catch (geminiError) {
        console.error('Gemini streaming fallback also failed:', geminiError);
        throw new Error(`Failed to stream response: ${(error as Error).message}`);
      }
    }
  }

  async parseContract(content: string, mimeType?: string): Promise<ContractExtraction> {
    const systemPrompt = `You are an expert contract and document analysis assistant for customer onboarding workflows.

Your goals:
1. EXTRACT key information from the uploaded contract accurately
2. STRUCTURE the data into standardized formats
3. ASSIGN tasks to appropriate agents (Provisioning Agent, Finance Agent, Compliance Agent, Onboarding Agent, Success Agent)
4. FLAG any missing information that would be needed for onboarding
5. Calculate confidence scores for each field (0-1)

Be thorough and precise. If information is not present, mark it as "Not specified" rather than guessing.
Always return valid JSON matching the exact schema requested.`;

    const prompt = `Analyze this contract document and extract all relevant information.

Return a JSON object with exactly this structure:
{
  "company_name": "string - the customer company name",
  "arr": number - annual recurring revenue estimate in USD,
  "contract_period": "string - e.g., '12 months' or 'Jan 2024 - Dec 2024'",
  "entitlements": [
    {
      "type": "string - product/service type",
      "description": "string - what it includes",
      "quantity": "string - number of seats/units",
      "start_date": "string - when it starts",
      "end_date": "string - when it ends",
      "dependencies": "string - any prerequisites"
    }
  ],
  "stakeholders": [
    {
      "name": "string - full name",
      "role": "string - job title or role like 'Champion', 'Decision Maker', 'Technical Lead'",
      "department": "string - their department",
      "contact": "string - email or phone",
      "responsibilities": "string - what they're responsible for",
      "approval_required": boolean - whether they need to approve things
    }
  ],
  "technical_requirements": [
    {
      "requirement": "string - what's needed",
      "type": "string - Integration, Security, Infrastructure, etc.",
      "priority": "High" | "Medium" | "Low",
      "owner": "string - who owns this",
      "status": "string - Pending, In Progress, Complete",
      "due_date": "string - target date"
    }
  ],
  "contract_tasks": [
    {
      "task": "string - task name",
      "description": "string - what needs to be done",
      "assigned_agent": "Provisioning Agent" | "Finance Agent" | "Compliance Agent" | "Onboarding Agent" | "Success Agent",
      "priority": "High" | "Medium" | "Low",
      "dependencies": "string - what this depends on",
      "due_date": "string - target date"
    }
  ],
  "pricing_terms": [
    {
      "item": "string - line item name",
      "description": "string - what it covers",
      "quantity": "string - amount",
      "unit_price": "string - price per unit",
      "total": "string - total amount",
      "payment_terms": "string - billing terms"
    }
  ],
  "missing_info": ["string - list of information that's missing but would be helpful"],
  "next_steps": "string - recommended next actions",
  "confidence_scores": {
    "company_name": 0.95,
    "arr": 0.85,
    "stakeholders": 0.90,
    ...etc
  }
}

Document content:
${content}

Return ONLY the JSON object, no markdown formatting or explanation.`;

    try {
      const response = await this.generate(prompt, systemPrompt, true);
      return extractAndParseJSON(response) as ContractExtraction;
    } catch (error) {
      console.error('Contract parsing error:', error);
      throw new Error('Failed to parse contract');
    }
  }

  async generateSummary(extraction: ContractExtraction): Promise<string> {
    const entitlements_str = extraction.entitlements.map(e => `- ${e.type}: ${e.quantity}`).join("\n");
    const stakeholders_str = extraction.stakeholders.map(s => `- ${s.name} (${s.role})`).join("\n");
    const risks = extraction.missing_info.length > 0
      ? `Missing Info:\n${extraction.missing_info.join('\n')}`
      : "No critical missing info.";

    const prompt = `Create a concise executive summary for a Customer Success Manager based on this contract data. Use markdown formatting with sections: "Key Details", "Highlights", "Opportunities", and "Risk Factors". Be specific and actionable.

Company: ${extraction.company_name}
ARR: $${extraction.arr?.toLocaleString()}
Period: ${extraction.contract_period}

Entitlements:
${entitlements_str}

Stakeholders:
${stakeholders_str}

Analysis Flags:
${risks}

Next Steps:
${extraction.next_steps}`;

    return this.generate(prompt);
  }

  async researchCompany(companyName: string): Promise<CompanyResearch> {
    const prompt = `Research the company "${companyName}" and provide realistic, plausible information about them. If this is a well-known company, use actual information. If not, create realistic placeholder data that makes sense for a B2B SaaS customer.

Return a JSON object with exactly this structure:
{
  "company_name": "${companyName}",
  "domain": "string - company website domain",
  "industry": "string - their industry",
  "employee_count": number - estimated employees,
  "tech_stack": ["string array - technologies they likely use"],
  "recent_news": ["string array - recent news or developments"],
  "key_initiatives": ["string array - strategic initiatives"],
  "competitors": ["string array - main competitors"],
  "overview": "string - 2-3 sentence company overview"
}

Return ONLY the JSON object, no markdown formatting.`;

    // Try Claude first
    try {
      const response = await this.generateForJSON(prompt);
      return extractAndParseJSON(response) as CompanyResearch;
    } catch (claudeError) {
      console.log('Claude failed for research, using Gemini JSON mode...');
    }

    // Fallback to Gemini JSON mode
    try {
      const { GeminiService } = await import('./gemini.js');
      const gemini = new GeminiService();
      const result = await gemini.generateJSON(prompt);
      console.log('Gemini JSON research succeeded');
      return result as unknown as CompanyResearch;
    } catch (geminiError) {
      console.error('Gemini JSON failed for research:', geminiError);
    }

    // Return placeholder data as last resort
    console.log('Returning placeholder research data');
    return {
      company_name: companyName,
      domain: `${companyName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
      industry: 'Technology',
      employee_count: 500,
      tech_stack: ['Cloud Infrastructure', 'Modern SaaS Stack'],
      recent_news: ['Company expanding operations'],
      key_initiatives: ['Digital transformation', 'Customer experience'],
      competitors: ['Industry competitors'],
      overview: `${companyName} is a growing company focused on innovation.`
    };
  }

  async createOnboardingPlan(
    accountData: { name: string; arr: number },
    entitlements: Array<{ type: string; description: string; quantity: string }>,
    stakeholders: Array<{ name: string; role: string }>,
    timelineDays: number = 90
  ): Promise<OnboardingPlan> {
    const entitlements_str = entitlements.map(e => `- ${e.type}: ${e.quantity}`).join("\n");
    const stakeholders_str = stakeholders.map(s => `- ${s.name} (${s.role})`).join("\n");

    const prompt = `Create a detailed ${timelineDays}-day onboarding plan for customer "${accountData.name}".

Customer Details:
- ARR: $${accountData.arr?.toLocaleString()}
- Products/Entitlements:
${entitlements_str}
- Stakeholders:
${stakeholders_str}

Create a plan with 3-4 phases (e.g., Foundation, Implementation, Optimization, Expansion) that progressively builds value.

Return a JSON object with exactly this structure:
{
  "timeline_days": ${timelineDays},
  "phases": [
    {
      "name": "string - phase name",
      "description": "string - what this phase accomplishes",
      "tasks": [
        {
          "title": "string - task name",
          "description": "string - what needs to be done",
          "owner": "CSM" | "AE" | "SA" | "Customer",
          "due_days": number - days from start,
          "success_criteria": "string - how to measure completion"
        }
      ],
      "success_metrics": ["string array - metrics to track"]
    }
  ],
  "risk_factors": ["string array - potential risks to watch"],
  "opportunities": ["string array - upsell/expansion opportunities"],
  "recommended_touchpoints": ["string array - key meetings/checkpoints"]
}

Return ONLY the JSON object, no markdown formatting.`;

    // Try Claude first
    try {
      const response = await this.generateForJSON(prompt);
      return extractAndParseJSON(response) as OnboardingPlan;
    } catch (claudeError) {
      console.log('Claude failed for plan, using Gemini JSON mode...');
    }

    // Fallback to Gemini JSON mode
    try {
      const { GeminiService } = await import('./gemini.js');
      const gemini = new GeminiService();
      const result = await gemini.generateJSON(prompt);
      console.log('Gemini JSON plan succeeded');
      return result as unknown as OnboardingPlan;
    } catch (geminiError) {
      console.error('Gemini JSON failed for plan:', geminiError);
    }

    // Return default plan as last resort
    console.log('Returning default plan');
    return {
      timeline_days: timelineDays,
      phases: [
        {
          name: 'Foundation (Days 1-30)',
          description: 'Establish relationship and complete initial setup',
          tasks: [
            { title: 'Kickoff Meeting', description: 'Introduce team and align on goals', owner: 'CSM' as const, due_days: 7, success_criteria: 'Meeting completed' },
            { title: 'Technical Setup', description: 'Configure initial integrations', owner: 'SA' as const, due_days: 14, success_criteria: 'Setup complete' }
          ],
          success_metrics: ['First login achieved', 'Initial setup complete']
        },
        {
          name: 'Adoption (Days 31-60)',
          description: 'Drive usage and value realization',
          tasks: [
            { title: 'Training Session', description: 'Train key users', owner: 'CSM' as const, due_days: 45, success_criteria: 'Users trained' }
          ],
          success_metrics: ['Active users increasing']
        },
        {
          name: 'Optimization (Days 61-90)',
          description: 'Expand and optimize usage',
          tasks: [
            { title: 'QBR', description: 'Quarterly business review', owner: 'CSM' as const, due_days: 85, success_criteria: 'Review completed' }
          ],
          success_metrics: ['Customer satisfied']
        }
      ],
      risk_factors: ['Stakeholder availability', 'Technical complexity'],
      opportunities: ['Expansion potential', 'Case study candidate'],
      recommended_touchpoints: ['Day 7: Kickoff', 'Day 30: Check-in', 'Day 60: Review', 'Day 90: QBR']
    };
  }

  async analyzeComplex(content: string, task: string): Promise<string> {
    const prompt = `Task: ${task}

Content to analyze:
${content}

Provide a thorough, well-structured analysis.`;

    return this.generate(prompt, undefined, true);
  }

  // Agent-specific methods
  async generateAgentResponse(
    agentType: 'onboarding' | 'meeting' | 'training' | 'intelligence',
    context: {
      customerName: string;
      arr?: number;
      products?: string[];
      stakeholders?: string[];
      message: string;
      history?: Array<{ role: 'user' | 'assistant'; content: string }>;
      additionalContext?: Record<string, unknown>;
    }
  ): Promise<{ message: string; requiresApproval?: boolean; deployAgent?: string; data?: Record<string, unknown> }> {
    const systemPrompts: Record<string, string> = {
      onboarding: `You are the Onboarding Orchestrator for CSCX.AI. You have full access to the customer's contract data and context.

Your role is to:
1. Create and manage the customer onboarding timeline
2. Coordinate between Meeting, Training, and Intelligence agents
3. Recommend actions to the CSM and request approval for critical steps
4. Track progress and proactively identify risks
5. Ensure the customer achieves their first value milestone quickly

Available subagents you can deploy:
- Meeting Agent: Schedule calls, create agendas, handle meeting coordination
- Training Agent: Generate training content, answer product questions
- Intelligence Agent: Pull CRM data, calculate health scores, research company

Always be specific about customer details. Reference actual contract data.
When you need to take a critical action (send email, schedule meeting, update CRM), ask for approval first.
Format your responses with clear, actionable information using markdown.`,

      meeting: `You are the Meeting Agent for CSCX.AI.

Your capabilities:
1. Schedule meetings with customers via calendar integration
2. Create detailed meeting agendas based on onboarding phase
3. Generate pre-meeting briefs for CSMs
4. Capture meeting notes and action items
5. Recommend follow-up meetings

When scheduling, always:
- Suggest multiple time slots
- Include a clear, relevant agenda
- Specify meeting duration and attendees
- Ask for approval before sending invites

Format all meeting details clearly with markdown.`,

      training: `You are the Training Agent for CSCX.AI.

Your role is to:
1. Create personalized training plans based on products purchased
2. Generate training materials and quick-start guides
3. Track training completion per stakeholder
4. Recommend additional training based on usage patterns
5. Answer product questions from the knowledge base

When generating training content:
- Make it specific to the customer's products and use case
- Include step-by-step instructions
- Add relevant examples for their industry
- Consider their technical skill level

Be educational, supportive, and proactive about learning paths.`,

      intelligence: `You are the Intelligence Agent for CSCX.AI.

Your role is to:
1. Consolidate customer data from multiple sources
2. Calculate and explain health scores
3. Identify risks and opportunities
4. Build comprehensive customer timelines
5. Enrich profiles with external research

When presenting data:
- Be concise but comprehensive
- Highlight key metrics and trends
- Flag concerns with specific evidence
- Provide actionable recommendations

Be analytical, data-driven, and proactive about surfacing insights.`
    };

    const contextPrompt = `
Customer: ${context.customerName}
${context.arr ? `ARR: $${context.arr.toLocaleString()}` : ''}
${context.products?.length ? `Products: ${context.products.join(', ')}` : ''}
${context.stakeholders?.length ? `Stakeholders: ${context.stakeholders.join(', ')}` : ''}
${context.additionalContext ? `Additional Context: ${JSON.stringify(context.additionalContext)}` : ''}

CSM Message: ${context.message}

Respond helpfully and professionally. If this requires a critical action (sending emails, scheduling meetings, updating systems), indicate that you need approval.
If you should delegate to a subagent, mention which one and why.`;

    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = context.history || [];
    messages.push({ role: 'user', content: contextPrompt });

    const response = await this.generateWithHistory(messages, systemPrompts[agentType]);

    // Detect if approval is needed
    const approvalKeywords = ['shall i', 'would you like me to', 'do you approve', 'can i proceed', 'ready to send', 'confirm', 'schedule the'];
    const requiresApproval = approvalKeywords.some(kw => response.toLowerCase().includes(kw));

    // Detect agent deployment
    let deployAgent: string | undefined;
    const lower = response.toLowerCase();
    if (lower.includes('meeting agent') || (lower.includes('schedule') && lower.includes('call'))) {
      deployAgent = 'meeting';
    } else if (lower.includes('training agent') || (lower.includes('training') && lower.includes('deploy'))) {
      deployAgent = 'training';
    } else if (lower.includes('intelligence agent') || lower.includes('pull data') || lower.includes('health score')) {
      deployAgent = 'intelligence';
    }

    return {
      message: response,
      requiresApproval,
      deployAgent
    };
  }
}
