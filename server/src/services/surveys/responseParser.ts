/**
 * Survey Response Parser Service
 * PRD-024: Survey Response Upload -> Statistical Analysis
 *
 * Parses multi-question survey data from CSV/Excel files,
 * identifies question types, and validates response data.
 */

import { v4 as uuidv4 } from 'uuid';

// ============================================
// Types
// ============================================

export type QuestionType = 'likert' | 'scale' | 'multiple_choice' | 'open_ended' | 'numeric' | 'binary';

export interface SurveyQuestion {
  id: string;
  index: number;
  title: string;
  type: QuestionType;
  required: boolean;
  options?: string[];
  scaleMin?: number;
  scaleMax?: number;
  validValues: Set<string | number>;
}

export interface ParsedSurveyData {
  id: string;
  fileName: string;
  questions: SurveyQuestion[];
  responses: SurveyResponseRow[];
  metadata: {
    totalResponses: number;
    completeResponses: number;
    partialResponses: number;
    completionRate: number;
    customersRepresented: number;
    dateRange: { start: Date | null; end: Date | null };
    averageCompletionPercentage: number;
  };
  questionStats: Record<string, QuestionStats>;
}

export interface SurveyResponseRow {
  responseId: string;
  customerId?: string;
  customerEmail?: string;
  respondentName?: string;
  respondentEmail?: string;
  submittedAt?: Date;
  answers: Record<string, SurveyAnswer>;
  completionPercentage: number;
  isComplete: boolean;
}

export interface SurveyAnswer {
  questionId: string;
  value: string | number | null;
  numericValue?: number;
  isValid: boolean;
}

export interface QuestionStats {
  questionId: string;
  questionTitle: string;
  questionType: QuestionType;
  responseCount: number;
  responseRate: number;
  // For numeric/likert questions
  mean?: number;
  median?: number;
  stdDev?: number;
  min?: number;
  max?: number;
  distribution?: Record<string | number, number>;
  // For categorical questions
  optionCounts?: Record<string, number>;
  // For open-ended
  sampleResponses?: string[];
}

// ============================================
// Parser Class
// ============================================

export class SurveyResponseParser {
  /**
   * Parse survey response data from rows
   */
  parseSurveyData(
    rows: Record<string, any>[],
    options: {
      fileName?: string;
      customerIdColumn?: string;
      respondentEmailColumn?: string;
      timestampColumn?: string;
    } = {}
  ): ParsedSurveyData {
    const id = uuidv4();
    const fileName = options.fileName || 'survey_responses.csv';

    // Detect columns and their types
    const columns = Object.keys(rows[0] || {});
    const questions = this.detectQuestions(columns, rows);

    // Parse responses
    const responses = this.parseResponses(rows, questions, {
      customerIdColumn: options.customerIdColumn,
      respondentEmailColumn: options.respondentEmailColumn,
      timestampColumn: options.timestampColumn,
    });

    // Calculate question statistics
    const questionStats = this.calculateQuestionStats(questions, responses);

    // Calculate metadata
    const completeResponses = responses.filter(r => r.isComplete).length;
    const partialResponses = responses.length - completeResponses;
    const uniqueCustomers = new Set(responses.map(r => r.customerId || r.respondentEmail).filter(Boolean));

    const timestamps = responses
      .map(r => r.submittedAt)
      .filter((d): d is Date => d !== undefined);

    return {
      id,
      fileName,
      questions,
      responses,
      metadata: {
        totalResponses: responses.length,
        completeResponses,
        partialResponses,
        completionRate: responses.length > 0 ? Math.round((completeResponses / responses.length) * 100) : 0,
        customersRepresented: uniqueCustomers.size,
        dateRange: {
          start: timestamps.length > 0 ? new Date(Math.min(...timestamps.map(d => d.getTime()))) : null,
          end: timestamps.length > 0 ? new Date(Math.max(...timestamps.map(d => d.getTime()))) : null,
        },
        averageCompletionPercentage: responses.length > 0
          ? Math.round(responses.reduce((sum, r) => sum + r.completionPercentage, 0) / responses.length)
          : 0,
      },
      questionStats,
    };
  }

