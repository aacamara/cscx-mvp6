/**
 * Google Docs Service
 * Handles Google Docs API operations: create, read, update, export documents
 */

import { google, docs_v1 } from 'googleapis';
import { googleOAuth } from './oauth.js';
import { driveService } from './drive.js';
import { config } from '../../config/index.js';

// Types
export interface GoogleDoc {
  id: string;
  title: string;
  content?: string;
  revisionId?: string;
  createdAt?: Date;
  modifiedAt?: Date;
  webViewLink?: string;
}

export interface DocSection {
  heading?: string;
  content: string;
  style?: 'NORMAL_TEXT' | 'HEADING_1' | 'HEADING_2' | 'HEADING_3' | 'TITLE' | 'SUBTITLE';
}

export interface DocTemplate {
  type: 'qbr' | 'meeting_notes' | 'proposal' | 'executive_summary' | 'customer_report' |
        'onboarding_plan' | 'success_plan' | 'renewal_proposal' | 'escalation_report' |
        'value_summary' | 'account_plan' | 'save_play';
  variables: Record<string, string>;
}

export interface CreateDocOptions {
  title: string;
  folderId?: string;
  content?: string;
  sections?: DocSection[];
  template?: DocTemplate;
}

export interface UpdateDocOptions {
  appendContent?: string;
  replaceContent?: string;
  insertAtIndex?: number;
  sections?: DocSection[];
}

