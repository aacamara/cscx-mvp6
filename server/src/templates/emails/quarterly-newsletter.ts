/**
 * Quarterly Newsletter Email Template
 * PRD-045: Quarterly Newsletter Personalization
 *
 * Generates personalized quarterly newsletters for customers
 * with customer-specific metrics, relevant product updates, and recommendations
 */

export interface QuarterlyNewsletterVariables {
  // Customer info
  customerName: string;
  contactName: string;
  contactTitle?: string;
  tier?: string;

  // CSM info
  csmName: string;
  csmEmail: string;
  csmTitle?: string;

  // Newsletter info
  quarter: string; // e.g., "Q1"
  year: number;
  subject?: string;

  // Metrics section
  metrics: {
    healthScore: number;
    healthScoreChange: number;
    activeUsers: number;
    activeUsersChangePercent: number;
    featureAdoption: number;
    featureAdoptionChange: number;
    timeSaved?: number;
    timeSavedChange?: number;
    customMetrics?: Array<{
      label: string;
      value: string | number;
      change?: number;
      unit?: string;
    }>;
  };

  // Product updates (filtered for relevance)
  productUpdates: Array<{
    title: string;
    description: string;
    relevanceNote?: string;
    wasRequested?: boolean;
    link?: string;
  }>;

  // Recommendations
  recommendations: Array<{
    title: string;
    description: string;
    ctaText?: string;
    ctaUrl?: string;
  }>;

  // Events
  events?: Array<{
    title: string;
    date: string;
    rsvpUrl?: string;
    description?: string;
  }>;

  // CSM personal note
  csmNote?: string;

  // Optional sections
  includeEventsSection?: boolean;
  includeTipsSection?: boolean;
  tips?: string[];

  // Customization
  customIntro?: string;
  customOutro?: string;

  // URLs
  dashboardUrl?: string;
  supportUrl?: string;
  unsubscribeUrl?: string;
}

export interface QuarterlyNewsletterResult {
  subject: string;
  bodyHtml: string;
  bodyText: string;
}