  /**
   * Detect questions and their types from column headers and sample data
   */
  private detectQuestions(columns: string[], rows: Record<string, any>[]): SurveyQuestion[] {
    const questions: SurveyQuestion[] = [];
    const metaColumns = new Set([
      'id', 'response_id', 'responseid', 'customer_id', 'customerid', 'customer',
      'email', 'respondent_email', 'timestamp', 'submitted_at', 'date', 'created_at',
      'name', 'respondent_name', 'company', 'segment',
    ]);

    let questionIndex = 0;

    for (const column of columns) {
      const lowerColumn = column.toLowerCase().replace(/[_\-\s]/g, '');

      // Skip metadata columns
      if (metaColumns.has(lowerColumn)) continue;

      // Get sample values for this column
      const values = rows
        .map(row => row[column])
        .filter(v => v !== null && v !== undefined && v !== '');

      if (values.length === 0) continue;

      const question = this.detectQuestionType(column, values, questionIndex);
      if (question) {
        questions.push(question);
        questionIndex++;
      }
    }

    return questions;
  }

  /**
   * Detect question type from column name and values
   */
  private detectQuestionType(
    columnName: string,
    values: any[],
    index: number
  ): SurveyQuestion | null {
    const id = uuidv4();
    const uniqueValues = new Set(values.map(v => String(v).toLowerCase().trim()));
    const numericValues = values.filter(v => !isNaN(parseFloat(v))).map(v => parseFloat(v));

    // Check for NPS-style 0-10 scale
    if (numericValues.length === values.length) {
      const min = Math.min(...numericValues);
      const max = Math.max(...numericValues);

      if (min >= 0 && max <= 10 && Number.isInteger(min) && Number.isInteger(max)) {
        return {
          id,
          index,
          title: columnName,
          type: 'scale',
          required: false,
          scaleMin: 0,
          scaleMax: 10,
          validValues: new Set(numericValues),
        };
      }

      // Likert scale (1-5 or 1-7)
      if ((min >= 1 && max <= 5) || (min >= 1 && max <= 7)) {
        return {
          id,
          index,
          title: columnName,
          type: 'likert',
          required: false,
          scaleMin: min,
          scaleMax: max,
          validValues: new Set(numericValues),
        };
      }

      // General numeric
      return {
        id,
        index,
        title: columnName,
        type: 'numeric',
        required: false,
        scaleMin: min,
        scaleMax: max,
        validValues: new Set(numericValues),
      };
    }

    // Check for binary yes/no
    const binaryPatterns = ['yes', 'no', 'true', 'false', '1', '0', 'y', 'n'];
    const allBinary = [...uniqueValues].every(v => binaryPatterns.includes(v));
    if (allBinary && uniqueValues.size <= 2) {
      return {
        id,
        index,
        title: columnName,
        type: 'binary',
        required: false,
        options: [...uniqueValues],
        validValues: uniqueValues,
      };
    }

    // Check for multiple choice (limited unique values)
    if (uniqueValues.size <= 10 && uniqueValues.size < values.length * 0.5) {
      return {
        id,
        index,
        title: columnName,
        type: 'multiple_choice',
        required: false,
        options: [...uniqueValues].sort(),
        validValues: uniqueValues,
      };
    }

    // Open-ended text
    return {
      id,
      index,
      title: columnName,
      type: 'open_ended',
      required: false,
      validValues: new Set(),
    };
  }

  /**
   * Parse individual responses
   */
  private parseResponses(
    rows: Record<string, any>[],
    questions: SurveyQuestion[],
    options: {
      customerIdColumn?: string;
      respondentEmailColumn?: string;
      timestampColumn?: string;
    }
  ): SurveyResponseRow[] {
    const responses: SurveyResponseRow[] = [];
    const questionMap = new Map(questions.map(q => [q.title, q]));

    for (const row of rows) {
      const answers: Record<string, SurveyAnswer> = {};
      let answeredCount = 0;

      for (const question of questions) {
        const value = row[question.title];
        const hasValue = value !== null && value !== undefined && value !== '';

        let numericValue: number | undefined;
        if (hasValue && ['likert', 'scale', 'numeric'].includes(question.type)) {
          const parsed = parseFloat(value);
          if (!isNaN(parsed)) {
            numericValue = parsed;
          }
        }

        answers[question.id] = {
          questionId: question.id,
          value: hasValue ? value : null,
          numericValue,
          isValid: hasValue,
        };

        if (hasValue) answeredCount++;
      }

      const completionPercentage = questions.length > 0
        ? Math.round((answeredCount / questions.length) * 100)
        : 0;

      // Extract metadata from known columns
      const customerId = this.findColumnValue(row, ['customer_id', 'customerid', 'customer']);
      const respondentEmail = this.findColumnValue(row, ['email', 'respondent_email', 'respondent']);
      const respondentName = this.findColumnValue(row, ['name', 'respondent_name']);
      const timestamp = this.findColumnValue(row, ['timestamp', 'submitted_at', 'date', 'created_at']);

      responses.push({
        responseId: uuidv4(),
        customerId: customerId || undefined,
        customerEmail: respondentEmail || undefined,
        respondentName: respondentName || undefined,
        respondentEmail: respondentEmail || undefined,
        submittedAt: timestamp ? this.parseDate(timestamp) : undefined,
        answers,
        completionPercentage,
        isComplete: completionPercentage === 100,
      });
    }

    return responses;
  }

