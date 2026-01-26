/**
 * QBR Slides Generation Service
 * Generates comprehensive Quarterly Business Review presentations
 */

import { google, slides_v1 } from 'googleapis';
import { googleOAuth } from './oauth.js';
import { driveService } from './drive.js';
import { createClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import { calculateCustomerMetrics, categorizeHealthScore } from '../metrics.js';

const supabase = createClient(config.supabaseUrl!, config.supabaseServiceKey!);

// ============================================
// TYPES
// ============================================

export interface QBRData {
  customer: {
    id: string;
    name: string;
    industry?: string;
    segment?: string;
    csm?: string;
  };
  period: {
    quarter: string;
    year: number;
    startDate: string;
    endDate: string;
  };
  metrics: {
    arr: number;
    arrChange: number;
    healthScore: number;
    healthCategory: string;
    nps?: number;
    adoptionRate: number;
    dau: number;
    mau: number;
    licenseUtilization: number;
  };
  highlights: string[];
  challenges: string[];
  actionItems: Array<{
    task: string;
    owner: string;
    dueDate: string;
    status: string;
  }>;
  goals: Array<{
    objective: string;
    target: string;
    current: string;
    status: 'on_track' | 'at_risk' | 'behind';
  }>;
  expansion?: {
    opportunities: string[];
    potentialValue: number;
  };
}

export interface SlideResult {
  presentationId: string;
  presentationUrl: string;
  editUrl: string;
  thumbnailUrl?: string;
}

// ============================================
// COLOR SCHEME
// ============================================

const COLORS = {
  primary: { red: 0.902, green: 0.224, blue: 0.275 }, // #e63946
  secondary: { red: 0.1, green: 0.1, blue: 0.1 }, // Dark gray
  white: { red: 1, green: 1, blue: 1 },
  black: { red: 0, green: 0, blue: 0 },
  green: { red: 0.2, green: 0.6, blue: 0.2 },
  yellow: { red: 0.9, green: 0.7, blue: 0.1 },
  red: { red: 0.8, green: 0.2, blue: 0.2 },
  lightGray: { red: 0.95, green: 0.95, blue: 0.95 }
};

// ============================================
// QBR SLIDES SERVICE
// ============================================

class QBRSlidesService {
  /**
   * Generate a complete QBR presentation for a customer
   */
  async generateQBRPresentation(
    userId: string,
    customerId: string,
    quarter: string,
    year: number
  ): Promise<SlideResult> {
    const auth = await googleOAuth.getAuthenticatedClient(userId);
    const slides = google.slides({ version: 'v1', auth });

    // Fetch customer data
    const qbrData = await this.fetchQBRData(customerId, quarter, year);

    // Create presentation
    const presentation = await slides.presentations.create({
      requestBody: {
        title: `${qbrData.customer.name} - QBR ${quarter} ${year}`
      }
    });

    const presentationId = presentation.data.presentationId!;

    // Build all slide requests
    const requests: slides_v1.Schema$Request[] = [];

    // Get the default slide ID to delete later
    const defaultSlideId = presentation.data.slides?.[0]?.objectId;

    // Create slides
    const slideIds = {
      title: this.generateId('title'),
      executive: this.generateId('executive'),
      health: this.generateId('health'),
      usage: this.generateId('usage'),
      metrics: this.generateId('metrics'),
      highlights: this.generateId('highlights'),
      challenges: this.generateId('challenges'),
      goals: this.generateId('goals'),
      expansion: this.generateId('expansion'),
      actions: this.generateId('actions'),
      nextSteps: this.generateId('nextSteps')
    };

    // Create all slides first
    Object.values(slideIds).forEach((slideId, index) => {
      requests.push({
        createSlide: {
          objectId: slideId,
          insertionIndex: index,
          slideLayoutReference: { predefinedLayout: 'BLANK' }
        }
      });
    });

    // Delete the default slide
    if (defaultSlideId) {
      requests.push({
        deleteObject: { objectId: defaultSlideId }
      });
    }

    // Apply the slide creation first
    await slides.presentations.batchUpdate({
      presentationId,
      requestBody: { requests }
    });

    // Now add content to each slide
    const contentRequests: slides_v1.Schema$Request[] = [];

    // Slide 1: Title
    this.addTitleSlide(contentRequests, slideIds.title, qbrData);

    // Slide 2: Executive Summary
    this.addExecutiveSummarySlide(contentRequests, slideIds.executive, qbrData);

    // Slide 3: Health Score
    this.addHealthScoreSlide(contentRequests, slideIds.health, qbrData);

    // Slide 4: Usage & Adoption
    this.addUsageSlide(contentRequests, slideIds.usage, qbrData);

    // Slide 5: Key Metrics
    this.addMetricsSlide(contentRequests, slideIds.metrics, qbrData);

    // Slide 6: Highlights
    this.addHighlightsSlide(contentRequests, slideIds.highlights, qbrData);

    // Slide 7: Challenges
    this.addChallengesSlide(contentRequests, slideIds.challenges, qbrData);

    // Slide 8: Goals & Objectives
    this.addGoalsSlide(contentRequests, slideIds.goals, qbrData);

    // Slide 9: Expansion Opportunities
    if (qbrData.expansion) {
      this.addExpansionSlide(contentRequests, slideIds.expansion, qbrData);
    }

    // Slide 10: Action Items
    this.addActionItemsSlide(contentRequests, slideIds.actions, qbrData);

    // Slide 11: Next Steps
    this.addNextStepsSlide(contentRequests, slideIds.nextSteps, qbrData);

    // Apply content updates
    if (contentRequests.length > 0) {
      await slides.presentations.batchUpdate({
        presentationId,
        requestBody: { requests: contentRequests }
      });
    }

    // Move presentation to customer's QBR folder
    try {
      const { data: folderData } = await supabase
        .from('customer_workspace_folders')
        .select('qbrs_folder_id')
        .eq('customer_id', customerId)
        .single();

      if (folderData?.qbrs_folder_id) {
        await driveService.moveFile(userId, presentationId, folderData.qbrs_folder_id);
        console.log(`Moved QBR presentation to folder ${folderData.qbrs_folder_id}`);
      }
    } catch (moveError) {
      console.warn('Could not move QBR to customer folder:', moveError);
      // Continue anyway - presentation was created successfully
    }

    // Also save to customer_documents table
    try {
      await supabase.from('customer_documents').upsert({
        customer_id: customerId,
        document_type: 'qbr_deck',
        google_file_id: presentationId,
        name: `${qbrData.customer.name} - QBR ${quarter} ${year}`,
        file_type: 'slide',
        status: 'active',
        period: `${quarter} ${year}`,
        web_view_url: `https://docs.google.com/presentation/d/${presentationId}/present`,
        web_edit_url: `https://docs.google.com/presentation/d/${presentationId}/edit`,
      }, {
        onConflict: 'customer_id,document_type,period',
      });
    } catch (dbError) {
      console.warn('Could not save QBR to customer_documents:', dbError);
    }

    return {
      presentationId,
      presentationUrl: `https://docs.google.com/presentation/d/${presentationId}/present`,
      editUrl: `https://docs.google.com/presentation/d/${presentationId}/edit`
    };
  }

  /**
   * Fetch all data needed for QBR
   */
  private async fetchQBRData(
    customerId: string,
    quarter: string,
    year: number
  ): Promise<QBRData> {
    // Fetch customer
    const { data: customer } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();

    // Fetch metrics
    const customerMetrics = await calculateCustomerMetrics(customerId);

    // Fetch usage data
    const { data: usageData } = await supabase
      .from('usage_metrics')
      .select('*')
      .eq('customer_id', customerId)
      .order('metric_date', { ascending: false })
      .limit(90);

    const latestUsage = usageData?.[0];

    // Fetch expansion opportunities
    const { data: expansions } = await supabase
      .from('expansion_opportunities')
      .select('*')
      .eq('customer_id', customerId)
      .eq('stage', 'identified');

    return {
      customer: {
        id: customerId,
        name: customer?.name || 'Unknown Customer',
        industry: customer?.industry,
        segment: customer?.segment,
        csm: customer?.csm_name
      },
      period: {
        quarter,
        year,
        startDate: this.getQuarterStartDate(quarter, year),
        endDate: this.getQuarterEndDate(quarter, year)
      },
      metrics: {
        arr: customerMetrics.revenue.arr,
        arrChange: 0, // Would need historical comparison
        healthScore: customerMetrics.health.score,
        healthCategory: customerMetrics.health.category,
        nps: undefined, // Would fetch from survey responses
        adoptionRate: customerMetrics.adoption.productAdoptionRate,
        dau: customerMetrics.adoption.dau,
        mau: customerMetrics.adoption.mau,
        licenseUtilization: latestUsage?.active_users
          ? (latestUsage.active_users / (customer?.seats || 1)) * 100
          : 0
      },
      highlights: [
        'Successfully completed onboarding',
        'Strong adoption of core features',
        'Positive engagement from key stakeholders'
      ],
      challenges: [
        'Integration with existing systems',
        'User adoption in satellite offices',
        'Training completion rates below target'
      ],
      actionItems: [
        {
          task: 'Schedule advanced training session',
          owner: 'CSM',
          dueDate: this.getDateInDays(14),
          status: 'pending'
        },
        {
          task: 'Complete integration setup',
          owner: 'Solutions Engineer',
          dueDate: this.getDateInDays(30),
          status: 'in_progress'
        }
      ],
      goals: [
        {
          objective: 'Achieve 80% feature adoption',
          target: '80%',
          current: `${customerMetrics.adoption.productAdoptionRate.toFixed(0)}%`,
          status: customerMetrics.adoption.productAdoptionRate >= 80 ? 'on_track' : 'at_risk'
        },
        {
          objective: 'Maintain health score above 70',
          target: '70',
          current: customerMetrics.health.score.toString(),
          status: customerMetrics.health.score >= 70 ? 'on_track' : 'at_risk'
        }
      ],
      expansion: expansions && expansions.length > 0 ? {
        opportunities: expansions.map(e => e.product_line || 'Additional Services'),
        potentialValue: expansions.reduce((sum, e) => sum + (e.estimated_value || 0), 0)
      } : undefined
    };
  }

  /**
   * Add title slide content
   */
  private addTitleSlide(
    requests: slides_v1.Schema$Request[],
    slideId: string,
    data: QBRData
  ): void {
    // Title text
    const titleId = this.generateId('title_text');
    requests.push({
      createShape: {
        objectId: titleId,
        shapeType: 'TEXT_BOX',
        elementProperties: {
          pageObjectId: slideId,
          size: { width: { magnitude: 600, unit: 'PT' }, height: { magnitude: 80, unit: 'PT' } },
          transform: { scaleX: 1, scaleY: 1, translateX: 60, translateY: 150, unit: 'PT' }
        }
      }
    });

    requests.push({
      insertText: {
        objectId: titleId,
        text: `Quarterly Business Review\n${data.customer.name}`
      }
    });

    requests.push({
      updateTextStyle: {
        objectId: titleId,
        style: {
          fontSize: { magnitude: 36, unit: 'PT' },
          fontFamily: 'Arial',
          bold: true,
          foregroundColor: { opaqueColor: { rgbColor: COLORS.secondary } }
        },
        fields: 'fontSize,fontFamily,bold,foregroundColor'
      }
    });

    // Subtitle
    const subtitleId = this.generateId('subtitle');
    requests.push({
      createShape: {
        objectId: subtitleId,
        shapeType: 'TEXT_BOX',
        elementProperties: {
          pageObjectId: slideId,
          size: { width: { magnitude: 600, unit: 'PT' }, height: { magnitude: 40, unit: 'PT' } },
          transform: { scaleX: 1, scaleY: 1, translateX: 60, translateY: 250, unit: 'PT' }
        }
      }
    });

    requests.push({
      insertText: {
        objectId: subtitleId,
        text: `${data.period.quarter} ${data.period.year}`
      }
    });

    requests.push({
      updateTextStyle: {
        objectId: subtitleId,
        style: {
          fontSize: { magnitude: 24, unit: 'PT' },
          fontFamily: 'Arial',
          foregroundColor: { opaqueColor: { rgbColor: COLORS.primary } }
        },
        fields: 'fontSize,fontFamily,foregroundColor'
      }
    });
  }

  /**
   * Add executive summary slide
   */
  private addExecutiveSummarySlide(
    requests: slides_v1.Schema$Request[],
    slideId: string,
    data: QBRData
  ): void {
    this.addSlideTitle(requests, slideId, 'Executive Summary');

    const contentId = this.generateId('exec_content');
    requests.push({
      createShape: {
        objectId: contentId,
        shapeType: 'TEXT_BOX',
        elementProperties: {
          pageObjectId: slideId,
          size: { width: { magnitude: 600, unit: 'PT' }, height: { magnitude: 300, unit: 'PT' } },
          transform: { scaleX: 1, scaleY: 1, translateX: 60, translateY: 100, unit: 'PT' }
        }
      }
    });

    const summaryText = [
      `ARR: $${(data.metrics.arr / 1000).toFixed(0)}K`,
      `Health Score: ${data.metrics.healthScore}/100 (${data.metrics.healthCategory})`,
      `Adoption Rate: ${data.metrics.adoptionRate.toFixed(0)}%`,
      `License Utilization: ${data.metrics.licenseUtilization.toFixed(0)}%`,
      data.metrics.nps !== undefined ? `NPS: ${data.metrics.nps}` : ''
    ].filter(Boolean).join('\n');

    requests.push({
      insertText: {
        objectId: contentId,
        text: summaryText
      }
    });

    requests.push({
      updateTextStyle: {
        objectId: contentId,
        style: {
          fontSize: { magnitude: 18, unit: 'PT' },
          fontFamily: 'Arial'
        },
        fields: 'fontSize,fontFamily'
      }
    });
  }

  /**
   * Add health score slide
   */
  private addHealthScoreSlide(
    requests: slides_v1.Schema$Request[],
    slideId: string,
    data: QBRData
  ): void {
    this.addSlideTitle(requests, slideId, 'Customer Health Score');

    // Health score display
    const scoreId = this.generateId('health_score');
    requests.push({
      createShape: {
        objectId: scoreId,
        shapeType: 'TEXT_BOX',
        elementProperties: {
          pageObjectId: slideId,
          size: { width: { magnitude: 200, unit: 'PT' }, height: { magnitude: 100, unit: 'PT' } },
          transform: { scaleX: 1, scaleY: 1, translateX: 100, translateY: 150, unit: 'PT' }
        }
      }
    });

    requests.push({
      insertText: {
        objectId: scoreId,
        text: `${data.metrics.healthScore}`
      }
    });

    // Get color based on health category
    const healthColor = this.getHealthColor(data.metrics.healthCategory);

    requests.push({
      updateTextStyle: {
        objectId: scoreId,
        style: {
          fontSize: { magnitude: 72, unit: 'PT' },
          fontFamily: 'Arial',
          bold: true,
          foregroundColor: { opaqueColor: { rgbColor: healthColor } }
        },
        fields: 'fontSize,fontFamily,bold,foregroundColor'
      }
    });

    // Category label
    const categoryId = this.generateId('health_category');
    requests.push({
      createShape: {
        objectId: categoryId,
        shapeType: 'TEXT_BOX',
        elementProperties: {
          pageObjectId: slideId,
          size: { width: { magnitude: 200, unit: 'PT' }, height: { magnitude: 40, unit: 'PT' } },
          transform: { scaleX: 1, scaleY: 1, translateX: 100, translateY: 260, unit: 'PT' }
        }
      }
    });

    requests.push({
      insertText: {
        objectId: categoryId,
        text: data.metrics.healthCategory.toUpperCase()
      }
    });
  }

  /**
   * Add usage and adoption slide
   */
  private addUsageSlide(
    requests: slides_v1.Schema$Request[],
    slideId: string,
    data: QBRData
  ): void {
    this.addSlideTitle(requests, slideId, 'Usage & Adoption');

    const contentId = this.generateId('usage_content');
    requests.push({
      createShape: {
        objectId: contentId,
        shapeType: 'TEXT_BOX',
        elementProperties: {
          pageObjectId: slideId,
          size: { width: { magnitude: 600, unit: 'PT' }, height: { magnitude: 300, unit: 'PT' } },
          transform: { scaleX: 1, scaleY: 1, translateX: 60, translateY: 100, unit: 'PT' }
        }
      }
    });

    const usageText = [
      `Daily Active Users: ${data.metrics.dau}`,
      `Monthly Active Users: ${data.metrics.mau}`,
      `DAU/MAU Ratio: ${data.metrics.mau > 0 ? ((data.metrics.dau / data.metrics.mau) * 100).toFixed(1) : 0}%`,
      `License Utilization: ${data.metrics.licenseUtilization.toFixed(1)}%`,
      `Product Adoption Rate: ${data.metrics.adoptionRate.toFixed(1)}%`
    ].join('\n\n');

    requests.push({
      insertText: {
        objectId: contentId,
        text: usageText
      }
    });
  }

  /**
   * Add metrics slide
   */
  private addMetricsSlide(
    requests: slides_v1.Schema$Request[],
    slideId: string,
    data: QBRData
  ): void {
    this.addSlideTitle(requests, slideId, 'Key Metrics');

    const contentId = this.generateId('metrics_content');
    requests.push({
      createShape: {
        objectId: contentId,
        shapeType: 'TEXT_BOX',
        elementProperties: {
          pageObjectId: slideId,
          size: { width: { magnitude: 600, unit: 'PT' }, height: { magnitude: 300, unit: 'PT' } },
          transform: { scaleX: 1, scaleY: 1, translateX: 60, translateY: 100, unit: 'PT' }
        }
      }
    });

    const arrFormatted = data.metrics.arr >= 1000000
      ? `$${(data.metrics.arr / 1000000).toFixed(2)}M`
      : `$${(data.metrics.arr / 1000).toFixed(0)}K`;

    const metricsText = [
      `Annual Recurring Revenue: ${arrFormatted}`,
      `Health Score: ${data.metrics.healthScore}/100`,
      data.metrics.nps !== undefined ? `Net Promoter Score: ${data.metrics.nps}` : null,
      `Product Adoption: ${data.metrics.adoptionRate.toFixed(0)}%`
    ].filter(Boolean).join('\n\n');

    requests.push({
      insertText: {
        objectId: contentId,
        text: metricsText
      }
    });
  }

  /**
   * Add highlights slide
   */
  private addHighlightsSlide(
    requests: slides_v1.Schema$Request[],
    slideId: string,
    data: QBRData
  ): void {
    this.addSlideTitle(requests, slideId, 'Highlights & Wins');

    const contentId = this.generateId('highlights_content');
    requests.push({
      createShape: {
        objectId: contentId,
        shapeType: 'TEXT_BOX',
        elementProperties: {
          pageObjectId: slideId,
          size: { width: { magnitude: 600, unit: 'PT' }, height: { magnitude: 300, unit: 'PT' } },
          transform: { scaleX: 1, scaleY: 1, translateX: 60, translateY: 100, unit: 'PT' }
        }
      }
    });

    const highlightsText = data.highlights.map(h => `• ${h}`).join('\n\n');

    requests.push({
      insertText: {
        objectId: contentId,
        text: highlightsText
      }
    });
  }

  /**
   * Add challenges slide
   */
  private addChallengesSlide(
    requests: slides_v1.Schema$Request[],
    slideId: string,
    data: QBRData
  ): void {
    this.addSlideTitle(requests, slideId, 'Challenges & Focus Areas');

    const contentId = this.generateId('challenges_content');
    requests.push({
      createShape: {
        objectId: contentId,
        shapeType: 'TEXT_BOX',
        elementProperties: {
          pageObjectId: slideId,
          size: { width: { magnitude: 600, unit: 'PT' }, height: { magnitude: 300, unit: 'PT' } },
          transform: { scaleX: 1, scaleY: 1, translateX: 60, translateY: 100, unit: 'PT' }
        }
      }
    });

    const challengesText = data.challenges.map(c => `• ${c}`).join('\n\n');

    requests.push({
      insertText: {
        objectId: contentId,
        text: challengesText
      }
    });
  }

  /**
   * Add goals slide
   */
  private addGoalsSlide(
    requests: slides_v1.Schema$Request[],
    slideId: string,
    data: QBRData
  ): void {
    this.addSlideTitle(requests, slideId, 'Goals & Objectives');

    const contentId = this.generateId('goals_content');
    requests.push({
      createShape: {
        objectId: contentId,
        shapeType: 'TEXT_BOX',
        elementProperties: {
          pageObjectId: slideId,
          size: { width: { magnitude: 600, unit: 'PT' }, height: { magnitude: 300, unit: 'PT' } },
          transform: { scaleX: 1, scaleY: 1, translateX: 60, translateY: 100, unit: 'PT' }
        }
      }
    });

    const goalsText = data.goals.map(g => {
      const statusIcon = g.status === 'on_track' ? '✓' : g.status === 'at_risk' ? '⚠' : '✗';
      return `${statusIcon} ${g.objective}\n   Target: ${g.target} | Current: ${g.current}`;
    }).join('\n\n');

    requests.push({
      insertText: {
        objectId: contentId,
        text: goalsText
      }
    });
  }

  /**
   * Add expansion opportunities slide
   */
  private addExpansionSlide(
    requests: slides_v1.Schema$Request[],
    slideId: string,
    data: QBRData
  ): void {
    this.addSlideTitle(requests, slideId, 'Expansion Opportunities');

    const contentId = this.generateId('expansion_content');
    requests.push({
      createShape: {
        objectId: contentId,
        shapeType: 'TEXT_BOX',
        elementProperties: {
          pageObjectId: slideId,
          size: { width: { magnitude: 600, unit: 'PT' }, height: { magnitude: 300, unit: 'PT' } },
          transform: { scaleX: 1, scaleY: 1, translateX: 60, translateY: 100, unit: 'PT' }
        }
      }
    });

    const opportunitiesText = data.expansion?.opportunities.map(o => `• ${o}`).join('\n') || '';
    const valueText = data.expansion?.potentialValue
      ? `\n\nPotential Value: $${(data.expansion.potentialValue / 1000).toFixed(0)}K`
      : '';

    requests.push({
      insertText: {
        objectId: contentId,
        text: opportunitiesText + valueText
      }
    });
  }

  /**
   * Add action items slide
   */
  private addActionItemsSlide(
    requests: slides_v1.Schema$Request[],
    slideId: string,
    data: QBRData
  ): void {
    this.addSlideTitle(requests, slideId, 'Action Items');

    const contentId = this.generateId('actions_content');
    requests.push({
      createShape: {
        objectId: contentId,
        shapeType: 'TEXT_BOX',
        elementProperties: {
          pageObjectId: slideId,
          size: { width: { magnitude: 600, unit: 'PT' }, height: { magnitude: 300, unit: 'PT' } },
          transform: { scaleX: 1, scaleY: 1, translateX: 60, translateY: 100, unit: 'PT' }
        }
      }
    });

    const actionsText = data.actionItems.map((item, i) =>
      `${i + 1}. ${item.task}\n   Owner: ${item.owner} | Due: ${item.dueDate}`
    ).join('\n\n');

    requests.push({
      insertText: {
        objectId: contentId,
        text: actionsText
      }
    });
  }

  /**
   * Add next steps slide
   */
  private addNextStepsSlide(
    requests: slides_v1.Schema$Request[],
    slideId: string,
    data: QBRData
  ): void {
    this.addSlideTitle(requests, slideId, 'Next Steps');

    const contentId = this.generateId('nextsteps_content');
    requests.push({
      createShape: {
        objectId: contentId,
        shapeType: 'TEXT_BOX',
        elementProperties: {
          pageObjectId: slideId,
          size: { width: { magnitude: 600, unit: 'PT' }, height: { magnitude: 300, unit: 'PT' } },
          transform: { scaleX: 1, scaleY: 1, translateX: 60, translateY: 100, unit: 'PT' }
        }
      }
    });

    const nextStepsText = [
      '• Schedule follow-up meeting to review action items',
      '• Share QBR summary with all stakeholders',
      '• Begin execution of agreed-upon initiatives',
      `• Next QBR: ${this.getNextQuarter(data.period.quarter)} ${data.period.year}`
    ].join('\n\n');

    requests.push({
      insertText: {
        objectId: contentId,
        text: nextStepsText
      }
    });
  }

  /**
   * Add slide title helper
   */
  private addSlideTitle(
    requests: slides_v1.Schema$Request[],
    slideId: string,
    title: string
  ): void {
    const titleId = this.generateId('slide_title');
    requests.push({
      createShape: {
        objectId: titleId,
        shapeType: 'TEXT_BOX',
        elementProperties: {
          pageObjectId: slideId,
          size: { width: { magnitude: 600, unit: 'PT' }, height: { magnitude: 50, unit: 'PT' } },
          transform: { scaleX: 1, scaleY: 1, translateX: 60, translateY: 30, unit: 'PT' }
        }
      }
    });

    requests.push({
      insertText: {
        objectId: titleId,
        text: title
      }
    });

    requests.push({
      updateTextStyle: {
        objectId: titleId,
        style: {
          fontSize: { magnitude: 28, unit: 'PT' },
          fontFamily: 'Arial',
          bold: true,
          foregroundColor: { opaqueColor: { rgbColor: COLORS.primary } }
        },
        fields: 'fontSize,fontFamily,bold,foregroundColor'
      }
    });
  }

  /**
   * Generate unique ID for slide elements
   */
  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Get color based on health category
   */
  private getHealthColor(category: string): slides_v1.Schema$RgbColor {
    switch (category.toLowerCase()) {
      case 'champion':
      case 'healthy':
        return COLORS.green;
      case 'neutral':
        return COLORS.yellow;
      case 'at_risk':
      case 'critical':
        return COLORS.red;
      default:
        return COLORS.secondary;
    }
  }

  /**
   * Get quarter start date
   */
  private getQuarterStartDate(quarter: string, year: number): string {
    const quarterStarts: Record<string, string> = {
      'Q1': `${year}-01-01`,
      'Q2': `${year}-04-01`,
      'Q3': `${year}-07-01`,
      'Q4': `${year}-10-01`
    };
    return quarterStarts[quarter] || `${year}-01-01`;
  }

  /**
   * Get quarter end date
   */
  private getQuarterEndDate(quarter: string, year: number): string {
    const quarterEnds: Record<string, string> = {
      'Q1': `${year}-03-31`,
      'Q2': `${year}-06-30`,
      'Q3': `${year}-09-30`,
      'Q4': `${year}-12-31`
    };
    return quarterEnds[quarter] || `${year}-12-31`;
  }

  /**
   * Get next quarter
   */
  private getNextQuarter(currentQuarter: string): string {
    const nextQuarters: Record<string, string> = {
      'Q1': 'Q2',
      'Q2': 'Q3',
      'Q3': 'Q4',
      'Q4': 'Q1'
    };
    return nextQuarters[currentQuarter] || 'Q1';
  }

  /**
   * Get date in X days
   */
  private getDateInDays(days: number): string {
    const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    return date.toISOString().split('T')[0];
  }
}

export const qbrSlidesService = new QBRSlidesService();
export default qbrSlidesService;
