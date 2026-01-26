/**
 * Google Slides Service
 * Handles Google Slides API operations: create, read, update presentations
 */

import { google, slides_v1 } from 'googleapis';
import { googleOAuth } from './oauth.js';
import { driveService } from './drive.js';
import { config } from '../../config/index.js';

// Types
export interface GooglePresentation {
  id: string;
  title: string;
  slides: SlideInfo[];
  webViewLink?: string;
  createdAt?: Date;
  modifiedAt?: Date;
}

export interface SlideInfo {
  id: string;
  index: number;
  layout?: string;
}

export interface SlideTemplate {
  type: 'qbr' | 'kickoff' | 'training' | 'executive_briefing' | 'renewal' |
        'value_summary' | 'roadmap' | 'escalation' | 'adoption_report';
  variables: Record<string, string>;
}

export interface CreatePresentationOptions {
  title: string;
  folderId?: string;
  template?: SlideTemplate;
}

export interface SlideContent {
  title?: string;
  subtitle?: string;
  body?: string[];
  bullets?: string[];
  imageUrl?: string;
  layout?: 'TITLE' | 'TITLE_AND_BODY' | 'TITLE_AND_TWO_COLUMNS' | 'BLANK' | 'SECTION_HEADER';
}

// Slide templates
const SLIDE_TEMPLATES: Record<string, SlideContent[]> = {
  qbr: [
    { title: '{{customerName}}', subtitle: 'Quarterly Business Review - {{quarter}} {{year}}', layout: 'TITLE' },
    { title: 'Agenda', bullets: ['Executive Summary', 'Key Achievements', 'Usage & Adoption', 'Support Overview', 'Roadmap', 'Action Items'], layout: 'TITLE_AND_BODY' },
    { title: 'Executive Summary', body: ['{{executiveSummary}}'], layout: 'TITLE_AND_BODY' },
    { title: 'Key Achievements', bullets: ['{{achievement1}}', '{{achievement2}}', '{{achievement3}}'], layout: 'TITLE_AND_BODY' },
    { title: 'Product Usage', body: ['{{usageMetrics}}'], layout: 'TITLE_AND_BODY' },
    { title: 'Support & Engagement', body: ['{{supportMetrics}}'], layout: 'TITLE_AND_BODY' },
    { title: 'Product Roadmap', body: ['{{roadmap}}'], layout: 'TITLE_AND_BODY' },
    { title: 'Action Items & Next Steps', bullets: ['{{actionItem1}}', '{{actionItem2}}', '{{actionItem3}}'], layout: 'TITLE_AND_BODY' },
    { title: 'Thank You', subtitle: 'Questions?', layout: 'TITLE' },
  ],
  kickoff: [
    { title: 'Welcome {{customerName}}!', subtitle: 'Kickoff Meeting', layout: 'TITLE' },
    { title: 'Agenda', bullets: ['Introductions', 'Project Overview', 'Success Criteria', 'Timeline & Milestones', 'Team & Responsibilities', 'Next Steps'], layout: 'TITLE_AND_BODY' },
    { title: 'Team Introductions', body: ['{{teamIntros}}'], layout: 'TITLE_AND_BODY' },
    { title: 'Project Overview', body: ['{{projectOverview}}'], layout: 'TITLE_AND_BODY' },
    { title: 'Success Criteria', bullets: ['{{success1}}', '{{success2}}', '{{success3}}'], layout: 'TITLE_AND_BODY' },
    { title: 'Timeline', body: ['{{timeline}}'], layout: 'TITLE_AND_BODY' },
    { title: 'Key Milestones', bullets: ['{{milestone1}}', '{{milestone2}}', '{{milestone3}}', '{{milestone4}}'], layout: 'TITLE_AND_BODY' },
    { title: 'Roles & Responsibilities', body: ['{{roles}}'], layout: 'TITLE_AND_BODY' },
    { title: 'Next Steps', bullets: ['{{nextStep1}}', '{{nextStep2}}', '{{nextStep3}}'], layout: 'TITLE_AND_BODY' },
    { title: "Let's Get Started!", subtitle: 'Questions?', layout: 'TITLE' },
  ],
  training: [
    { title: '{{trainingTitle}}', subtitle: '{{customerName}} Training Session', layout: 'TITLE' },
    { title: 'Learning Objectives', bullets: ['{{objective1}}', '{{objective2}}', '{{objective3}}'], layout: 'TITLE_AND_BODY' },
    { title: 'Agenda', bullets: ['{{agendaItem1}}', '{{agendaItem2}}', '{{agendaItem3}}', '{{agendaItem4}}'], layout: 'TITLE_AND_BODY' },
    { title: 'Module 1: {{module1Title}}', body: ['{{module1Content}}'], layout: 'TITLE_AND_BODY' },
    { title: 'Module 2: {{module2Title}}', body: ['{{module2Content}}'], layout: 'TITLE_AND_BODY' },
    { title: 'Module 3: {{module3Title}}', body: ['{{module3Content}}'], layout: 'TITLE_AND_BODY' },
    { title: 'Best Practices', bullets: ['{{practice1}}', '{{practice2}}', '{{practice3}}'], layout: 'TITLE_AND_BODY' },
    { title: 'Resources & Support', body: ['{{resources}}'], layout: 'TITLE_AND_BODY' },
    { title: 'Q&A', subtitle: 'Questions?', layout: 'TITLE' },
  ],
  executive_briefing: [
    { title: '{{customerName}}', subtitle: 'Executive Briefing - {{date}}', layout: 'TITLE' },
    { title: 'Partnership Overview', body: ['{{partnershipOverview}}'], layout: 'TITLE_AND_BODY' },
    { title: 'Key Metrics', bullets: ['ARR: {{arr}}', 'Health Score: {{healthScore}}', 'NPS: {{nps}}'], layout: 'TITLE_AND_BODY' },
    { title: 'Business Impact', body: ['{{businessImpact}}'], layout: 'TITLE_AND_BODY' },
    { title: 'Strategic Initiatives', bullets: ['{{initiative1}}', '{{initiative2}}', '{{initiative3}}'], layout: 'TITLE_AND_BODY' },
    { title: 'Opportunities', body: ['{{opportunities}}'], layout: 'TITLE_AND_BODY' },
    { title: 'Recommendations', bullets: ['{{recommendation1}}', '{{recommendation2}}', '{{recommendation3}}'], layout: 'TITLE_AND_BODY' },
    { title: 'Next Steps', body: ['{{nextSteps}}'], layout: 'TITLE_AND_BODY' },
  ],
  renewal: [
    { title: '{{customerName}}', subtitle: 'Renewal Proposal', layout: 'TITLE' },
    { title: 'Partnership Summary', body: ['{{summary}}'], layout: 'TITLE_AND_BODY' },
    { title: 'Value Delivered', bullets: ['{{value1}}', '{{value2}}', '{{value3}}'], layout: 'TITLE_AND_BODY' },
    { title: 'ROI Highlights', body: ['{{roiHighlights}}'], layout: 'TITLE_AND_BODY' },
    { title: 'Looking Ahead', body: ['{{lookingAhead}}'], layout: 'TITLE_AND_BODY' },
    { title: 'Renewal Terms', body: ['{{terms}}'], layout: 'TITLE_AND_BODY' },
    { title: 'Expansion Opportunities', bullets: ['{{expansion1}}', '{{expansion2}}'], layout: 'TITLE_AND_BODY' },
    { title: 'Next Steps', bullets: ['{{renewalStep1}}', '{{renewalStep2}}', '{{renewalStep3}}'], layout: 'TITLE_AND_BODY' },
  ],
  value_summary: [
    { title: '{{customerName}}', subtitle: 'Value Summary Report', layout: 'TITLE' },
    { title: 'Executive Overview', body: ['{{overview}}'], layout: 'TITLE_AND_BODY' },
    { title: 'Key Metrics', bullets: ['{{metric1}}', '{{metric2}}', '{{metric3}}', '{{metric4}}'], layout: 'TITLE_AND_BODY' },
    { title: 'Business Outcomes', body: ['{{outcomes}}'], layout: 'TITLE_AND_BODY' },
    { title: 'Time & Cost Savings', body: ['{{savings}}'], layout: 'TITLE_AND_BODY' },
    { title: 'Success Stories', body: ['{{successStories}}'], layout: 'TITLE_AND_BODY' },
    { title: 'Future Potential', body: ['{{potential}}'], layout: 'TITLE_AND_BODY' },
  ],
  escalation: [
    { title: '{{customerName}} - Escalation', subtitle: 'Priority: {{priority}}', layout: 'TITLE' },
    { title: 'Issue Summary', body: ['{{issueSummary}}'], layout: 'TITLE_AND_BODY' },
    { title: 'Business Impact', bullets: ['{{impact1}}', '{{impact2}}', '{{impact3}}'], layout: 'TITLE_AND_BODY' },
    { title: 'Timeline', body: ['{{timeline}}'], layout: 'TITLE_AND_BODY' },
    { title: 'Root Cause', body: ['{{rootCause}}'], layout: 'TITLE_AND_BODY' },
    { title: 'Resolution Plan', bullets: ['{{action1}}', '{{action2}}', '{{action3}}'], layout: 'TITLE_AND_BODY' },
    { title: 'Resources Required', body: ['{{resources}}'], layout: 'TITLE_AND_BODY' },
    { title: 'Ask', body: ['{{ask}}'], layout: 'TITLE_AND_BODY' },
  ],
  adoption_report: [
    { title: '{{customerName}}', subtitle: 'Adoption Report - {{period}}', layout: 'TITLE' },
    { title: 'Adoption Overview', body: ['{{overview}}'], layout: 'TITLE_AND_BODY' },
    { title: 'Key Metrics', bullets: ['Active Users: {{activeUsers}}', 'Adoption Rate: {{adoptionRate}}', 'Feature Usage: {{featureUsage}}'], layout: 'TITLE_AND_BODY' },
    { title: 'Feature Adoption', body: ['{{featureAdoption}}'], layout: 'TITLE_AND_BODY' },
    { title: 'User Engagement', body: ['{{engagement}}'], layout: 'TITLE_AND_BODY' },
    { title: 'Training Completion', body: ['{{training}}'], layout: 'TITLE_AND_BODY' },
    { title: 'Recommendations', bullets: ['{{rec1}}', '{{rec2}}', '{{rec3}}'], layout: 'TITLE_AND_BODY' },
    { title: 'Next Steps', body: ['{{nextSteps}}'], layout: 'TITLE_AND_BODY' },
  ],
};

