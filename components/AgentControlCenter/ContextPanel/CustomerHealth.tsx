interface CustomerHealthProps {
  customerName?: string;
  healthScore?: number;
  renewalDate?: string;
  arr?: number;
}

export function CustomerHealth({
  customerName = 'Acme Corp',
  healthScore = 85,
  renewalDate,
  arr = 150000,
}: CustomerHealthProps) {
  const getHealthColor = (score: number) => {
    if (score >= 80) return '#22c55e';
    if (score >= 60) return '#eab308';
    return '#ef4444';
  };

  const getHealthLabel = (score: number) => {
    if (score >= 80) return 'Healthy';
    if (score >= 60) return 'At Risk';
    return 'Critical';
  };

  const getDaysToRenewal = () => {
    if (!renewalDate) return null;
    const renewal = new Date(renewalDate);
    const now = new Date();
    const diffTime = renewal.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const daysToRenewal = getDaysToRenewal();
  const healthColor = getHealthColor(healthScore);

  return (
    <div className="context-section customer-health">
      <div className="context-section-header">
        <span className="section-icon">🏢</span>
        <span className="section-title">Customer</span>
      </div>

      <div className="health-content">
        <div className="customer-name">{customerName}</div>

        <div className="health-metrics">
          {/* Health Score */}
          <div className="health-metric">
            <div className="metric-label">Health Score</div>
            <div className="health-score-display">
              <div
                className="health-score-badge"
                style={{ backgroundColor: `${healthColor}20`, color: healthColor }}
              >
                <span className="score-value">{healthScore}</span>
                <span className="score-label">{getHealthLabel(healthScore)}</span>
              </div>
              <div className="health-bar">
                <div
                  className="health-bar-fill"
                  style={{ width: `${healthScore}%`, backgroundColor: healthColor }}
                />
              </div>
            </div>
          </div>

          {/* ARR */}
          <div className="health-metric">
            <div className="metric-label">ARR</div>
            <div className="metric-value">
              ${(arr / 1000).toFixed(0)}K
            </div>
          </div>

          {/* Days to Renewal */}
          {daysToRenewal !== null && (
            <div className="health-metric">
              <div className="metric-label">Renewal</div>
              <div className={`metric-value ${daysToRenewal <= 30 ? 'urgent' : ''}`}>
                {daysToRenewal <= 0 ? 'Overdue' : `${daysToRenewal}d`}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