// Document templates
const DOC_TEMPLATES: Record<string, DocSection[]> = {
  qbr: [
    { content: '{{customerName}} - Quarterly Business Review', style: 'TITLE' },
    { content: '{{quarter}} {{year}}', style: 'SUBTITLE' },
    { heading: 'Executive Summary', content: '{{executiveSummary}}', style: 'HEADING_1' },
    { heading: 'Key Achievements', content: '{{achievements}}', style: 'HEADING_1' },
    { heading: 'Product Usage & Adoption', content: '{{usageMetrics}}', style: 'HEADING_1' },
    { heading: 'Support & Engagement', content: '{{supportMetrics}}', style: 'HEADING_1' },
    { heading: 'Roadmap & Opportunities', content: '{{roadmap}}', style: 'HEADING_1' },
    { heading: 'Action Items', content: '{{actionItems}}', style: 'HEADING_1' },
    { heading: 'Next Steps', content: '{{nextSteps}}', style: 'HEADING_1' },
  ],
  meeting_notes: [
    { content: 'Meeting Notes: {{meetingTitle}}', style: 'TITLE' },
    { content: '{{date}} | {{attendees}}', style: 'SUBTITLE' },
    { heading: 'Agenda', content: '{{agenda}}', style: 'HEADING_1' },
    { heading: 'Discussion', content: '{{discussion}}', style: 'HEADING_1' },
    { heading: 'Decisions', content: '{{decisions}}', style: 'HEADING_1' },
    { heading: 'Action Items', content: '{{actionItems}}', style: 'HEADING_1' },
    { heading: 'Next Meeting', content: '{{nextMeeting}}', style: 'HEADING_1' },
  ],
  onboarding_plan: [
    { content: '{{customerName}} - Onboarding Plan', style: 'TITLE' },
    { content: '{{timelineDays}} Day Plan', style: 'SUBTITLE' },
    { heading: 'Overview', content: '{{overview}}', style: 'HEADING_1' },
    { heading: 'Success Criteria', content: '{{successCriteria}}', style: 'HEADING_1' },
    { heading: 'Phase 1: Foundation (Days 1-30)', content: '{{phase1}}', style: 'HEADING_1' },
    { heading: 'Phase 2: Adoption (Days 31-60)', content: '{{phase2}}', style: 'HEADING_1' },
    { heading: 'Phase 3: Optimization (Days 61-90)', content: '{{phase3}}', style: 'HEADING_1' },
    { heading: 'Key Milestones', content: '{{milestones}}', style: 'HEADING_1' },
    { heading: 'Risk Factors', content: '{{riskFactors}}', style: 'HEADING_1' },
    { heading: 'Stakeholders', content: '{{stakeholders}}', style: 'HEADING_1' },
  ],
  success_plan: [
    { content: '{{customerName}} - Customer Success Plan', style: 'TITLE' },
    { content: 'Strategic Partnership Plan', style: 'SUBTITLE' },
    { heading: 'Business Objectives', content: '{{objectives}}', style: 'HEADING_1' },
    { heading: 'Success Metrics', content: '{{metrics}}', style: 'HEADING_1' },
    { heading: 'Strategic Initiatives', content: '{{initiatives}}', style: 'HEADING_1' },
    { heading: 'Engagement Cadence', content: '{{cadence}}', style: 'HEADING_1' },
    { heading: 'Risk Mitigation', content: '{{risks}}', style: 'HEADING_1' },
    { heading: 'Growth Opportunities', content: '{{growth}}', style: 'HEADING_1' },
  ],
  renewal_proposal: [
    { content: '{{customerName}} - Renewal Proposal', style: 'TITLE' },
    { content: 'Contract Renewal: {{renewalDate}}', style: 'SUBTITLE' },
    { heading: 'Partnership Summary', content: '{{summary}}', style: 'HEADING_1' },
    { heading: 'Value Delivered', content: '{{valueDelivered}}', style: 'HEADING_1' },
    { heading: 'ROI Analysis', content: '{{roiAnalysis}}', style: 'HEADING_1' },
    { heading: 'Renewal Terms', content: '{{terms}}', style: 'HEADING_1' },
    { heading: 'Expansion Opportunities', content: '{{expansion}}', style: 'HEADING_1' },
    { heading: 'Next Steps', content: '{{nextSteps}}', style: 'HEADING_1' },
  ],
  value_summary: [
    { content: '{{customerName}} - Value Summary', style: 'TITLE' },
    { content: 'Business Impact Report', style: 'SUBTITLE' },
    { heading: 'Executive Overview', content: '{{overview}}', style: 'HEADING_1' },
    { heading: 'Key Metrics', content: '{{metrics}}', style: 'HEADING_1' },
    { heading: 'Business Outcomes', content: '{{outcomes}}', style: 'HEADING_1' },
    { heading: 'Time & Cost Savings', content: '{{savings}}', style: 'HEADING_1' },
    { heading: 'Customer Testimonials', content: '{{testimonials}}', style: 'HEADING_1' },
    { heading: 'Future Potential', content: '{{potential}}', style: 'HEADING_1' },
  ],
  escalation_report: [
    { content: '{{customerName}} - Escalation Report', style: 'TITLE' },
    { content: 'Priority: {{priority}} | Date: {{date}}', style: 'SUBTITLE' },
    { heading: 'Issue Summary', content: '{{summary}}', style: 'HEADING_1' },
    { heading: 'Business Impact', content: '{{impact}}', style: 'HEADING_1' },
    { heading: 'Root Cause Analysis', content: '{{rootCause}}', style: 'HEADING_1' },
    { heading: 'Actions Taken', content: '{{actionsTaken}}', style: 'HEADING_1' },
    { heading: 'Resolution Plan', content: '{{resolutionPlan}}', style: 'HEADING_1' },
    { heading: 'Executive Attention Required', content: '{{execAttention}}', style: 'HEADING_1' },
  ],
  save_play: [
    { content: '{{customerName}} - Save Play Strategy', style: 'TITLE' },
    { content: 'Customer Retention Plan', style: 'SUBTITLE' },
    { heading: 'Risk Assessment', content: '{{riskAssessment}}', style: 'HEADING_1' },
    { heading: 'Churn Indicators', content: '{{churnIndicators}}', style: 'HEADING_1' },
    { heading: 'Root Causes', content: '{{rootCauses}}', style: 'HEADING_1' },
    { heading: 'Intervention Strategy', content: '{{strategy}}', style: 'HEADING_1' },
    { heading: 'Action Plan', content: '{{actionPlan}}', style: 'HEADING_1' },
    { heading: 'Success Metrics', content: '{{successMetrics}}', style: 'HEADING_1' },
    { heading: 'Timeline', content: '{{timeline}}', style: 'HEADING_1' },
  ],
  account_plan: [
    { content: '{{customerName}} - Strategic Account Plan', style: 'TITLE' },
    { content: '{{year}} Planning Document', style: 'SUBTITLE' },
    { heading: 'Account Overview', content: '{{overview}}', style: 'HEADING_1' },
    { heading: 'Stakeholder Map', content: '{{stakeholders}}', style: 'HEADING_1' },
    { heading: 'Business Priorities', content: '{{priorities}}', style: 'HEADING_1' },
    { heading: 'Growth Strategy', content: '{{growthStrategy}}', style: 'HEADING_1' },
    { heading: 'Competitive Landscape', content: '{{competitive}}', style: 'HEADING_1' },
    { heading: 'Action Plan', content: '{{actionPlan}}', style: 'HEADING_1' },
    { heading: 'Success Milestones', content: '{{milestones}}', style: 'HEADING_1' },
  ],
};

