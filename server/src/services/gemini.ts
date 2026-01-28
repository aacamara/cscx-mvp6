import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/index.js';

/**
 * Result from streaming generation including token usage
 */
export interface StreamResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

/**
 * Callback for streaming chunks
 */
export type StreamCallback = (chunk: string) => void;

export class GeminiService {
  private client: GoogleGenerativeAI;
  private model: string = 'gemini-2.0-flash';

  constructor() {
    this.client = new GoogleGenerativeAI(config.geminiApiKey);
  }

  async generate(prompt: string, systemPrompt?: string): Promise<string> {
    try {
      const model = this.client.getGenerativeModel({
        model: this.model,
        systemInstruction: systemPrompt
      });

      const result = await model.generateContent(prompt);
      const response = result.response;

      return response.text();
    } catch (error) {
      console.error('Gemini API Error:', error);
      throw new Error('Failed to generate response from Gemini');
    }
  }

  async generateJSON(prompt: string, systemPrompt?: string): Promise<Record<string, unknown>> {
    try {
      const model = this.client.getGenerativeModel({
        model: this.model,
        systemInstruction: systemPrompt,
        generationConfig: {
          responseMimeType: 'application/json'
        }
      });

      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      return JSON.parse(text);
    } catch (error) {
      console.error('Gemini JSON API Error:', error);
      throw new Error('Failed to generate JSON response from Gemini');
    }
  }

  async generateWithHistory(
    messages: Array<{ role: 'user' | 'model'; content: string }>,
    systemPrompt?: string
  ): Promise<string> {
    try {
      const model = this.client.getGenerativeModel({
        model: this.model,
        systemInstruction: systemPrompt
      });

      const chat = model.startChat({
        history: messages.map(m => ({
          role: m.role,
          parts: [{ text: m.content }]
        }))
      });

      // Get the last user message
      const lastMessage = messages[messages.length - 1];
      const result = await chat.sendMessage(lastMessage.content);

      return result.response.text();
    } catch (error) {
      console.error('Gemini Chat Error:', error);
      throw new Error('Failed to generate chat response from Gemini');
    }
  }

  async parseDocument(
    base64Content: string,
    mimeType: string
  ): Promise<Record<string, unknown>> {
    console.log('🔮 Gemini parseDocument called:', { mimeType, contentLength: base64Content?.length });

    try {
      const model = this.client.getGenerativeModel({ model: this.model });
      console.log('🔮 Gemini model initialized:', this.model);

      const systemPrompt = `You are an expert contract analysis assistant. Extract structured data from contracts accurately.`;

      const prompt = `Analyze this contract document and extract all relevant information.

Return a JSON object with exactly this structure:
{
  "company_name": "string - the customer company name",
  "arr": number - annual recurring revenue in USD,
  "contract_period": "string - e.g. '12 months'",
  "entitlements": [
    {"type": "string", "description": "string", "quantity": "string", "start_date": "string", "end_date": "string", "dependencies": "string"}
  ],
  "stakeholders": [
    {"name": "string", "role": "string", "department": "string", "contact": "string", "responsibilities": "string", "approval_required": boolean}
  ],
  "technical_requirements": [
    {"requirement": "string", "type": "string", "priority": "High/Medium/Low", "owner": "string", "status": "string", "due_date": "string"}
  ],
  "contract_tasks": [
    {"task": "string", "description": "string", "assigned_agent": "string", "priority": "High/Medium/Low", "dependencies": "string", "due_date": "string"}
  ],
  "pricing_terms": [
    {"item": "string", "description": "string", "quantity": "string", "unit_price": "string", "total": "string", "payment_terms": "string"}
  ],
  "missing_info": ["string array of missing information"],
  "next_steps": "string - recommended next actions"
}

Return ONLY the JSON object, no markdown or explanation.`;

      // Use multimodal input for PDFs and images
      const parts = [
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Content
          }
        },
        { text: prompt }
      ];

      console.log('🔮 Calling Gemini generateContent...');
      const result = await model.generateContent({
        contents: [{ role: 'user', parts }],
        systemInstruction: systemPrompt
      } as any);

      console.log('🔮 Gemini response received, extracting text...');
      console.log('🔮 Response type:', typeof result.response);
      console.log('🔮 Response keys:', Object.keys(result.response || {}));

      // Safely extract text from response
      let text: string;
      try {
        text = result.response.text();
        console.log('🔮 Text extracted successfully, length:', text?.length);
      } catch (textError) {
        console.error('🔮 Error extracting text from response:', textError);
        console.error('🔮 Response object:', JSON.stringify(result.response, null, 2).substring(0, 1000));
        throw textError;
      }