export class SlidesService {
  /**
   * Get Google Slides API client for a user
   */
  private async getSlidesClient(userId: string): Promise<slides_v1.Slides> {
    const auth = await googleOAuth.getAuthenticatedClient(userId);
    return google.slides({ version: 'v1', auth });
  }

  /**
   * Create a new presentation
   */
  async createPresentation(userId: string, options: CreatePresentationOptions): Promise<GooglePresentation> {
    const slides = await this.getSlidesClient(userId);

    // Create the presentation
    const createResponse = await slides.presentations.create({
      requestBody: {
        title: options.title,
      },
    });

    const presentationId = createResponse.data.presentationId;
    if (!presentationId) {
      throw new Error('Failed to create presentation');
    }

    // Move to specified folder or default CSCX folder
    const targetFolderId = options.folderId || config.google.defaultFolderId;
    if (targetFolderId) {
      await driveService.moveFile(userId, presentationId, targetFolderId);
    }

    // Apply template if provided
    if (options.template) {
      await this.applyTemplate(userId, presentationId, options.template);
    }

    return this.getPresentation(userId, presentationId);
  }

  /**
   * Get a presentation by ID
   */
  async getPresentation(userId: string, presentationId: string): Promise<GooglePresentation> {
    const slides = await this.getSlidesClient(userId);

    const response = await slides.presentations.get({
      presentationId,
    });

    const presentation = response.data;

    // Get file metadata from Drive
    const fileInfo = await driveService.getFile(userId, presentationId);

    return {
      id: presentation.presentationId || presentationId,
      title: presentation.title || 'Untitled',
      slides: (presentation.slides || []).map((slide, index) => ({
        id: slide.objectId || '',
        index,
        layout: slide.slideProperties?.layoutObjectId,
      })),
      webViewLink: `https://docs.google.com/presentation/d/${presentationId}/edit`,
      createdAt: fileInfo.createdTime,
      modifiedAt: fileInfo.modifiedTime,
    };
  }