  /**
   * Find a value from multiple possible column names
   */
  private findColumnValue(row: Record<string, any>, possibleNames: string[]): string | null {
    for (const name of possibleNames) {
      for (const key of Object.keys(row)) {
        if (key.toLowerCase().replace(/[_\-\s]/g, '') === name.replace(/[_\-\s]/g, '')) {
          const value = row[key];
          if (value !== null && value !== undefined && value !== '') {
            return String(value);
          }
        }
      }
    }
    return null;
  }

  /**
   * Parse date from various formats
   */
  private parseDate(value: string): Date | undefined {
    const date = new Date(value);
    return isNaN(date.getTime()) ? undefined : date;
  }

  /**
   * Calculate statistics for each question
   */
  private calculateQuestionStats(
    questions: SurveyQuestion[],
    responses: SurveyResponseRow[]
  ): Record<string, QuestionStats> {
    const stats: Record<string, QuestionStats> = {};

    for (const question of questions) {
      const values = responses
        .map(r => r.answers[question.id])
        .filter(a => a && a.isValid);

      const numericValues = values
        .filter(a => a.numericValue !== undefined)
        .map(a => a.numericValue as number);

      const responseRate = responses.length > 0
        ? Math.round((values.length / responses.length) * 100)
        : 0;

      const baseStat: QuestionStats = {
        questionId: question.id,
        questionTitle: question.title,
        questionType: question.type,
        responseCount: values.length,
        responseRate,
      };

      if (['likert', 'scale', 'numeric'].includes(question.type) && numericValues.length > 0) {
        const sorted = [...numericValues].sort((a, b) => a - b);
        const sum = numericValues.reduce((a, b) => a + b, 0);
        const mean = sum / numericValues.length;

        // Calculate median
        const mid = Math.floor(sorted.length / 2);
        const median = sorted.length % 2 !== 0
          ? sorted[mid]
          : (sorted[mid - 1] + sorted[mid]) / 2;

        // Calculate standard deviation
        const squaredDiffs = numericValues.map(v => Math.pow(v - mean, 2));
        const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / numericValues.length;
        const stdDev = Math.sqrt(avgSquaredDiff);

        // Calculate distribution
        const distribution: Record<number, number> = {};
        for (const val of numericValues) {
          distribution[val] = (distribution[val] || 0) + 1;
        }

        stats[question.id] = {
          ...baseStat,
          mean: Math.round(mean * 100) / 100,
          median: Math.round(median * 100) / 100,
          stdDev: Math.round(stdDev * 100) / 100,
          min: sorted[0],
          max: sorted[sorted.length - 1],
          distribution,
        };
      } else if (['multiple_choice', 'binary'].includes(question.type)) {
        const optionCounts: Record<string, number> = {};
        for (const answer of values) {
          const val = String(answer.value).toLowerCase().trim();
          optionCounts[val] = (optionCounts[val] || 0) + 1;
        }

        stats[question.id] = {
          ...baseStat,
          optionCounts,
        };
      } else if (question.type === 'open_ended') {
        const textValues = values
          .map(a => String(a.value))
          .filter(v => v.length > 0)
          .slice(0, 5);

        stats[question.id] = {
          ...baseStat,
          sampleResponses: textValues,
        };
      } else {
        stats[question.id] = baseStat;
      }
    }

    return stats;
  }
}

// Singleton export
export const surveyResponseParser = new SurveyResponseParser();
export default surveyResponseParser;
