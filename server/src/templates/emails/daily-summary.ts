/**
 * Daily Summary Email Template
 * PRD-150: End of Day -> Daily Summary
 *
 * Generates professional end-of-day summary emails for CSMs
 */

import type { DailySummary } from '../../../../types/dailySummary.js';

export interface DailySummaryEmailData {
  summary: DailySummary;
  csmName: string;
  csmEmail: string;
}

export interface DailySummaryEmailResult {
  subject: string;
  bodyHtml: string;
  bodyText: string;
}

/**
 * Generate daily summary email
 */
export function generateDailySummaryEmail(data: DailySummaryEmailData): DailySummaryEmailResult {
  const { summary, csmName } = data;

  // Format date for display
  const formattedDate = formatDateLong(summary.date);
  const shortDate = formatDateShort(summary.date);

  // Calculate totals
  const totalAccomplishments =
    summary.accomplishments.tasksCompleted.length +
    summary.accomplishments.meetingsHeld.length +
    summary.accomplishments.emailsSent +
    summary.accomplishments.callsMade;

  const totalAttention =
    summary.attention.overdueTasks.length +
    summary.attention.missedFollowUps.length +
    summary.attention.alerts.length +
    summary.attention.pendingApprovals.length +
    summary.attention.unansweredEmails.length;

  // Build sections
  const accomplishmentsSection = buildAccomplishmentsSection(summary);
  const tomorrowSection = buildTomorrowSection(summary);
  const attentionSection = buildAttentionSection(summary);
  const portfolioSection = buildPortfolioSection(summary);
  const metricsSection = buildMetricsSection(summary);

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
      padding: 20px;
      background-color: #ffffff;
    }
    .header {
      text-align: center;
      padding: 20px 0;
      border-bottom: 3px solid #e63946;
      margin-bottom: 30px;
    }
    .header h1 {
      margin: 0;
      color: #e63946;
      font-size: 24px;
    }
    .header .date {
      color: #666;
      font-size: 14px;
      margin-top: 5px;
    }
    .greeting {
      font-size: 18px;
      margin-bottom: 20px;
    }
    .section {
      margin: 25px 0;
      padding: 20px;
      border-radius: 8px;
    }
    .section-header {
      display: flex;
      align-items: center;
      margin-bottom: 15px;
      font-size: 16px;
      font-weight: 600;
      color: #333;
    }
    .section-icon {
      font-size: 20px;
      margin-right: 10px;
    }
    .accomplishments {
      background: linear-gradient(135deg, #f0fff4 0%, #e8f5e9 100%);
      border-left: 4px solid #28a745;
    }
    .tomorrow {
      background: linear-gradient(135deg, #e3f2fd 0%, #e1f5fe 100%);
      border-left: 4px solid #2196f3;
    }
    .attention {
      background: linear-gradient(135deg, #fff8e1 0%, #fff3e0 100%);
      border-left: 4px solid #ff9800;
    }
    .attention.has-urgent {
      background: linear-gradient(135deg, #ffebee 0%, #fce4ec 100%);
      border-left: 4px solid #f44336;
    }
    .portfolio {
      background: linear-gradient(135deg, #f3e5f5 0%, #ede7f6 100%);
      border-left: 4px solid #9c27b0;
    }
    .metrics {
      background: linear-gradient(135deg, #e0f7fa 0%, #e0f2f1 100%);
      border-left: 4px solid #00bcd4;
    }
    .stat-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
      margin-top: 10px;
    }
    .stat-item {
      text-align: center;
      padding: 10px;
      background: rgba(255,255,255,0.7);
      border-radius: 6px;
    }
    .stat-value {
      font-size: 24px;
      font-weight: bold;
      color: #333;
    }
    .stat-label {
      font-size: 12px;
      color: #666;
      text-transform: uppercase;
    }
    .stat-change {
      font-size: 11px;
      margin-top: 3px;
    }
    .stat-change.positive { color: #28a745; }
    .stat-change.negative { color: #dc3545; }
    ul {
      margin: 10px 0;
      padding-left: 20px;
    }
    li {
      margin: 8px 0;
    }
    .customer-name {
      color: #e63946;
      font-weight: 500;
    }
    .priority-high {
      color: #dc3545;
      font-weight: 600;
    }
    .priority-medium {
      color: #ff9800;
    }
    .health-indicator {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      margin-right: 5px;
    }
    .health-green { background-color: #28a745; }
    .health-yellow { background-color: #ffc107; }
    .health-red { background-color: #dc3545; }
    .health-bar {
      display: flex;
      height: 20px;
      border-radius: 10px;
      overflow: hidden;
      margin: 10px 0;
    }
    .health-bar-segment {
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 11px;
      font-weight: bold;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #eee;
      text-align: center;
      color: #666;
      font-size: 12px;
    }
    .footer a {
      color: #e63946;
      text-decoration: none;
    }
    .cta-button {
      display: inline-block;
      padding: 12px 24px;
      background-color: #e63946;
      color: white !important;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      margin: 10px 0;
    }
    .empty-state {
      text-align: center;
      padding: 15px;
      color: #666;
      font-style: italic;
    }
    @media (max-width: 480px) {
      .stat-grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Daily Summary</h1>
      <div class="date">${formattedDate}</div>
    </div>

    <p class="greeting">Hi ${csmName.split(' ')[0]},</p>
    <p>Here's your end-of-day summary. You accomplished ${totalAccomplishments} activities today${totalAttention > 0 ? ` and have ${totalAttention} items needing attention` : ''}.</p>

    ${accomplishmentsSection}

    ${tomorrowSection}

    ${totalAttention > 0 ? attentionSection : ''}

    ${portfolioSection}

    ${metricsSection}

    <div style="text-align: center; margin: 30px 0;">
      <a href="${process.env.APP_URL || 'https://app.cscx.ai'}/summary/${summary.id}" class="cta-button">
        View Full Summary
      </a>
    </div>

    <div class="footer">
      <p>Have a great evening!</p>
      <p>
        <a href="${process.env.APP_URL || 'https://app.cscx.ai'}/settings/summary">Manage summary preferences</a>
      </p>
      <p style="margin-top: 15px; color: #999;">
        CSCX.AI - Your AI-Powered Customer Success Platform
      </p>
    </div>
  </div>
</body>
</html>
`;

  // Build plain text version
  const bodyText = buildPlainTextSummary(data);

  // Subject line
  const subject = `Daily Summary - ${shortDate} | ${summary.accomplishments.tasksCompleted.length} tasks, ${summary.accomplishments.meetingsHeld.length} meetings`;

  return {
    subject,
    bodyHtml,
    bodyText,
  };
}

// ============================================
// Section Builders
// ============================================

function buildAccomplishmentsSection(summary: DailySummary): string {
  const { accomplishments } = summary;

  const tasksList = accomplishments.tasksCompleted.length > 0
    ? `<ul>${accomplishments.tasksCompleted.slice(0, 5).map(t =>
        `<li>${t.title}${t.customerName ? ` - <span class="customer-name">${t.customerName}</span>` : ''}</li>`
      ).join('')}</ul>`
    : '';

  const meetingsList = accomplishments.meetingsHeld.length > 0
    ? `<ul>${accomplishments.meetingsHeld.slice(0, 5).map(m =>
        `<li>${m.title}${m.customerName ? ` with <span class="customer-name">${m.customerName}</span>` : ''}${m.outcome ? ` - ${m.outcome}` : ''}</li>`
      ).join('')}</ul>`
    : '';

  return `
    <div class="section accomplishments">
      <div class="section-header">
        <span class="section-icon">&#127942;</span>
        Today's Accomplishments
      </div>

      <div class="stat-grid">
        <div class="stat-item">
          <div class="stat-value">${accomplishments.tasksCompleted.length}</div>
          <div class="stat-label">Tasks Completed</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${accomplishments.meetingsHeld.length}</div>
          <div class="stat-label">Meetings Held</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${accomplishments.emailsSent}</div>
          <div class="stat-label">Emails Sent</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${accomplishments.callsMade}</div>
          <div class="stat-label">Calls Made</div>
        </div>
      </div>

      ${tasksList && `<div style="margin-top: 15px;"><strong>Tasks:</strong>${tasksList}</div>`}
      ${meetingsList && `<div style="margin-top: 15px;"><strong>Meetings:</strong>${meetingsList}</div>`}
      ${accomplishments.issuesResolved.length > 0 ? `<div style="margin-top: 15px;"><strong>Issues Resolved:</strong> ${accomplishments.issuesResolved.join(', ')}</div>` : ''}
    </div>
  `;
}

function buildTomorrowSection(summary: DailySummary): string {
  const { tomorrow } = summary;

  const meetingsList = tomorrow.meetings.length > 0
    ? `<ul>${tomorrow.meetings.map(m => {
        const time = formatTime(m.startTime);
        return `<li><strong>${time}</strong> - ${m.title}${m.customerName ? ` with <span class="customer-name">${m.customerName}</span>` : ''}</li>`;
      }).join('')}</ul>`
    : '<div class="empty-state">No meetings scheduled</div>';

  const tasksList = tomorrow.tasksDue.length > 0
    ? `<ul>${tomorrow.tasksDue.slice(0, 5).map(t =>
        `<li class="${t.priority === 'high' || t.priority === 'urgent' ? 'priority-high' : ''}">${t.title}${t.customerName ? ` - <span class="customer-name">${t.customerName}</span>` : ''}</li>`
      ).join('')}</ul>`
    : '<div class="empty-state">No tasks due</div>';

  const deadlinesList = tomorrow.deadlines.length > 0
    ? `<ul>${tomorrow.deadlines.map(d =>
        `<li><strong>${d.daysUntilDue} days:</strong> ${d.title}</li>`
      ).join('')}</ul>`
    : '';

  return `
    <div class="section tomorrow">
      <div class="section-header">
        <span class="section-icon">&#128197;</span>
        Tomorrow's Preview
      </div>

      <div style="margin-bottom: 15px;">
        <strong>Meetings (${tomorrow.meetings.length}):</strong>
        ${meetingsList}
      </div>

      <div style="margin-bottom: 15px;">
        <strong>Tasks Due (${tomorrow.tasksDue.length}):</strong>
        ${tasksList}
      </div>

      ${deadlinesList ? `<div><strong>Upcoming Deadlines:</strong>${deadlinesList}</div>` : ''}

      ${tomorrow.reminders.length > 0 ? `
        <div style="margin-top: 15px;">
          <strong>Reminders:</strong>
          <ul>${tomorrow.reminders.map(r => `<li>${r.title}</li>`).join('')}</ul>
        </div>
      ` : ''}
    </div>
  `;
}

function buildAttentionSection(summary: DailySummary): string {
  const { attention } = summary;
  const hasUrgent = attention.alerts.some(a => a.severity === 'critical' || a.severity === 'high');

  let content = '';

  if (attention.overdueTasks.length > 0) {
    content += `
      <div style="margin-bottom: 15px;">
        <strong>Overdue Tasks (${attention.overdueTasks.length}):</strong>
        <ul>${attention.overdueTasks.slice(0, 5).map(t =>
          `<li class="priority-high">${t.title}${t.customerName ? ` - ${t.customerName}` : ''}</li>`
        ).join('')}</ul>
      </div>
    `;
  }

  if (attention.alerts.length > 0) {
    content += `
      <div style="margin-bottom: 15px;">
        <strong>Alerts (${attention.alerts.length}):</strong>
        <ul>${attention.alerts.map(a => {
          const icon = a.severity === 'critical' ? '&#128680;' : a.severity === 'high' ? '&#9888;' : '&#128161;';
          return `<li>${icon} ${a.title}${a.customerName ? ` - <span class="customer-name">${a.customerName}</span>` : ''}</li>`;
        }).join('')}</ul>
      </div>
    `;
  }

  if (attention.pendingApprovals.length > 0) {
    content += `
      <div style="margin-bottom: 15px;">
        <strong>Pending Approvals (${attention.pendingApprovals.length}):</strong>
        <ul>${attention.pendingApprovals.map(a =>
          `<li>${a.title}</li>`
        ).join('')}</ul>
      </div>
    `;
  }

  if (attention.missedFollowUps.length > 0) {
    content += `
      <div>
        <strong>Missed Follow-ups (${attention.missedFollowUps.length}):</strong>
        <ul>${attention.missedFollowUps.map(f =>
          `<li>${f.title} (${f.daysOverdue} days overdue)</li>`
        ).join('')}</ul>
      </div>
    `;
  }

  return `
    <div class="section attention ${hasUrgent ? 'has-urgent' : ''}">
      <div class="section-header">
        <span class="section-icon">${hasUrgent ? '&#128680;' : '&#9888;'}</span>
        Attention Required
      </div>
      ${content}
    </div>
  `;
}

function buildPortfolioSection(summary: DailySummary): string {
  const { portfolio } = summary;
  const total = portfolio.totalCustomers;
  const greenPct = total > 0 ? Math.round(portfolio.healthDistribution.green / total * 100) : 0;
  const yellowPct = total > 0 ? Math.round(portfolio.healthDistribution.yellow / total * 100) : 0;
  const redPct = total > 0 ? Math.round(portfolio.healthDistribution.red / total * 100) : 0;

  const needingAttentionList = portfolio.needingAttention.length > 0
    ? `<ul>${portfolio.needingAttention.map(c => `
        <li>
          <span class="health-indicator health-${c.healthColor}"></span>
          <strong>${c.name}</strong> - Health: ${c.healthScore}, ARR: $${c.arr.toLocaleString()}
          <br><small>${c.reason}</small>
        </li>
      `).join('')}</ul>`
    : '<div class="empty-state">All customers healthy!</div>';

  const renewalsList = portfolio.upcomingRenewals.length > 0
    ? `<ul>${portfolio.upcomingRenewals.map(r => `
        <li>
          <span class="health-indicator health-${r.healthColor}"></span>
          <strong>${r.customerName}</strong> - ${r.daysUntilRenewal} days (${formatDateShort(r.renewalDate)})
          <br><small>ARR: $${r.arr.toLocaleString()} | Health: ${r.healthScore}</small>
        </li>
      `).join('')}</ul>`
    : '<div class="empty-state">No renewals in next 30 days</div>';

  return `
    <div class="section portfolio">
      <div class="section-header">
        <span class="section-icon">&#128202;</span>
        Portfolio Health (${portfolio.totalCustomers} customers)
      </div>

      <div class="health-bar">
        <div class="health-bar-segment" style="width: ${greenPct}%; background-color: #28a745;">${portfolio.healthDistribution.green}</div>
        <div class="health-bar-segment" style="width: ${yellowPct}%; background-color: #ffc107;">${portfolio.healthDistribution.yellow}</div>
        <div class="health-bar-segment" style="width: ${redPct}%; background-color: #dc3545;">${portfolio.healthDistribution.red}</div>
      </div>

      <div style="display: flex; justify-content: space-around; margin: 15px 0; font-size: 12px;">
        <span><span class="health-indicator health-green"></span> Healthy: ${portfolio.healthDistribution.green}</span>
        <span><span class="health-indicator health-yellow"></span> Needs Attention: ${portfolio.healthDistribution.yellow}</span>
        <span><span class="health-indicator health-red"></span> At Risk: ${portfolio.healthDistribution.red}</span>
      </div>

      ${portfolio.riskSignals > 0 ? `<p><strong>Active Risk Signals:</strong> ${portfolio.riskSignals}</p>` : ''}

      <div style="margin-top: 15px;">
        <strong>Customers Needing Attention:</strong>
        ${needingAttentionList}
      </div>

      <div style="margin-top: 15px;">
        <strong>Upcoming Renewals (30 days):</strong>
        ${renewalsList}
      </div>
    </div>
  `;
}

function buildMetricsSection(summary: DailySummary): string {
  const { metrics } = summary;

  const formatChange = (change: number, inverse = false) => {
    const adjustedChange = inverse ? -change : change;
    const className = adjustedChange > 0 ? 'positive' : adjustedChange < 0 ? 'negative' : '';
    const prefix = adjustedChange > 0 ? '+' : '';
    return `<div class="stat-change ${className}">${prefix}${adjustedChange}% vs avg</div>`;
  };

  return `
    <div class="section metrics">
      <div class="section-header">
        <span class="section-icon">&#128200;</span>
        Key Metrics
      </div>

      <div class="stat-grid">
        <div class="stat-item">
          <div class="stat-value">${metrics.customerTouches}</div>
          <div class="stat-label">Customer Touches</div>
          ${formatChange(metrics.vsAverage.customerTouches)}
        </div>
        <div class="stat-item">
          <div class="stat-value">${metrics.taskCompletionRate}%</div>
          <div class="stat-label">Task Completion</div>
          ${formatChange(metrics.vsAverage.taskCompletionRate)}
        </div>
        <div class="stat-item">
          <div class="stat-value">${metrics.avgResponseTime}h</div>
          <div class="stat-label">Avg Response Time</div>
          ${formatChange(metrics.vsAverage.responseTime, true)}
        </div>
        <div class="stat-item">
          <div class="stat-value">${summary.accomplishments.meetingsHeld.length}</div>
          <div class="stat-label">Meetings Today</div>
        </div>
      </div>
    </div>
  `;
}

// ============================================
// Plain Text Builder
// ============================================

function buildPlainTextSummary(data: DailySummaryEmailData): string {
  const { summary, csmName } = data;
  const date = formatDateLong(summary.date);

  return `
DAILY SUMMARY - ${date}
========================

Hi ${csmName.split(' ')[0]},

Here's your end-of-day summary.

TODAY'S ACCOMPLISHMENTS
-----------------------
- Tasks Completed: ${summary.accomplishments.tasksCompleted.length}
- Meetings Held: ${summary.accomplishments.meetingsHeld.length}
- Emails Sent: ${summary.accomplishments.emailsSent}
- Calls Made: ${summary.accomplishments.callsMade}

${summary.accomplishments.tasksCompleted.length > 0 ? `Tasks:\n${summary.accomplishments.tasksCompleted.map(t => `  - ${t.title}${t.customerName ? ` (${t.customerName})` : ''}`).join('\n')}` : ''}

${summary.accomplishments.meetingsHeld.length > 0 ? `Meetings:\n${summary.accomplishments.meetingsHeld.map(m => `  - ${m.title}${m.customerName ? ` with ${m.customerName}` : ''}`).join('\n')}` : ''}

TOMORROW'S PREVIEW
------------------
- Scheduled Meetings: ${summary.tomorrow.meetings.length}
- Tasks Due: ${summary.tomorrow.tasksDue.length}
- Reminders: ${summary.tomorrow.reminders.length}

${summary.tomorrow.meetings.length > 0 ? `Meetings:\n${summary.tomorrow.meetings.map(m => `  - ${formatTime(m.startTime)}: ${m.title}`).join('\n')}` : ''}

${summary.tomorrow.tasksDue.length > 0 ? `Tasks Due:\n${summary.tomorrow.tasksDue.map(t => `  - ${t.title}`).join('\n')}` : ''}

${summary.attention.overdueTasks.length + summary.attention.alerts.length > 0 ? `
ATTENTION REQUIRED
------------------
${summary.attention.overdueTasks.length > 0 ? `Overdue Tasks: ${summary.attention.overdueTasks.length}\n${summary.attention.overdueTasks.map(t => `  - ${t.title}`).join('\n')}` : ''}

${summary.attention.alerts.length > 0 ? `Alerts: ${summary.attention.alerts.length}\n${summary.attention.alerts.map(a => `  - [${a.severity.toUpperCase()}] ${a.title}`).join('\n')}` : ''}
` : ''}

PORTFOLIO HEALTH
----------------
Total Customers: ${summary.portfolio.totalCustomers}
- Healthy (Green): ${summary.portfolio.healthDistribution.green}
- Needs Attention (Yellow): ${summary.portfolio.healthDistribution.yellow}
- At Risk (Red): ${summary.portfolio.healthDistribution.red}

${summary.portfolio.upcomingRenewals.length > 0 ? `Upcoming Renewals (30 days):\n${summary.portfolio.upcomingRenewals.map(r => `  - ${r.customerName}: ${r.daysUntilRenewal} days ($${r.arr.toLocaleString()})`).join('\n')}` : ''}

KEY METRICS
-----------
- Customer Touches: ${summary.metrics.customerTouches} (${summary.metrics.vsAverage.customerTouches > 0 ? '+' : ''}${summary.metrics.vsAverage.customerTouches}% vs avg)
- Task Completion: ${summary.metrics.taskCompletionRate}%
- Avg Response Time: ${summary.metrics.avgResponseTime}h

---
View full summary: ${process.env.APP_URL || 'https://app.cscx.ai'}/summary/${summary.id}
Manage preferences: ${process.env.APP_URL || 'https://app.cscx.ai'}/settings/summary

Have a great evening!
CSCX.AI
  `.trim();
}

// ============================================
// Helper Functions
// ============================================

function formatDateLong(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function formatTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return dateStr;
  }
}

export default generateDailySummaryEmail;