export class DocsService {
  /**
   * Get Google Docs API client for a user
   */
  private async getDocsClient(userId: string): Promise<docs_v1.Docs> {
    const auth = await googleOAuth.getAuthenticatedClient(userId);
    return google.docs({ version: 'v1', auth });
  }

  /**
   * Create a new Google Doc
   */
  async createDocument(userId: string, options: CreateDocOptions): Promise<GoogleDoc> {
    const docs = await this.getDocsClient(userId);

    // Create the document
    const createResponse = await docs.documents.create({
      requestBody: {
        title: options.title,
      },
    });

    const docId = createResponse.data.documentId;
    if (!docId) {
      throw new Error('Failed to create document');
    }

    // Move document to specified folder or default CSCX folder
    const targetFolderId = options.folderId || config.google.defaultFolderId;
    if (targetFolderId) {
      await driveService.moveFile(userId, docId, targetFolderId);
    }

    // Add content if provided
    if (options.template) {
      await this.applyTemplate(userId, docId, options.template);
    } else if (options.sections && options.sections.length > 0) {
      await this.insertSections(userId, docId, options.sections);
    } else if (options.content) {
      await this.insertText(userId, docId, options.content, 1);
    }

    // Get the updated document
    const doc = await this.getDocument(userId, docId);
    return doc;
  }

  /**
   * Get a document by ID
   */
  async getDocument(userId: string, documentId: string): Promise<GoogleDoc> {
    const docs = await this.getDocsClient(userId);

    const response = await docs.documents.get({
      documentId,
    });

    const doc = response.data;

    // Extract text content
    let content = '';
    if (doc.body?.content) {
      for (const element of doc.body.content) {
        if (element.paragraph?.elements) {
          for (const textElement of element.paragraph.elements) {
            if (textElement.textRun?.content) {
              content += textElement.textRun.content;
            }
          }
        }
      }
    }

    // Get file metadata from Drive for dates
    const fileInfo = await driveService.getFile(userId, documentId);

    return {
      id: doc.documentId || documentId,
      title: doc.title || 'Untitled',
      content,
      revisionId: doc.revisionId || undefined,
      createdAt: fileInfo.createdTime,
      modifiedAt: fileInfo.modifiedTime,
      webViewLink: `https://docs.google.com/document/d/${documentId}/edit`,
    };
  }

  /**
   * Update a document
   */
  async updateDocument(userId: string, documentId: string, options: UpdateDocOptions): Promise<GoogleDoc> {
    const docs = await this.getDocsClient(userId);

    const requests: docs_v1.Schema$Request[] = [];

    if (options.replaceContent !== undefined) {
      // Get current document to find end index
      const doc = await docs.documents.get({ documentId });
      const endIndex = doc.data.body?.content?.reduce((max, element) => {
        return Math.max(max, element.endIndex || 0);
      }, 1) || 1;

      // Delete all content except the first newline
      if (endIndex > 2) {
        requests.push({
          deleteContentRange: {
            range: {
              startIndex: 1,
              endIndex: endIndex - 1,
            },
          },
        });
      }

      // Insert new content
      requests.push({
        insertText: {
          location: { index: 1 },
          text: options.replaceContent,
        },
      });
    } else if (options.appendContent) {
      // Get current document to find end index
      const doc = await docs.documents.get({ documentId });
      const endIndex = doc.data.body?.content?.reduce((max, element) => {
        return Math.max(max, element.endIndex || 0);
      }, 1) || 1;

      requests.push({
        insertText: {
          location: { index: endIndex - 1 },
          text: options.appendContent,
        },
      });
    } else if (options.insertAtIndex !== undefined && options.sections) {
      // Insert sections at specific index
      let currentIndex = options.insertAtIndex;
      for (const section of options.sections) {
        const text = section.heading ? `${section.heading}\n${section.content}\n\n` : `${section.content}\n\n`;
        requests.push({
          insertText: {
            location: { index: currentIndex },
            text,
          },
        });
        currentIndex += text.length;
      }
    }

    if (requests.length > 0) {
      await docs.documents.batchUpdate({
        documentId,
        requestBody: { requests },
      });
    }

    return this.getDocument(userId, documentId);
  }