export function generateQuarterlyNewsletterEmail(
  variables: QuarterlyNewsletterVariables
): QuarterlyNewsletterResult {
  const {
    customerName,
    contactName,
    csmName,
    csmEmail,
    csmTitle = 'Customer Success Manager',
    quarter,
    year,
    metrics,
    productUpdates,
    recommendations,
    events = [],
    csmNote,
    includeEventsSection = true,
    includeTipsSection = true,
    tips = [],
    customIntro,
    customOutro,
    dashboardUrl,
    supportUrl,
  } = variables;

  const firstName = contactName.split(' ')[0];
  const quarterName = getQuarterName(quarter, year);

  // Generate subject
  const subject =
    variables.subject ||
    `${customerName}'s ${quarter} ${year} Update + What's New for You`;

  // Build metrics table rows
  const metricsRows = buildMetricsRows(metrics);

  // Build product updates section
  const updatesHtml = buildProductUpdatesHtml(productUpdates);
  const updatesText = buildProductUpdatesText(productUpdates);

  // Build recommendations section
  const recommendationsHtml = buildRecommendationsHtml(recommendations, customerName);
  const recommendationsText = buildRecommendationsText(recommendations);

  // Build events section
  const eventsHtml = includeEventsSection && events.length > 0 ? buildEventsHtml(events) : '';
  const eventsText = includeEventsSection && events.length > 0 ? buildEventsText(events) : '';

  // Build tips section
  const tipsHtml = includeTipsSection && tips.length > 0 ? buildTipsHtml(tips) : '';
  const tipsText = includeTipsSection && tips.length > 0 ? buildTipsText(tips) : '';

  // Build CSM note section
  const csmNoteHtml = csmNote ? buildCsmNoteHtml(csmNote, csmName) : '';
  const csmNoteText = csmNote ? `\n${csmNote}\n` : '';

  // Intro text
  const introText =
    customIntro ||
    `I hope this message finds you well! As we wrap up ${quarterName}, I wanted to share your personalized quarterly update with everything relevant to ${customerName}.`;

  // Outro text
  const outroText =
    customOutro ||
    `Questions about any of this? Just reply to this email - I'm here to help!`;

  // Build HTML email
  const bodyHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
      background-color: #f5f5f5;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .header {
      background: linear-gradient(135deg, #e63946 0%, #1d3557 100%);
      padding: 30px 20px;
      text-align: center;
    }
    .header h1 {
      color: white;
      margin: 0;
      font-size: 26px;
      font-weight: 600;
    }
    .header .subtitle {
      color: rgba(255,255,255,0.9);
      font-size: 14px;
      margin-top: 8px;
    }
    .content {
      padding: 30px;
    }
    .greeting {
      font-size: 16px;
      margin-bottom: 20px;
    }
    .section {
      margin: 30px 0;
    }
    .section-header {
      display: flex;
      align-items: center;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 2px solid #e63946;
    }
    .section-icon {
      font-size: 22px;
      margin-right: 10px;
    }
    .section-title {
      font-size: 18px;
      font-weight: 600;
      color: #1d3557;
      margin: 0;
    }
    .metrics-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
    }
    .metrics-table th,
    .metrics-table td {
      padding: 12px 15px;
      text-align: left;
      border-bottom: 1px solid #e5e5e5;
    }
    .metrics-table th {
      background-color: #f8f9fa;
      font-weight: 600;
      color: #333;
    }
    .metrics-value {
      font-weight: 600;
      font-size: 16px;
      color: #1d3557;
    }
    .metrics-change {
      font-size: 13px;
      padding: 2px 8px;
      border-radius: 12px;
      display: inline-block;
    }
    .change-positive {
      background-color: #d4edda;
      color: #155724;
    }
    .change-negative {
      background-color: #f8d7da;
      color: #721c24;
    }
    .change-neutral {
      background-color: #e2e3e5;
      color: #383d41;
    }
    .update-card {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 15px 20px;
      margin: 12px 0;
      border-left: 4px solid #e63946;
    }
    .update-card h4 {
      margin: 0 0 8px 0;
      color: #1d3557;
      font-size: 15px;
    }
    .update-card p {
      margin: 0;
      font-size: 14px;
      color: #666;
    }
    .update-card .relevance {
      margin-top: 8px;
      font-size: 13px;
      color: #e63946;
      font-style: italic;
    }
    .update-card .requested-badge {
      display: inline-block;
      background: #28a745;
      color: white;
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 10px;
      margin-left: 8px;
    }
    .recommendation-card {
      background: linear-gradient(135deg, #f0f4f8 0%, #e8ecf1 100%);
      border-radius: 8px;
      padding: 15px 20px;
      margin: 12px 0;
    }
    .recommendation-card h4 {
      margin: 0 0 8px 0;
      color: #1d3557;
      font-size: 15px;
    }
    .recommendation-card p {
      margin: 0 0 10px 0;
      font-size: 14px;
      color: #666;
    }
    .cta-button {
      display: inline-block;
      background: #e63946;
      color: white !important;
      text-decoration: none;
      padding: 10px 20px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
    }
    .cta-button:hover {
      background: #c5303c;
    }
    .cta-secondary {
      background: #1d3557;
    }
    .event-item {
      display: flex;
      margin: 12px 0;
      padding: 12px;
      background: #fff;
      border: 1px solid #e5e5e5;
      border-radius: 6px;
    }
    .event-date {
      background: #e63946;
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      text-align: center;
      margin-right: 15px;
      min-width: 60px;
    }
    .event-date .month {
      font-size: 11px;
      text-transform: uppercase;
    }
    .event-date .day {
      font-size: 20px;
      font-weight: bold;
    }
    .event-details h4 {
      margin: 0 0 5px 0;
      font-size: 14px;
      color: #1d3557;
    }
    .event-details p {
      margin: 0;
      font-size: 13px;
      color: #666;
    }
    .tips-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .tips-list li {
      padding: 10px 0 10px 30px;
      position: relative;
      border-bottom: 1px solid #f0f0f0;
    }
    .tips-list li:before {
      content: "\\2714";
      position: absolute;
      left: 0;
      color: #28a745;
      font-weight: bold;
    }
    .tips-list li:last-child {
      border-bottom: none;
    }
    .csm-note {
      background: linear-gradient(135deg, #fff8e1 0%, #fff3cd 100%);
      border-radius: 8px;
      padding: 20px;
      margin: 25px 0;
      border-left: 4px solid #ffc107;
    }
    .csm-note p {
      margin: 0;
      font-style: italic;
      color: #856404;
    }
    .csm-note .signature {
      margin-top: 10px;
      font-style: normal;
      font-weight: 600;
    }
    .divider {
      height: 1px;
      background: #e5e5e5;
      margin: 30px 0;
    }
    .footer {
      padding: 20px 30px;
      background: #f8f9fa;
      text-align: center;
      font-size: 13px;
      color: #666;
    }
    .footer a {
      color: #e63946;
      text-decoration: none;
    }
    .signature-block {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e5e5e5;
    }
    .signature-block p {
      margin: 5px 0;
    }
    @media (max-width: 480px) {
      .content {
        padding: 20px;
      }
      .metrics-table th,
      .metrics-table td {
        padding: 8px 10px;
        font-size: 14px;
      }
      .event-item {
        flex-direction: column;
      }
      .event-date {
        margin-right: 0;
        margin-bottom: 10px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${quarter} ${year} Update</h1>
      <div class="subtitle">Your personalized quarterly newsletter</div>
    </div>

    <div class="content">
      <p class="greeting">Hi ${firstName},</p>
      <p>${introText}</p>

      <!-- Metrics Section -->
      <div class="section">
        <div class="section-header">
          <span class="section-icon">&#128202;</span>
          <h2 class="section-title">Your ${quarter} ${customerName} Snapshot</h2>
        </div>
        <table class="metrics-table">
          <thead>
            <tr>
              <th>Metric</th>
              <th>Your Value</th>
              <th>vs. Last Quarter</th>
            </tr>
          </thead>
          <tbody>
            ${metricsRows}
          </tbody>
        </table>
      </div>

      ${productUpdates.length > 0 ? `
      <!-- Product Updates Section -->
      <div class="section">
        <div class="section-header">
          <span class="section-icon">&#128640;</span>
          <h2 class="section-title">What's New (Relevant for You)</h2>
        </div>
        <p style="margin-bottom: 15px; color: #666;">Based on your usage, these updates matter most:</p>
        ${updatesHtml}
      </div>
      ` : ''}

      ${recommendations.length > 0 ? `
      <!-- Recommendations Section -->
      <div class="section">
        <div class="section-header">
          <span class="section-icon">&#128161;</span>
          <h2 class="section-title">Recommended for ${customerName}</h2>
        </div>
        <p style="margin-bottom: 15px; color: #666;">Based on your team's patterns:</p>
        ${recommendationsHtml}
      </div>
      ` : ''}

      ${eventsHtml}

      ${tipsHtml}

      ${csmNoteHtml}

      <div class="divider"></div>

      <p>${outroText}</p>

      ${dashboardUrl ? `
      <div style="margin: 20px 0;">
        <a href="${dashboardUrl}" class="cta-button">View Your Dashboard</a>
      </div>
      ` : ''}

      <div class="signature-block">
        <p>Best regards,</p>
        <p><strong>${csmName}</strong></p>
        <p>${csmTitle}</p>
        <p><a href="mailto:${csmEmail}">${csmEmail}</a></p>
      </div>
    </div>

    <div class="footer">
      <p>You're receiving this because you're a valued ${customerName} stakeholder.</p>
      ${supportUrl ? `<p><a href="${supportUrl}">Need help?</a></p>` : ''}
    </div>
  </div>
</body>
</html>
  `.trim();

  // Build plain text email
  const bodyText = `
${quarter} ${year} UPDATE - ${customerName}
${'='.repeat(50)}

Hi ${firstName},

${introText}

---

YOUR ${quarter} ${customerName} SNAPSHOT
${'-'.repeat(40)}

${buildMetricsText(metrics)}

${productUpdates.length > 0 ? `
WHAT'S NEW (RELEVANT FOR YOU)
${'-'.repeat(40)}
Based on your usage, these updates matter most:

${updatesText}
` : ''}

${recommendations.length > 0 ? `
RECOMMENDED FOR ${customerName.toUpperCase()}
${'-'.repeat(40)}
Based on your team's patterns:

${recommendationsText}
` : ''}

${eventsText}

${tipsText}

${csmNoteText}

---

${outroText}

${dashboardUrl ? `View your dashboard: ${dashboardUrl}\n` : ''}

Best regards,
${csmName}
${csmTitle}
${csmEmail}

---
You're receiving this because you're a valued ${customerName} stakeholder.
  `.trim();

  return { subject, bodyHtml, bodyText };
}

// ============================================
// Helper Functions
// ============================================

function getQuarterName(quarter: string, year: number): string {
  const quarterNames: Record<string, string> = {
    Q1: 'the first quarter',
    Q2: 'the second quarter',
    Q3: 'the third quarter',
    Q4: 'the fourth quarter',
  };
  return `${quarterNames[quarter] || quarter} of ${year}`;
}

function buildMetricsRows(
  metrics: QuarterlyNewsletterVariables['metrics']
): string {
  const rows: string[] = [];

  // Health Score
  rows.push(buildMetricRow('Health Score', metrics.healthScore, metrics.healthScoreChange, 'points'));

  // Active Users
  rows.push(
    buildMetricRow(
      'Active Users',
      metrics.activeUsers,
      metrics.activeUsersChangePercent,
      '%',
      true
    )
  );

  // Feature Adoption
  rows.push(
    buildMetricRow(
      'Feature Adoption',
      `${metrics.featureAdoption}%`,
      metrics.featureAdoptionChange,
      '%'
    )
  );

  // Time Saved (optional)
  if (metrics.timeSaved !== undefined) {
    rows.push(
      buildMetricRow(
        'Time Saved',
        `${metrics.timeSaved} hrs/month`,
        metrics.timeSavedChange,
        '%'
      )
    );
  }

  // Custom metrics
  if (metrics.customMetrics) {
    for (const custom of metrics.customMetrics) {
      const value = custom.unit ? `${custom.value} ${custom.unit}` : custom.value;
      rows.push(buildMetricRow(custom.label, value, custom.change));
    }
  }

  return rows.join('');
}

function buildMetricRow(
  label: string,
  value: string | number,
  change?: number,
  changeUnit = '',
  isPercentChange = false
): string {
  let changeHtml = '';
  if (change !== undefined && change !== 0) {
    const isPositive = change > 0;
    const changeClass = isPositive ? 'change-positive' : 'change-negative';
    const arrow = isPositive ? '&uarr;' : '&darr;';
    const absChange = Math.abs(change);
    const changeText = isPercentChange
      ? `${arrow} ${absChange}%`
      : `${arrow} ${absChange} ${changeUnit}`;
    changeHtml = `<span class="metrics-change ${changeClass}">${changeText}</span>`;
  } else {
    changeHtml = `<span class="metrics-change change-neutral">&#8212;</span>`;
  }

  return `
    <tr>
      <td>${label}</td>
      <td><span class="metrics-value">${value}</span></td>
      <td>${changeHtml}</td>
    </tr>
  `;
}

function buildMetricsText(metrics: QuarterlyNewsletterVariables['metrics']): string {
  const lines: string[] = [];

  lines.push(`Health Score: ${metrics.healthScore} (${formatChange(metrics.healthScoreChange, 'points')})`);
  lines.push(`Active Users: ${metrics.activeUsers} (${formatChange(metrics.activeUsersChangePercent, '%')})`);
  lines.push(`Feature Adoption: ${metrics.featureAdoption}% (${formatChange(metrics.featureAdoptionChange, '%')})`);

  if (metrics.timeSaved !== undefined) {
    lines.push(`Time Saved: ${metrics.timeSaved} hrs/month (${formatChange(metrics.timeSavedChange, '%')})`);
  }

  if (metrics.customMetrics) {
    for (const custom of metrics.customMetrics) {
      const value = custom.unit ? `${custom.value} ${custom.unit}` : custom.value;
      lines.push(`${custom.label}: ${value} (${formatChange(custom.change)})`);
    }
  }

  return lines.join('\n');
}

function formatChange(change?: number, unit = ''): string {
  if (change === undefined || change === 0) return 'no change';
  const arrow = change > 0 ? '+' : '';
  return `${arrow}${change}${unit} vs last quarter`;
}

function buildProductUpdatesHtml(
  updates: QuarterlyNewsletterVariables['productUpdates']
): string {
  return updates
    .map(
      (update) => `
      <div class="update-card">
        <h4>${update.title}${update.wasRequested ? '<span class="requested-badge">You requested this!</span>' : ''}</h4>
        <p>${update.description}</p>
        ${update.relevanceNote ? `<p class="relevance">${update.relevanceNote}</p>` : ''}
        ${update.link ? `<p><a href="${update.link}" style="color: #e63946;">Learn more &rarr;</a></p>` : ''}
      </div>
    `
    )
    .join('');
}

function buildProductUpdatesText(
  updates: QuarterlyNewsletterVariables['productUpdates']
): string {
  return updates
    .map((update) => {
      let text = `* ${update.title}`;
      if (update.wasRequested) text += ' [You requested this!]';
      text += `\n  ${update.description}`;
      if (update.relevanceNote) text += `\n  Why this matters: ${update.relevanceNote}`;
      if (update.link) text += `\n  Learn more: ${update.link}`;
      return text;
    })
    .join('\n\n');
}

function buildRecommendationsHtml(
  recommendations: QuarterlyNewsletterVariables['recommendations'],
  customerName: string
): string {
  return recommendations
    .map(
      (rec) => `
      <div class="recommendation-card">
        <h4>${rec.title}</h4>
        <p>${rec.description}</p>
        ${rec.ctaUrl ? `<a href="${rec.ctaUrl}" class="cta-button cta-secondary">${rec.ctaText || 'Learn More'}</a>` : ''}
      </div>
    `
    )
    .join('');
}

function buildRecommendationsText(
  recommendations: QuarterlyNewsletterVariables['recommendations']
): string {
  return recommendations
    .map((rec) => {
      let text = `* ${rec.title}\n  ${rec.description}`;
      if (rec.ctaUrl) text += `\n  ${rec.ctaText || 'Learn more'}: ${rec.ctaUrl}`;
      return text;
    })
    .join('\n\n');
}

function buildEventsHtml(events: NonNullable<QuarterlyNewsletterVariables['events']>): string {
  const eventsItems = events
    .map((event) => {
      const date = new Date(event.date);
      const month = date.toLocaleDateString('en-US', { month: 'short' });
      const day = date.getDate();

      return `
        <div class="event-item">
          <div class="event-date">
            <div class="month">${month}</div>
            <div class="day">${day}</div>
          </div>
          <div class="event-details">
            <h4>${event.title}</h4>
            ${event.description ? `<p>${event.description}</p>` : ''}
            ${event.rsvpUrl ? `<p><a href="${event.rsvpUrl}" style="color: #e63946;">RSVP &rarr;</a></p>` : ''}
          </div>
        </div>
      `;
    })
    .join('');

  return `
    <div class="section">
      <div class="section-header">
        <span class="section-icon">&#128197;</span>
        <h2 class="section-title">Upcoming Events</h2>
      </div>
      ${eventsItems}
    </div>
  `;
}

function buildEventsText(events: NonNullable<QuarterlyNewsletterVariables['events']>): string {
  const eventsList = events
    .map((event) => {
      const date = new Date(event.date);
      const formattedDate = date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
      });
      let text = `* ${formattedDate}: ${event.title}`;
      if (event.description) text += `\n  ${event.description}`;
      if (event.rsvpUrl) text += `\n  RSVP: ${event.rsvpUrl}`;
      return text;
    })
    .join('\n\n');

  return `
UPCOMING EVENTS
${'-'.repeat(40)}

${eventsList}
`;
}

function buildTipsHtml(tips: string[]): string {
  const tipsList = tips.map((tip) => `<li>${tip}</li>`).join('');

  return `
    <div class="section">
      <div class="section-header">
        <span class="section-icon">&#128218;</span>
        <h2 class="section-title">Tips & Best Practices</h2>
      </div>
      <ul class="tips-list">
        ${tipsList}
      </ul>
    </div>
  `;
}

function buildTipsText(tips: string[]): string {
  const tipsList = tips.map((tip) => `* ${tip}`).join('\n');

  return `
TIPS & BEST PRACTICES
${'-'.repeat(40)}

${tipsList}
`;
}

function buildCsmNoteHtml(note: string, csmName: string): string {
  return `
    <div class="csm-note">
      <p>"${note}"</p>
      <p class="signature">- ${csmName}</p>
    </div>
  `;
}

export default generateQuarterlyNewsletterEmail;
