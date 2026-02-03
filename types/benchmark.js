/**
 * Benchmark Data Types
 * PRD-023: Benchmark Data Upload -> Peer Comparison
 *
 * Type definitions for benchmark data processing, peer grouping,
 * and comparative analysis features.
 */
// Standard benchmark metrics mapped to categories
export const BENCHMARK_METRICS = [
    // Engagement
    { id: 'dau_mau_ratio', name: 'DAU/MAU Ratio', category: 'engagement', description: 'Daily active users / Monthly active users', unit: 'ratio', higherIsBetter: true },
    { id: 'session_length', name: 'Average Session Length', category: 'engagement', description: 'Average session duration in minutes', unit: 'count', higherIsBetter: true },
    { id: 'feature_adoption', name: 'Feature Adoption', category: 'engagement', description: 'Percentage of features used', unit: 'percentage', higherIsBetter: true },
    // Value
    { id: 'roi', name: 'ROI', category: 'value', description: 'Return on investment', unit: 'percentage', higherIsBetter: true },
    { id: 'time_to_value', name: 'Time-to-Value', category: 'value', description: 'Days until customer sees first value', unit: 'days', higherIsBetter: false },
    { id: 'outcomes_achieved', name: 'Outcomes Achieved', category: 'value', description: 'Percentage of target outcomes met', unit: 'percentage', higherIsBetter: true },
    // Satisfaction
    { id: 'nps_score', name: 'NPS Score', category: 'satisfaction', description: 'Net Promoter Score (-100 to +100)', unit: 'score', higherIsBetter: true },
    { id: 'csat', name: 'CSAT', category: 'satisfaction', description: 'Customer satisfaction score', unit: 'percentage', higherIsBetter: true },
    { id: 'health_score', name: 'Health Score', category: 'satisfaction', description: 'Customer health score', unit: 'score', higherIsBetter: true },
    // Growth
    { id: 'expansion_rate', name: 'Expansion Rate', category: 'growth', description: 'Revenue expansion percentage', unit: 'percentage', higherIsBetter: true },
    { id: 'seat_growth', name: 'Seat Growth', category: 'growth', description: 'User seat growth rate', unit: 'percentage', higherIsBetter: true },
    { id: 'upsell_rate', name: 'Upsell Rate', category: 'growth', description: 'Percentage of customers with upsells', unit: 'percentage', higherIsBetter: true },
    // Efficiency
    { id: 'tickets_per_user', name: 'Support Tickets per User', category: 'efficiency', description: 'Average support tickets per user', unit: 'ratio', higherIsBetter: false },
    { id: 'self_service_rate', name: 'Self-Service Rate', category: 'efficiency', description: 'Percentage of issues resolved via self-service', unit: 'percentage', higherIsBetter: true },
    { id: 'resolution_time', name: 'Resolution Time', category: 'efficiency', description: 'Average ticket resolution time in hours', unit: 'count', higherIsBetter: false },
];
//# sourceMappingURL=benchmark.js.map