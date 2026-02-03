/**
 * QBR Deck Refresh Types
 * Shared type definitions for deck parsing, detection, and refresh services
 */

// ============================================
// DECK STRUCTURE TYPES
// ============================================

export interface ParsedDeck {
  id: string;
  fileName: string;
  fileType: 'pptx' | 'google_slides';
  googleFileId?: string;
  slideCount: number;
  title: string;
  customerId?: string;
  customerName?: string;
  detectedQuarter?: string;
  detectedYear?: number;
  slides: ParsedSlide[];
  createdAt: Date;
  metadata: DeckMetadata;
}

export interface ParsedSlide {
  index: number;
  slideId: string;
  title?: string;
  layout?: string;
  elements: SlideElement[];
  charts: ChartElement[];
  tables: TableElement[];
  images: ImageElement[];
}

export interface SlideElement {
  id: string;
  type: 'text' | 'shape' | 'placeholder';
  content: string;
  position: ElementPosition;
  style?: ElementStyle;
}

export interface ChartElement {
  id: string;
  type: 'line' | 'bar' | 'pie' | 'area' | 'scatter' | 'combo' | 'unknown';
  title?: string;
  dataRange?: string;
  seriesCount: number;
  categories: string[];
  slideIndex: number;
}

export interface TableElement {
  id: string;
  rows: number;
  columns: number;
  headers: string[];
  data: string[][];
  slideIndex: number;
}

export interface ImageElement {
  id: string;
  url?: string;
  altText?: string;
  position: ElementPosition;
}

export interface ElementPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ElementStyle {
  fontSize?: number;
  fontFamily?: string;
  bold?: boolean;
  italic?: boolean;
  color?: string;
}

export interface DeckMetadata {
  author?: string;
  company?: string;
  createdDate?: Date;
  modifiedDate?: Date;
  totalTextElements: number;
  totalCharts: number;
  totalTables: number;
}

// ============================================
// DATA DETECTION TYPES
// ============================================

export type DataFieldType =
  | 'arr'
  | 'mrr'
  | 'health_score'
  | 'nps'
  | 'mau'
  | 'dau'
  | 'active_users'
  | 'license_utilization'
  | 'support_tickets'
  | 'adoption_rate'
  | 'date_quarter'
  | 'date_range'
  | 'percentage'
  | 'growth_change'
  | 'currency'
  | 'count'
  | 'custom';

export interface DetectedDataField {
  id: string;
  slideIndex: number;
  elementId: string;
  fieldType: DataFieldType;
  originalValue: string;
  extractedValue: number | string;
  confidence: number; // 0-1
  context: string; // Surrounding text for context
  dataSourcePath?: string; // Path to data in customer object
  canAutoUpdate: boolean;
  requiresManualReview?: boolean;
  matchedPattern?: string;
}

export interface DetectedChart {
  id: string;
  slideIndex: number;
  chartId: string;
  chartType: ChartElement['type'];
  title?: string;
  dataFields: ChartDataField[];
  canAutoUpdate: boolean;
  updateStrategy: 'replace_data' | 'append_data' | 'manual';
}

export interface ChartDataField {
  seriesName: string;
  fieldType: DataFieldType;
  dataSourcePath?: string;
}

export interface DetectedTable {
  id: string;
  slideIndex: number;
  tableId: string;
  headers: string[];
  dataFields: TableDataField[];
  canAutoUpdate: boolean;
}

export interface TableDataField {
  column: number;
  row: number;
  fieldType: DataFieldType;
  originalValue: string;
  dataSourcePath?: string;
}

export interface DetectionResult {
  deckId: string;
  customerId?: string;
  customerName?: string;
  detectedFields: DetectedDataField[];
  detectedCharts: DetectedChart[];
  detectedTables: DetectedTable[];
  detectedDates: DateDetection[];
  manualReviewItems: ManualReviewItem[];
  totalDataPoints: number;
  autoUpdateableCount: number;
  summary: DetectionSummary;
}

export interface DateDetection {
  id: string;
  slideIndex: number;
  originalText: string;
  detectedQuarter?: string;
  detectedYear?: number;
  detectedDateRange?: { start: string; end: string };
  instanceCount: number;
  suggestedReplacement: string;
}

export interface ManualReviewItem {
  slideIndex: number;
  slideTitle?: string;
  elementId: string;
  reason: string;
  content: string;
  category: 'narrative' | 'goals' | 'challenges' | 'action_items' | 'custom_content';
}

