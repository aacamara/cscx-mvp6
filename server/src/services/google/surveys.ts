/**
 * Survey Service - NPS, CSAT, CES Surveys via Google Forms
 * Creates and manages customer satisfaction surveys
 */

import { google, forms_v1 } from 'googleapis';
import { googleOAuth } from './oauth.js';
import { createClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';

const supabase = createClient(config.supabaseUrl!, config.supabaseServiceKey!);

// ============================================
// TYPES
// ============================================

export type SurveyType = 'nps_relational' | 'nps_transactional' | 'nps_employee' | 'csat' | 'ces';

export interface SurveyConfig {
  type: SurveyType;
  title: string;
  description: string;
  questions: SurveyQuestion[];
  branding?: {
    headerImage?: string;
    primaryColor?: string;
  };
}

export interface SurveyQuestion {
  type: 'scale' | 'text' | 'multiple_choice' | 'paragraph';
  title: string;
  description?: string;
  required: boolean;
  options?: string[];
  scaleMin?: number;
  scaleMax?: number;
  scaleLabelLow?: string;
  scaleLabelHigh?: string;
}

export interface SurveyResult {
  formId: string;
  formUrl: string;
  editUrl: string;
  responsesUrl: string;
}

export interface SurveyResponse {
  responseId: string;
  customerId?: string;
  timestamp: string;
  answers: Record<string, any>;
  npsScore?: number;
  csatScore?: number;
  cesScore?: number;
  category?: 'promoter' | 'passive' | 'detractor';
}

// ============================================
// SURVEY TEMPLATES
// ============================================

const SURVEY_TEMPLATES: Record<SurveyType, SurveyConfig> = {
  nps_relational: {
    type: 'nps_relational',
    title: 'Customer Feedback Survey',
    description: 'We value your feedback! Please take a moment to share your experience with us.',
    questions: [
      {
        type: 'scale',
        title: 'On a scale of 0-10, how likely are you to recommend us to a friend or colleague?',
        required: true,
        scaleMin: 0,
        scaleMax: 10,
        scaleLabelLow: 'Not at all likely',
        scaleLabelHigh: 'Extremely likely'
      },
      {
        type: 'paragraph',
        title: 'What is the primary reason for your score?',
        required: false
      },
      {
        type: 'paragraph',
        title: 'What could we do to improve your experience?',
        required: false
      }
    ]
  },
  nps_transactional: {
    type: 'nps_transactional',
    title: 'Experience Feedback',
    description: 'Please share your feedback about your recent interaction with us.',
    questions: [
      {
        type: 'scale',
        title: 'Based on your recent experience, how likely are you to recommend us to a friend or colleague?',
        required: true,
        scaleMin: 0,
        scaleMax: 10,
        scaleLabelLow: 'Not at all likely',
        scaleLabelHigh: 'Extremely likely'
      },
      {
        type: 'paragraph',
        title: 'What could we have done better?',
        required: false
      }
    ]
  },
  nps_employee: {
    type: 'nps_employee',
    title: 'Employee Satisfaction Survey',
    description: 'Your feedback helps us create a better workplace. This survey is anonymous.',
    questions: [
      {
        type: 'scale',
        title: 'On a scale of 0-10, how likely are you to recommend our company as a place to work?',
        required: true,
        scaleMin: 0,
        scaleMax: 10,
        scaleLabelLow: 'Not at all likely',
        scaleLabelHigh: 'Extremely likely'
      },
      {
        type: 'paragraph',
        title: 'What do you enjoy most about working here?',
        required: false
      },
      {
        type: 'paragraph',
        title: 'What one thing would most improve your work experience?',
        required: false
      },
      {
        type: 'scale',
        title: 'How satisfied are you with career growth opportunities?',
        required: false,
        scaleMin: 1,
        scaleMax: 5,
        scaleLabelLow: 'Very unsatisfied',
        scaleLabelHigh: 'Very satisfied'
      },
      {
        type: 'scale',
        title: 'How would you rate work-life balance?',
        required: false,
        scaleMin: 1,
        scaleMax: 5,
        scaleLabelLow: 'Very poor',
        scaleLabelHigh: 'Excellent'
      }
    ]
  },
  csat: {
    type: 'csat',
    title: 'Customer Satisfaction Survey',
    description: 'Please rate your satisfaction with our service.',
    questions: [
      {
        type: 'scale',
        title: 'How satisfied were you with your experience?',
        required: true,
        scaleMin: 1,
        scaleMax: 5,
        scaleLabelLow: 'Very Unsatisfied',
        scaleLabelHigh: 'Very Satisfied'
      },
      {
        type: 'multiple_choice',
        title: 'What aspect were you most satisfied with?',
        required: false,
        options: ['Product Quality', 'Customer Service', 'Ease of Use', 'Value for Money', 'Other']
      },
      {
        type: 'paragraph',
        title: 'Any additional comments?',
        required: false
      }
    ]
  },
  ces: {
    type: 'ces',
    title: 'Customer Effort Survey',
    description: 'Help us understand how easy it was to work with us.',
    questions: [
      {
        type: 'scale',
        title: 'The company made it easy for me to handle my issue.',
        description: 'Please rate your agreement with this statement.',
        required: true,
        scaleMin: 1,
        scaleMax: 7,
        scaleLabelLow: 'Strongly Disagree',
        scaleLabelHigh: 'Strongly Agree'
      },
      {
        type: 'paragraph',
        title: 'What would have made this easier?',
        required: false
      }
    ]
  }
};

// ============================================
// SURVEY SERVICE CLASS
// ============================================

class SurveyService {
  /**
   * Create a new survey using Google Forms
   */
  async createSurvey(
    userId: string,
    surveyType: SurveyType,
    customizations?: Partial<SurveyConfig>
  ): Promise<SurveyResult> {
    const auth = await googleOAuth.getAuthenticatedClient(userId);
    const forms = google.forms({ version: 'v1', auth });

    // Get template and apply customizations
    const template = { ...SURVEY_TEMPLATES[surveyType] };
    if (customizations?.title) template.title = customizations.title;
    if (customizations?.description) template.description = customizations.description;
    if (customizations?.questions) template.questions = customizations.questions;

    // Create the form
    const createResponse = await forms.forms.create({
      requestBody: {
        info: {
          title: template.title,
          documentTitle: template.title
        }
      }
    });

    const formId = createResponse.data.formId!;

    // Build update requests for questions
    const requests: forms_v1.Schema$Request[] = [];
    let location = 0;

    // Add description as first item
    requests.push({
      createItem: {
        item: {
          title: template.description,
          description: '',
          textItem: {}
        },
        location: { index: location++ }
      }
    });

    // Add each question
    for (const question of template.questions) {
      const item = this.buildFormItem(question, location++);
      requests.push({ createItem: item });
    }

    // Add hidden customer ID field
    requests.push({
      createItem: {
        item: {
          title: 'Customer ID (Internal)',
          description: 'This field is pre-filled automatically',
          textItem: {}
        },
        location: { index: location }
      }
    });

    // Apply updates
    await forms.forms.batchUpdate({
      formId,
      requestBody: { requests }
    });

    // Get the form URLs
    const formResponse = await forms.forms.get({ formId });

    return {
      formId,
      formUrl: formResponse.data.responderUri || `https://docs.google.com/forms/d/${formId}/viewform`,
      editUrl: `https://docs.google.com/forms/d/${formId}/edit`,
      responsesUrl: `https://docs.google.com/forms/d/${formId}/responses`
    };
  }

  /**
   * Build a Google Forms item from our question config
   */
  private buildFormItem(question: SurveyQuestion, index: number): forms_v1.Schema$CreateItemRequest {
    const baseItem: any = {
      title: question.title,
      description: question.description || ''
    };

    switch (question.type) {
      case 'scale':
        return {
          item: {
            ...baseItem,
            questionItem: {
              question: {
                required: question.required,
                scaleQuestion: {
                  low: question.scaleMin || 0,
                  high: question.scaleMax || 10,
                  lowLabel: question.scaleLabelLow || '',
                  highLabel: question.scaleLabelHigh || ''
                }
              }
            }
          },
          location: { index }
        };

      case 'multiple_choice':
        return {
          item: {
            ...baseItem,
            questionItem: {
              question: {
                required: question.required,
                choiceQuestion: {
                  type: 'RADIO',
                  options: question.options?.map(opt => ({ value: opt })) || []
                }
              }
            }
          },
          location: { index }
        };

      case 'paragraph':
        return {
          item: {
            ...baseItem,
            questionItem: {
              question: {
                required: question.required,
                textQuestion: {
                  paragraph: true
                }
              }
            }
          },
          location: { index }
        };

      case 'text':
      default:
        return {
          item: {
            ...baseItem,
            questionItem: {
              question: {
                required: question.required,
                textQuestion: {
                  paragraph: false
                }
              }
            }
          },
          location: { index }
        };
    }
  }

  /**
   * Get survey responses from a Google Form
   */
  async getSurveyResponses(userId: string, formId: string): Promise<SurveyResponse[]> {
    const auth = await googleOAuth.getAuthenticatedClient(userId);
    const forms = google.forms({ version: 'v1', auth });

    const responsesResponse = await forms.forms.responses.list({ formId });
    const responses = responsesResponse.data.responses || [];

    return responses.map(response => {
      const answers: Record<string, any> = {};
      let npsScore: number | undefined;
      let csatScore: number | undefined;
      let cesScore: number | undefined;

      if (response.answers) {
        for (const [questionId, answer] of Object.entries(response.answers)) {
          const textAnswers = answer.textAnswers?.answers?.map(a => a.value) || [];
          answers[questionId] = textAnswers.length === 1 ? textAnswers[0] : textAnswers;

          // Try to extract numeric scores
          const numericAnswer = parseFloat(textAnswers[0] || '');
          if (!isNaN(numericAnswer)) {
            // Heuristic: 0-10 scale is likely NPS, 1-5 is CSAT, 1-7 is CES
            if (numericAnswer >= 0 && numericAnswer <= 10 && !npsScore) {
              npsScore = numericAnswer;
            } else if (numericAnswer >= 1 && numericAnswer <= 5 && !csatScore) {
              csatScore = numericAnswer;
            } else if (numericAnswer >= 1 && numericAnswer <= 7 && !cesScore) {
              cesScore = numericAnswer;
            }
          }
        }
      }

      // Categorize NPS response
      let category: 'promoter' | 'passive' | 'detractor' | undefined;
      if (npsScore !== undefined) {
        if (npsScore >= 9) category = 'promoter';
        else if (npsScore >= 7) category = 'passive';
        else category = 'detractor';
      }

      return {
        responseId: response.responseId || '',
        timestamp: response.createTime || new Date().toISOString(),
        answers,
        npsScore,
        csatScore,
        cesScore,
        category
      };
    });
  }

  /**
   * Generate a pre-filled survey URL for a specific customer
   */
  generateCustomerSurveyUrl(
    formUrl: string,
    customerId: string,
    customerName?: string
  ): string {
    const url = new URL(formUrl);
    // Add pre-fill parameters (would need to know the entry IDs)
    url.searchParams.set('entry.customer_id', customerId);
    if (customerName) {
      url.searchParams.set('entry.customer_name', customerName);
    }
    return url.toString();
  }

  /**
   * Store survey record in database
   */
  async storeSurvey(
    userId: string,
    customerId: string | null,
    surveyType: SurveyType,
    formId: string,
    formUrl: string
  ): Promise<void> {
    await supabase.from('surveys').insert({
      user_id: userId,
      customer_id: customerId,
      survey_type: surveyType,
      form_id: formId,
      form_url: formUrl,
      status: 'active',
      created_at: new Date().toISOString()
    });
  }

  /**
   * Store survey response in database
   */
  async storeSurveyResponse(
    surveyId: string,
    customerId: string | null,
    response: SurveyResponse
  ): Promise<void> {
    await supabase.from('survey_responses').insert({
      survey_id: surveyId,
      customer_id: customerId,
      response_id: response.responseId,
      nps_score: response.npsScore,
      csat_score: response.csatScore,
      ces_score: response.cesScore,
      category: response.category,
      answers: response.answers,
      submitted_at: response.timestamp
    });
  }

  /**
   * Get NPS breakdown for a time period
   */
  async getNPSBreakdown(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    nps: number;
    promoters: number;
    passives: number;
    detractors: number;
    totalResponses: number;
    trend: number;
  }> {
    let query = supabase
      .from('survey_responses')
      .select('nps_score, category, submitted_at')
      .not('nps_score', 'is', null);

    if (startDate) {
      query = query.gte('submitted_at', startDate.toISOString());
    }
    if (endDate) {
      query = query.lte('submitted_at', endDate.toISOString());
    }

    const { data: responses } = await query;

    if (!responses || responses.length === 0) {
      return { nps: 0, promoters: 0, passives: 0, detractors: 0, totalResponses: 0, trend: 0 };
    }

    const promoters = responses.filter(r => r.category === 'promoter').length;
    const passives = responses.filter(r => r.category === 'passive').length;
    const detractors = responses.filter(r => r.category === 'detractor').length;
    const total = responses.length;

    const nps = Math.round(((promoters / total) - (detractors / total)) * 100);

    return {
      nps,
      promoters,
      passives,
      detractors,
      totalResponses: total,
      trend: 0 // Would need historical comparison
    };
  }

  /**
   * Send survey to customer via email
   */
  async sendSurveyEmail(
    userId: string,
    customerId: string,
    surveyType: SurveyType,
    recipientEmail: string,
    recipientName: string
  ): Promise<{ surveyUrl: string; draftId?: string }> {
    // Import gmail service dynamically to avoid circular dependency
    const { gmailService } = await import('./gmail.js');

    // Create the survey
    const survey = await this.createSurvey(userId, surveyType);

    // Generate personalized URL
    const surveyUrl = this.generateCustomerSurveyUrl(survey.formUrl, customerId, recipientName);

    // Store survey record
    await this.storeSurvey(userId, customerId, surveyType, survey.formId, survey.formUrl);

    // Create email draft
    const emailSubject = this.getSurveyEmailSubject(surveyType);
    const emailBody = this.getSurveyEmailBody(surveyType, recipientName, surveyUrl);

    const draft = await gmailService.createDraft(userId, {
      to: recipientEmail,
      subject: emailSubject,
      body: emailBody,
      isHtml: true
    });

    return {
      surveyUrl,
      draftId: draft.id
    };
  }

  private getSurveyEmailSubject(surveyType: SurveyType): string {
    const subjects: Record<SurveyType, string> = {
      nps_relational: 'We value your feedback - Quick survey',
      nps_transactional: 'How was your recent experience?',
      nps_employee: 'Employee Satisfaction Survey',
      csat: 'Share your satisfaction with us',
      ces: 'How easy was it to work with us?'
    };
    return subjects[surveyType];
  }

  private getSurveyEmailBody(surveyType: SurveyType, recipientName: string, surveyUrl: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Hi ${recipientName},</h2>

        <p>We'd love to hear your feedback! Your opinion helps us improve our service.</p>

        <p>Please take a moment to complete this short survey:</p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${surveyUrl}"
             style="background-color: #e63946; color: white; padding: 12px 30px;
                    text-decoration: none; border-radius: 5px; font-weight: bold;">
            Take Survey
          </a>
        </div>

        <p style="color: #666; font-size: 14px;">
          This survey takes less than 2 minutes to complete.
        </p>

        <p>Thank you for your time!</p>

        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

        <p style="color: #999; font-size: 12px;">
          If you have any questions, please don't hesitate to reach out.
        </p>
      </div>
    `;
  }

  /**
   * Get all survey templates
   */
  getSurveyTemplates(): Record<SurveyType, SurveyConfig> {
    return SURVEY_TEMPLATES;
  }

  /**
   * Get specific survey template
   */
  getSurveyTemplate(type: SurveyType): SurveyConfig {
    return SURVEY_TEMPLATES[type];
  }
}

export const surveyService = new SurveyService();
export default surveyService;