  /**
   * Apply a template to a document
   */
  async applyTemplate(userId: string, documentId: string, template: DocTemplate): Promise<void> {
    const templateSections = DOC_TEMPLATES[template.type];
    if (!templateSections) {
      throw new Error(`Unknown template type: ${template.type}`);
    }

    // Replace variables in template
    const sections = templateSections.map(section => ({
      ...section,
      content: this.replaceVariables(section.content, template.variables),
      heading: section.heading ? this.replaceVariables(section.heading, template.variables) : undefined,
    }));

    await this.insertSections(userId, documentId, sections);
  }

  /**
   * Insert sections into a document
   */
  private async insertSections(userId: string, documentId: string, sections: DocSection[]): Promise<void> {
    const docs = await this.getDocsClient(userId);
    const requests: docs_v1.Schema$Request[] = [];

    let currentIndex = 1;

    for (const section of sections) {
      // Insert heading if present
      if (section.heading) {
        const headingText = `${section.heading}\n`;
        requests.push({
          insertText: {
            location: { index: currentIndex },
            text: headingText,
          },
        });

        // Apply heading style
        const headingStyle = section.style || 'HEADING_1';
        requests.push({
          updateParagraphStyle: {
            range: {
              startIndex: currentIndex,
              endIndex: currentIndex + headingText.length,
            },
            paragraphStyle: {
              namedStyleType: headingStyle,
            },
            fields: 'namedStyleType',
          },
        });

        currentIndex += headingText.length;
      }

      // Insert content
      const contentText = `${section.content}\n\n`;
      requests.push({
        insertText: {
          location: { index: currentIndex },
          text: contentText,
        },
      });

      // Apply content style if no heading (for title/subtitle)
      if (!section.heading && section.style) {
        requests.push({
          updateParagraphStyle: {
            range: {
              startIndex: currentIndex,
              endIndex: currentIndex + contentText.length - 1,
            },
            paragraphStyle: {
              namedStyleType: section.style,
            },
            fields: 'namedStyleType',
          },
        });
      }

      currentIndex += contentText.length;
    }

    if (requests.length > 0) {
      await docs.documents.batchUpdate({
        documentId,
        requestBody: { requests },
      });
    }
  }

  /**
   * Insert text at a specific index
   */
  private async insertText(userId: string, documentId: string, text: string, index: number): Promise<void> {
    const docs = await this.getDocsClient(userId);

    await docs.documents.batchUpdate({
      documentId,
      requestBody: {
        requests: [{
          insertText: {
            location: { index },
            text,
          },
        }],
      },
    });
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
   * Export document as PDF
   */
  async exportAsPdf(userId: string, documentId: string): Promise<Buffer> {
    return driveService.exportFile(userId, documentId, 'application/pdf');
  }

  /**
   * Export document as Word
   */
  async exportAsWord(userId: string, documentId: string): Promise<Buffer> {
    return driveService.exportFile(userId, documentId, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  }

  /**
   * Copy a document
   */
  async copyDocument(userId: string, documentId: string, newTitle: string, folderId?: string): Promise<GoogleDoc> {
    const newFileId = await driveService.copyFile(userId, documentId, newTitle, folderId);
    return this.getDocument(userId, newFileId);
  }

  /**
   * Share document with someone
   */
  async shareDocument(
    userId: string,
    documentId: string,
    email: string,
    role: 'reader' | 'writer' | 'commenter' = 'reader'
  ): Promise<void> {
    await driveService.shareFile(userId, documentId, email, role);
  }

  /**
   * Create document from template
   */
  async createFromTemplate(
    userId: string,
    templateType: DocTemplate['type'],
    variables: Record<string, string>,
    folderId?: string
  ): Promise<GoogleDoc> {
    const title = variables.customerName
      ? `${variables.customerName} - ${this.formatTemplateTitle(templateType)}`
      : this.formatTemplateTitle(templateType);

    return this.createDocument(userId, {
      title,
      folderId,
      template: {
        type: templateType,
        variables,
      },
    });
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

  /**
   * Find and replace text in document
   */
  async findAndReplace(userId: string, documentId: string, findText: string, replaceText: string): Promise<void> {
    const docs = await this.getDocsClient(userId);

    await docs.documents.batchUpdate({
      documentId,
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
   * Add comment to document
   */
  async addComment(userId: string, documentId: string, content: string, quotedText?: string): Promise<string> {
    const auth = await googleOAuth.getAuthenticatedClient(userId);
    const drive = google.drive({ version: 'v3', auth });

    const response = await drive.comments.create({
      fileId: documentId,
      fields: 'id',
      requestBody: {
        content,
        quotedFileContent: quotedText ? {
          value: quotedText,
        } : undefined,
      },
    });

    return response.data.id || '';
  }
}

// Singleton instance
export const docsService = new DocsService();