export interface DetectionSummary {
  totalSlides: number;
  slidesWithData: number;
  metricsCount: number;
  chartsCount: number;
  tablesCount: number;
  datesCount: number;
  manualReviewCount: number;
}

// ============================================
// REFRESH TYPES
// ============================================

export interface RefreshRequest {
  deckId: string;
  customerId: string;
  fieldsToRefresh: string[]; // IDs of DetectedDataFields
  chartsToRefresh: string[]; // IDs of DetectedCharts
  tablesToRefresh: string[]; // IDs of DetectedTables
  updateDates: boolean;
  targetQuarter?: string;
  targetYear?: number;
}

export interface RefreshResult {
  deckId: string;
  success: boolean;
  updatedPresentation?: {
    id: string;
    url: string;
    editUrl: string;
    downloadUrl?: string;
  };
  changes: RefreshChange[];
  failedUpdates: FailedUpdate[];
  summary: RefreshSummary;
}

export interface RefreshChange {
  type: 'field' | 'chart' | 'table' | 'date';
  slideIndex: number;
  elementId: string;
  fieldType?: DataFieldType;
  oldValue: string | number;
  newValue: string | number;
  changePercent?: number;
  changeDirection?: 'up' | 'down' | 'unchanged';
  significance: 'positive' | 'negative' | 'neutral';
}

export interface FailedUpdate {
  elementId: string;
  reason: string;
  slideIndex: number;
}

export interface RefreshSummary {
  totalFieldsUpdated: number;
  totalChartsUpdated: number;
  totalTablesUpdated: number;
  totalDatesUpdated: number;
  failedUpdates: number;
  significantChanges: SignificantChange[];
}

export interface SignificantChange {
  slideIndex: number;
  description: string;
  impact: 'positive' | 'negative' | 'neutral';
  oldValue: string;
  newValue: string;
}

// ============================================
// PREVIEW TYPES
// ============================================

export interface DeckPreview {
  deckId: string;
  slides: SlidePreview[];
  changes: RefreshChange[];
  beforeAfterComparison: BeforeAfterSlide[];
}

export interface SlidePreview {
  index: number;
  title?: string;
  thumbnailUrl?: string;
  hasChanges: boolean;
  changeCount: number;
}

export interface BeforeAfterSlide {
  slideIndex: number;
  beforeThumbnail?: string;
  afterThumbnail?: string;
  changes: RefreshChange[];
  highlightedDifferences: DifferenceHighlight[];
}

export interface DifferenceHighlight {
  elementId: string;
  type: 'updated' | 'added' | 'removed';
  position: ElementPosition;
  description: string;
}

// ============================================
// CUSTOMER DATA MAPPING
// ============================================

export interface CustomerDataMapping {
  customerId: string;
  mappings: DataSourceMapping[];
}

export interface DataSourceMapping {
  fieldType: DataFieldType;
  sourcePath: string; // JSON path to data in customer object
  displayFormat: string; // e.g., "${{value}}K", "{{value}}%"
  transformFn?: (value: any) => string | number;
}

// Default data source mappings
export const DEFAULT_DATA_MAPPINGS: Record<DataFieldType, string> = {
  arr: 'metrics.arr',
  mrr: 'metrics.mrr',
  health_score: 'metrics.healthScore',
  nps: 'metrics.nps',
  mau: 'usage.mau',
  dau: 'usage.dau',
  active_users: 'usage.activeUsers',
  license_utilization: 'usage.licenseUtilization',
  support_tickets: 'support.openTickets',
  adoption_rate: 'adoption.rate',
  date_quarter: 'period.quarter',
  date_range: 'period.range',
  percentage: 'custom.percentage',
  growth_change: 'custom.growthChange',
  currency: 'custom.currency',
  count: 'custom.count',
  custom: 'custom.value',
};

// ============================================
// API RESPONSE TYPES
// ============================================

export interface UploadDeckResponse {
  success: boolean;
  deckId: string;
  fileName: string;
  slideCount: number;
  customerIdentified?: string;
  previousQuarter?: string;
  message: string;
}

export interface DetectDataResponse {
  success: boolean;
  detection: DetectionResult;
  message: string;
}

export interface RefreshDeckResponse {
  success: boolean;
  result: RefreshResult;
  message: string;
}

export interface PreviewDeckResponse {
  success: boolean;
  preview: DeckPreview;
}