      // Clean and parse JSON from response
      let jsonString = text.trim();
      if (jsonString.startsWith('```json')) {
        jsonString = jsonString.substring(7);
      } else if (jsonString.startsWith('```')) {
        jsonString = jsonString.substring(3);
      }
      if (jsonString.endsWith('```')) {
        jsonString = jsonString.slice(0, -3);
      }
      jsonString = jsonString.trim();

      // Find JSON object in response
      const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log('🔮 JSON parsed successfully:', { company: parsed.company_name });
        return parsed;
      }

      throw new Error('No valid JSON found in response');
    } catch (error) {
      console.error('❌ Gemini Parse Error:', error);
      console.error('❌ Error name:', (error as Error)?.name);
      console.error('❌ Error message:', (error as Error)?.message);
      console.error('❌ Error stack:', (error as Error)?.stack);
      throw new Error(`Failed to parse document with Gemini: ${(error as Error)?.message}`);
    }
  }

  /**
   * Generate a streaming response from Gemini
   * @param prompt The user prompt
   * @param systemPrompt Optional system prompt
   * @param onChunk Callback for each text chunk
   * @param signal Optional AbortSignal for cancellation
   * @returns StreamResult with complete text and token counts
   */
  async generateStream(
    prompt: string,
    systemPrompt?: string,
    onChunk?: StreamCallback,
    signal?: AbortSignal
  ): Promise<StreamResult> {
    try {
      const model = this.client.getGenerativeModel({
        model: this.model,
        systemInstruction: systemPrompt
      });

      const result = await model.generateContentStream(prompt);

      let fullText = '';
      let inputTokens = 0;
      let outputTokens = 0;

      // Stream each chunk
      for await (const chunk of result.stream) {
        // Check for cancellation
        if (signal?.aborted) {
          console.log('[GeminiStream] Aborted by signal');
          break;
        }

        const text = chunk.text();
        if (text) {
          fullText += text;
          onChunk?.(text);
        }

        // Extract token usage if available
        if (chunk.usageMetadata) {
          inputTokens = chunk.usageMetadata.promptTokenCount || 0;
          outputTokens = chunk.usageMetadata.candidatesTokenCount || 0;
        }
      }

      // Get final response for accurate token count
      const response = await result.response;
      if (response.usageMetadata) {
        inputTokens = response.usageMetadata.promptTokenCount || inputTokens;
        outputTokens = response.usageMetadata.candidatesTokenCount || outputTokens;
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
        console.log('[GeminiStream] Stream cancelled');
        return {
          text: '',
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0
        };
      }

      console.error('Gemini Stream Error:', error);
      throw new Error(`Failed to stream response from Gemini: ${(error as Error).message}`);
    }
  }

  /**
   * Generate a streaming response with conversation history
   * @param messages Conversation history
   * @param systemPrompt Optional system prompt
   * @param onChunk Callback for each text chunk
   * @param signal Optional AbortSignal for cancellation
   * @returns StreamResult with complete text and token counts
   */
  async generateStreamWithHistory(
    messages: Array<{ role: 'user' | 'model'; content: string }>,
    systemPrompt?: string,
    onChunk?: StreamCallback,
    signal?: AbortSignal
  ): Promise<StreamResult> {
    try {
      const model = this.client.getGenerativeModel({
        model: this.model,
        systemInstruction: systemPrompt
      });

      // Prepare history (all messages except the last user message)
      const historyMessages = messages.slice(0, -1);
      const chat = model.startChat({
        history: historyMessages.map(m => ({
          role: m.role,
          parts: [{ text: m.content }]
        }))
      });

      // Get the last user message to send
      const lastMessage = messages[messages.length - 1];
      const result = await chat.sendMessageStream(lastMessage.content);

      let fullText = '';
      let inputTokens = 0;
      let outputTokens = 0;

      // Stream each chunk
      for await (const chunk of result.stream) {
        // Check for cancellation
        if (signal?.aborted) {
          console.log('[GeminiStream] Aborted by signal');
          break;
        }

        const text = chunk.text();
        if (text) {
          fullText += text;
          onChunk?.(text);
        }

        // Extract token usage if available
        if (chunk.usageMetadata) {
          inputTokens = chunk.usageMetadata.promptTokenCount || 0;
          outputTokens = chunk.usageMetadata.candidatesTokenCount || 0;
        }
      }

      // Get final response for accurate token count
      const response = await result.response;
      if (response.usageMetadata) {
        inputTokens = response.usageMetadata.promptTokenCount || inputTokens;
        outputTokens = response.usageMetadata.candidatesTokenCount || outputTokens;
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
        console.log('[GeminiStream] Stream cancelled');
        return {
          text: '',
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0
        };
      }

      console.error('Gemini Chat Stream Error:', error);
      throw new Error(`Failed to stream chat response from Gemini: ${(error as Error).message}`);
    }
  }
}
