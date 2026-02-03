/**
 * Benchmark Data Types
 * PRD-023: Benchmark Data Upload -> Peer Comparison
 *
 * Type definitions for benchmark data processing, peer grouping,
 * and comparative analysis features.
 */
export type BenchmarkCategory = 'engagement' | 'value' | 'satisfaction' | 'growth' | 'efficiency';
export interface BenchmarkMetric {
    id: string;
    name: string;
    category: BenchmarkCategory;
    description: string;
    unit: 'ratio' | 'percentage' | 'score' | 'days' | 'count' | 'currency';
    higherIsBetter: boolean;
}
export declare const BENCHMARK_METRICS: BenchmarkMetric[];
export interface BenchmarkValue {
    metricId: string;
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
    mean: number;
    sampleSize: number;
}
export interface BenchmarkDataset {
    id: string;
    name: string;
    source: string;
    industry: string | null;
    segment: string | null;
    createdAt: string;
    updatedAt: string;
    uploadedBy: string;
    fileName: string;
    sampleSize: number;
    metrics: BenchmarkValue[];
    metadata: {
        year: number;
        region?: string;
        notes?: string;
    };
}
export type PeerGroupDimension = 'segment' | 'industry' | 'size' | 'custom';
export interface PeerGroup {
    id: string;
    name: string;
    dimension: PeerGroupDimension;
    criteria: {
        segments?: string[];
        industries?: string[];
        arrMin?: number;
        arrMax?: number;
        customerIds?: string[];
    };
    customerCount: number;
    customerIds: string[];
}
export interface PeerGroupSummary {
    id: string;
    name: string;
    customerCount: number;
    avgHealthScore: number;
    totalArr: number;
}
export type PerformanceStatus = 'above' | 'at' | 'below';
export interface MetricComparison {
    metricId: string;
    metricName: string;
    category: BenchmarkCategory;
    customerValue: number;
    benchmarkValue: number;
    percentile: number;
    status: PerformanceStatus;
    gap: number;
    unit: string;
}
export interface CustomerBenchmarkComparison {
    customerId: string;
    customerName: string;
    arr: number;
    segment: string;
    peerGroup: string;
    overallPercentile: number;
    overallStatus: PerformanceStatus;
    metrics: MetricComparison[];
    strengths: MetricComparison[];
    gaps: MetricComparison[];
    recommendations: BenchmarkRecommendation[];
}
export interface BenchmarkRecommendation {
    metricId: string;
    metricName: string;
    currentValue: number;
    targetValue: number;
    gap: number;
    priority: 'high' | 'medium' | 'low';
    action: string;
    timeline: string;
    bestPractice?: string;
    exemplarCustomer?: {
        id: string;
        name: string;
        value: number;
        percentile: number;
    };
}
export interface TopPerformer {
    customerId: string;
    customerName: string;
    metricId: string;
    metricName: string;
    value: number;
    percentile: number;
    bestPractice: string | null;
}
export interface BestPractice {
    metricId: string;
    metricName: string;
    customerId: string;
    customerName: string;
    value: number;
    percentile: number;
    description: string;
    keySuccessFactors: string[];
}
export interface PortfolioMetricSummary {
    metricId: string;
    metricName: string;
    category: BenchmarkCategory;
    portfolioAvg: number;
    benchmarkMedian: number;
    portfolioPercentile: number;
    status: PerformanceStatus;
    aboveCount: number;
    atCount: number;
    belowCount: number;
}
export interface PortfolioBenchmarkAnalysis {
    datasetId: string;
    datasetName: string;
    analyzedAt: string;
    totalCustomers: number;
    totalArr: number;
    metrics: PortfolioMetricSummary[];
    summary: {
        aboveBenchmark: number;
        atBenchmark: number;
        belowBenchmark: number;
    };
    topPerformers: TopPerformer[];
    underperformers: CustomerBenchmarkComparison[];
    bestPractices: BestPractice[];
}
export interface PeerGroupMetricComparison {
    metricId: string;
    metricName: string;
    groupAvg: number;
    portfolioAvg: number;
    benchmarkMedian: number;
}
export interface PeerGroupComparison {
    peerGroup: PeerGroup;
    customers: CustomerBenchmarkComparison[];
    metrics: PeerGroupMetricComparison[];
    summary: {
        aboveMedian: number;
        belowMedian: number;
        lowestPerformer: {
            customerId: string;
            customerName: string;
            percentile: number;
        } | null;
        highestPerformer: {
            customerId: string;
            customerName: string;
            percentile: number;
        } | null;
    };
}
export interface BenchmarkUploadResponse {
    success: boolean;
    dataset: BenchmarkDataset;
    summary: {
        metricsLoaded: number;
        categories: BenchmarkCategory[];
        segments: string[];
        sampleSize: number;
    };
}
export interface PeerGroupRequest {
    dimension: PeerGroupDimension;
    criteria?: {
        segments?: string[];
        industries?: string[];
        arrMin?: number;
        arrMax?: number;
        customerIds?: string[];
    };
    name?: string;
}
export interface PeerGroupResponse {
    success: boolean;
    peerGroups: PeerGroup[];
}
export interface BenchmarkComparisonRequest {
    datasetId: string;
    customerId?: string;
    peerGroupId?: string;
}
export interface BenchmarkLeadersRequest {
    datasetId: string;
    metricId?: string;
    limit?: number;
}
export interface BenchmarkLeadersResponse {
    success: boolean;
    leaders: TopPerformer[];
    bestPractices: BestPractice[];
}
export interface CustomerBenchmarkReport {
    customer: {
        id: string;
        name: string;
        arr: number;
        segment: string;
        industry: string | null;
    };
    peerGroup: string;
    preparedBy: string;
    preparedDate: string;
    overallPercentile: number;
    metrics: MetricComparison[];
    strengths: {
        metric: string;
        value: number;
        percentile: number;
        description: string;
    }[];
    opportunities: {
        metric: string;
        currentValue: number;
        targetValue: number;
        gap: number;
        recommendation: string;
    }[];
    peerComparison: {
        rank: number;
        total: number;
        position: string;
    };
    nextSteps: string[];
}
export interface BenchmarkFilters {
    datasetId?: string;
    category?: BenchmarkCategory;
    segment?: string;
    industry?: string;
    status?: PerformanceStatus;
    search?: string;
    sortBy?: 'percentile' | 'gap' | 'arr' | 'name';
    sortOrder?: 'asc' | 'desc';
}
export interface PercentileChartData {
    metricId: string;
    metricName: string;
    category: BenchmarkCategory;
    customerValue: number;
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
    percentile: number;
}
export interface CategorySummaryChart {
    category: BenchmarkCategory;
    avgPercentile: number;
    metricCount: number;
    aboveCount: number;
    belowCount: number;
}
//# sourceMappingURL=benchmark.d.ts.map