  /**
   * Apply a template to a presentation
   */
  async applyTemplate(userId: string, presentationId: string, template: SlideTemplate): Promise<void> {
    const templateSlides = SLIDE_TEMPLATES[template.type];
    if (!templateSlides) {
      throw new Error(`Unknown template type: ${template.type}`);
    }

    // Get current presentation to get the first slide ID (to delete later)
    const presentation = await this.getPresentation(userId, presentationId);
    const firstSlideId = presentation.slides[0]?.id;

    // Add slides from template
    for (let i = 0; i < templateSlides.length; i++) {
      const slideContent = templateSlides[i];
      await this.addSlide(userId, presentationId, {
        ...slideContent,
        title: slideContent.title ? this.replaceVariables(slideContent.title, template.variables) : undefined,
        subtitle: slideContent.subtitle ? this.replaceVariables(slideContent.subtitle, template.variables) : undefined,
        body: slideContent.body?.map(b => this.replaceVariables(b, template.variables)),
        bullets: slideContent.bullets?.map(b => this.replaceVariables(b, template.variables)),
      });
    }

    // Delete the initial blank slide
    if (firstSlideId) {
      await this.deleteSlide(userId, presentationId, firstSlideId);
    }
  }

  /**
   * Add a slide to the presentation
   */
  async addSlide(userId: string, presentationId: string, content: SlideContent): Promise<string> {
    const slides = await this.getSlidesClient(userId);

    // Generate unique IDs
    const slideId = `slide_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const titleId = `title_${Date.now()}`;
    const subtitleId = `subtitle_${Date.now()}`;
    const bodyId = `body_${Date.now()}`;

    const requests: slides_v1.Schema$Request[] = [];

    // Create slide
    requests.push({
      createSlide: {
        objectId: slideId,
        slideLayoutReference: {
          predefinedLayout: this.mapLayoutType(content.layout),
        },
        placeholderIdMappings: [
          { layoutPlaceholder: { type: 'TITLE' }, objectId: titleId },
          { layoutPlaceholder: { type: 'SUBTITLE' }, objectId: subtitleId },
          { layoutPlaceholder: { type: 'BODY' }, objectId: bodyId },
        ],
      },
    });

    await slides.presentations.batchUpdate({
      presentationId,
      requestBody: { requests },
    });

    // Add content to placeholders
    const contentRequests: slides_v1.Schema$Request[] = [];

    if (content.title) {
      contentRequests.push({
        insertText: {
          objectId: titleId,
          text: content.title,
        },
      });
    }

    if (content.subtitle) {
      contentRequests.push({
        insertText: {
          objectId: subtitleId,
          text: content.subtitle,
        },
      });
    }

    if (content.body && content.body.length > 0) {
      contentRequests.push({
        insertText: {
          objectId: bodyId,
          text: content.body.join('\n\n'),
        },
      });
    }

    if (content.bullets && content.bullets.length > 0) {
      const bulletText = content.bullets.map(b => `• ${b}`).join('\n');
      contentRequests.push({
        insertText: {
          objectId: bodyId,
          text: bulletText,
        },
      });
    }

    if (contentRequests.length > 0) {
      try {
        await slides.presentations.batchUpdate({
          presentationId,
          requestBody: { requests: contentRequests },
        });
      } catch (error) {
        // Placeholder might not exist for some layouts, continue
        console.warn('Could not insert content:', error);
      }
    }

    return slideId;
  }

  /**
   * Delete a slide
   */
  async deleteSlide(userId: string, presentationId: string, slideId: string): Promise<void> {
    const slides = await this.getSlidesClient(userId);

    await slides.presentations.batchUpdate({
      presentationId,
      requestBody: {
        requests: [{
          deleteObject: {
            objectId: slideId,
          },
        }],
      },
    });
  }

  /**
   * Update slide content
   */
  async updateSlide(
    userId: string,
    presentationId: string,
    slideId: string,
    content: SlideContent
  ): Promise<void> {
    // For simplicity, delete and recreate the slide
    // In production, you'd want to update in place
    await this.deleteSlide(userId, presentationId, slideId);
    await this.addSlide(userId, presentationId, content);
  }

  /**
   * Replace text in presentation
   */
  async replaceText(
    userId: string,
    presentationId: string,
    findText: string,
    replaceText: string
  ): Promise<void> {
    const slides = await this.getSlidesClient(userId);

    await slides.presentations.batchUpdate({
      presentationId,
      requestBody: {
        requests: [{
          replaceAllText: {
            containsText: {
              text: findText,
              matchCase: false,
            },
            replaceText,
          },
        }],
      },
    });
  }

  /**
   * Export presentation as PDF
   */
  async exportAsPdf(userId: string, presentationId: string): Promise<Buffer> {
    return driveService.exportFile(userId, presentationId, 'application/pdf');
  }

  /**
   * Export presentation as PowerPoint
   */
  async exportAsPowerPoint(userId: string, presentationId: string): Promise<Buffer> {
    return driveService.exportFile(
      userId,
      presentationId,
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    );
  }

  /**
   * Copy presentation
   */
  async copyPresentation(
    userId: string,
    presentationId: string,
    newTitle: string,
    folderId?: string
  ): Promise<GooglePresentation> {
    const newFileId = await driveService.copyFile(userId, presentationId, newTitle, folderId);
    return this.getPresentation(userId, newFileId);
  }

  /**
   * Share presentation
   */
  async sharePresentation(
    userId: string,
    presentationId: string,
    email: string,
    role: 'reader' | 'writer' | 'commenter' = 'reader'
  ): Promise<void> {
    await driveService.shareFile(userId, presentationId, email, role);
  }

  /**
   * Create presentation from template
   */
  async createFromTemplate(
    userId: string,
    templateType: SlideTemplate['type'],
    variables: Record<string, string>,
    folderId?: string
  ): Promise<GooglePresentation> {
    const title = variables.customerName
      ? `${variables.customerName} - ${this.formatTemplateTitle(templateType)}`
      : this.formatTemplateTitle(templateType);

    return this.createPresentation(userId, {
      title,
      folderId,
      template: {
        type: templateType,
        variables,
      },
    });
  }

  /**
   * Add speaker notes to a slide
   */
  async addSpeakerNotes(
    userId: string,
    presentationId: string,
    slideId: string,
    notes: string
  ): Promise<void> {
    const slides = await this.getSlidesClient(userId);

    // Get the slide to find the notes page
    const presentation = await slides.presentations.get({
      presentationId,
    });

    const slide = presentation.data.slides?.find(s => s.objectId === slideId);
    const notesPageId = slide?.slideProperties?.notesPage?.objectId;

    if (!notesPageId) {
      console.warn('Could not find notes page for slide');
      return;
    }

    // Find the body shape in the notes page
    const notesPage = presentation.data.slides?.find(s => s.objectId === notesPageId);
    const bodyShape = notesPage?.pageElements?.find(
      e => e.shape?.placeholder?.type === 'BODY'
    );

    if (!bodyShape?.objectId) {
      console.warn('Could not find notes body shape');
      return;
    }

    await slides.presentations.batchUpdate({
      presentationId,
      requestBody: {
        requests: [{
          insertText: {
            objectId: bodyShape.objectId,
            text: notes,
          },
        }],
      },
    });
  }

  /**
   * Map layout type to predefined layout
   */
  private mapLayoutType(layout?: SlideContent['layout']): string {
    switch (layout) {
      case 'TITLE':
        return 'TITLE';
      case 'TITLE_AND_BODY':
        return 'TITLE_AND_BODY';
      case 'TITLE_AND_TWO_COLUMNS':
        return 'TITLE_AND_TWO_COLUMNS';
      case 'SECTION_HEADER':
        return 'SECTION_HEADER';
      case 'BLANK':
      default:
        return 'BLANK';
    }
  }

  /**
   * Replace variables in text
   */
  private replaceVariables(text: string, variables: Record<string, string>): string {
    let result = text;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
    }
    return result;
  }

  /**
   * Format template type to readable title
   */
  private formatTemplateTitle(type: string): string {
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}

// Singleton instance
export const slidesService = new SlidesService();
