/**
 * Feedback Planned Follow-Up Email Template
 * PRD-053: Product Feedback Follow-Up
 *
 * Used when customer feedback has been accepted and is on the roadmap.
 * Shares timeline and gathers additional input.
 */

export interface FeedbackPlannedVariables {
  // Customer info
  customerName: string;
  contactName: string;
  contactEmail: string;
  contactTitle?: string;

  // CSM info
  csmName: string;
  csmEmail: string;
  csmTitle?: string;
  csmCalendarUrl?: string;

  // Original feedback context
  originalFeedback: {
    summary: string;
    submittedDate: string;
    source?: string;
  };

  // Planned feature details
  featureName: string;
  featureDescription: string;

  // Timeline information
  timeline: {
    quarter?: string; // 'Q2 2026'
    estimatedDate?: string; // 'March 2026'
    stage: 'researching' | 'designing' | 'development' | 'beta' | 'staging';
    milestone?: string; // 'Initial design review'
  };

  // What's being built
  plannedCapabilities: string[];

  // Opportunities for input
  inputOpportunities?: {
    betaProgram?: {
      available: boolean;
      signupUrl?: string;
    };
    feedbackSession?: {
      available: boolean;
      schedulingUrl?: string;
    };
    surveyUrl?: string;
  };

  // Optional
  personalNote?: string;
  additionalContext?: string;
}

export interface FeedbackPlannedResult {
  subject: string;
  bodyHtml: string;
  bodyText: string;
}

const stageInfo: Record<string, { label: string; color: string; progress: number }> = {
  researching: { label: 'Researching', color: '#9c27b0', progress: 20 },
  designing: { label: 'In Design', color: '#2196f3', progress: 40 },
  development: { label: 'In Development', color: '#ff9800', progress: 60 },
  beta: { label: 'Beta Testing', color: '#4caf50', progress: 80 },
  staging: { label: 'Staging', color: '#00bcd4', progress: 90 },
};

export function generateFeedbackPlannedEmail(variables: FeedbackPlannedVariables): FeedbackPlannedResult {
  const {
    customerName,
    contactName,
    csmName,
    csmTitle = 'Customer Success Manager',
    csmEmail,
    csmCalendarUrl,
    originalFeedback,
    featureName,
    featureDescription,
    timeline,
    plannedCapabilities,
    inputOpportunities,
    personalNote,
    additionalContext,
  } = variables;

  const firstName = contactName.split(' ')[0];
  const stage = stageInfo[timeline.stage] || stageInfo.researching;
  const timelineText = timeline.quarter || timeline.estimatedDate || 'Coming soon';

  const subject = `Update: ${featureName} is On Our Roadmap!`;

  // Build progress bar HTML
  const progressBar = `
    <div style="background: #e0e0e0; border-radius: 10px; height: 12px; margin: 15px 0; overflow: hidden;">
      <div style="background: linear-gradient(90deg, ${stage.color} 0%, ${stage.color}cc 100%); width: ${stage.progress}%; height: 100%; border-radius: 10px; transition: width 0.5s;"></div>
    </div>
    <div style="display: flex; justify-content: space-between; font-size: 11px; color: #888;">
      <span>Researching</span>
      <span>Design</span>
      <span>Development</span>
      <span>Beta</span>
      <span>Launch</span>
    </div>
  `;

  const bodyHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #2196f3 0%, #1565c0 100%); padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
    .header h1 { color: white; margin: 0 0 10px 0; font-size: 24px; }
    .header .icon { font-size: 48px; margin-bottom: 15px; }
    .header .tagline { color: rgba(255,255,255,0.9); font-size: 14px; }
    .content { background: #fff; padding: 30px; border: 1px solid #e5e5e5; border-top: none; }
    .feedback-context { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #9e9e9e; }
    .feedback-context .label { font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
    .feedback-context .quote { font-style: italic; color: #555; margin: 0; }
    .feedback-context .meta { font-size: 12px; color: #888; margin-top: 10px; }
    .roadmap-box { background: #e3f2fd; padding: 25px; border-radius: 8px; margin: 20px 0; }
    .roadmap-box h3 { color: #1565c0; margin: 0 0 10px 0; }
    .roadmap-box .timeline-badge { display: inline-block; background: #1565c0; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; margin-bottom: 15px; }
    .roadmap-box .stage-badge { display: inline-block; background: ${stage.color}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; margin-left: 8px; }
    .capabilities-preview { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .capabilities-preview h4 { margin: 0 0 15px 0; color: #333; }
    .capabilities-preview ul { margin: 0; padding-left: 20px; }
    .capabilities-preview li { margin: 8px 0; color: #555; }
    .input-opportunities { margin: 25px 0; }
    .opportunity-card { background: #fff; border: 2px solid #e0e0e0; border-radius: 8px; padding: 20px; margin: 12px 0; transition: border-color 0.2s; }
    .opportunity-card:hover { border-color: #2196f3; }
    .opportunity-card h4 { margin: 0 0 8px 0; color: #1565c0; }
    .opportunity-card p { margin: 0 0 12px 0; font-size: 14px; color: #666; }
    .opportunity-card .cta { display: inline-block; background: #2196f3; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px; font-size: 13px; font-weight: 600; }
    .context-box { background: #f5f5f5; padding: 15px 20px; border-radius: 8px; margin: 20px 0; }
    .personal-note { background: #fffde7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107; }
    .cta-button { display: inline-block; background: #e63946; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin: 10px 10px 10px 0; font-weight: 600; }
    .footer { padding: 20px; font-size: 14px; color: #666; border-top: 1px solid #e5e5e5; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="icon">🗺️</div>
      <h1>It's On Our Roadmap!</h1>
      <p class="tagline">Your feedback is shaping our product</p>
    </div>
    <div class="content">
      <p>Hi ${firstName},</p>

      <p>I wanted to share an exciting update about feedback you shared with us. We've been listening, and I'm happy to let you know that <strong>we're building it!</strong></p>

      <div class="feedback-context">
        <div class="label">Your Original Feedback</div>
        <p class="quote">"${originalFeedback.summary}"</p>
        <div class="meta">Submitted ${originalFeedback.submittedDate}${originalFeedback.source ? ` during ${originalFeedback.source}` : ''}</div>
      </div>

      <div class="roadmap-box">
        <span class="timeline-badge">Target: ${timelineText}</span>
        <span class="stage-badge">${stage.label}</span>
        <h3>${featureName}</h3>
        <p style="margin: 15px 0 0 0;">${featureDescription}</p>
        ${progressBar}
        ${timeline.milestone ? `<p style="text-align: center; color: #666; font-size: 13px; margin-top: 15px;"><strong>Current Milestone:</strong> ${timeline.milestone}</p>` : ''}
      </div>

      <div class="capabilities-preview">
        <h4>What We're Planning to Build:</h4>
        <ul>
          ${plannedCapabilities.map(cap => `<li>${cap}</li>`).join('\n          ')}
        </ul>
      </div>

      ${additionalContext ? `
      <div class="context-box">
        ${additionalContext}
      </div>
      ` : ''}

      ${inputOpportunities && (inputOpportunities.betaProgram?.available || inputOpportunities.feedbackSession?.available || inputOpportunities.surveyUrl) ? `
      <div class="input-opportunities">
        <h4>Want to Help Shape This Feature?</h4>
        <p style="color: #666; margin-bottom: 15px;">We'd love your continued input to make sure we get this right for ${customerName}:</p>

        ${inputOpportunities.betaProgram?.available ? `
        <div class="opportunity-card">
          <h4>Join the Beta Program</h4>
          <p>Get early access and help us refine the feature before launch.</p>
          ${inputOpportunities.betaProgram.signupUrl ? `<a href="${inputOpportunities.betaProgram.signupUrl}" class="cta">Sign Up for Beta</a>` : '<span style="color: #888; font-size: 13px;">Reply to this email to express interest</span>'}
        </div>
        ` : ''}

        ${inputOpportunities.feedbackSession?.available ? `
        <div class="opportunity-card">
          <h4>Join a Feedback Session</h4>
          <p>Share your detailed requirements with our product team in a 30-minute call.</p>
          ${inputOpportunities.feedbackSession.schedulingUrl ? `<a href="${inputOpportunities.feedbackSession.schedulingUrl}" class="cta">Schedule Session</a>` : '<span style="color: #888; font-size: 13px;">Reply to express interest</span>'}
        </div>
        ` : ''}

        ${inputOpportunities.surveyUrl ? `
        <div class="opportunity-card">
          <h4>Quick Survey</h4>
          <p>Help prioritize specific capabilities (2 min).</p>
          <a href="${inputOpportunities.surveyUrl}" class="cta">Take Survey</a>
        </div>
        ` : ''}
      </div>
      ` : ''}

      ${personalNote ? `
      <div class="personal-note">
        ${personalNote}
      </div>
      ` : ''}

      <p>I'll keep you updated as we make progress. Your input was instrumental in getting this on our roadmap, and we want to make sure it meets your needs.</p>

      <p>Have additional thoughts or requirements? I'd love to hear them!</p>

      ${csmCalendarUrl ? `
      <div style="margin: 25px 0;">
        <a href="${csmCalendarUrl}" class="cta-button">Discuss Your Requirements</a>
      </div>
      ` : ''}

      <p>
        Best regards,<br>
        <strong>${csmName}</strong><br>
        ${csmTitle}<br>
        ${csmEmail}
      </p>
    </div>
    <div class="footer">
      <p>You're receiving this update because your feedback is actively being incorporated into our product roadmap.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const bodyText = `
IT'S ON OUR ROADMAP!
Your feedback is shaping our product

Hi ${firstName},

I wanted to share an exciting update about feedback you shared with us. We've been listening, and I'm happy to let you know that we're building it!

YOUR ORIGINAL FEEDBACK:
"${originalFeedback.summary}"
Submitted ${originalFeedback.submittedDate}${originalFeedback.source ? ` during ${originalFeedback.source}` : ''}

PLANNED: ${featureName}
Target: ${timelineText}
Status: ${stage.label}

${featureDescription}

${timeline.milestone ? `Current Milestone: ${timeline.milestone}\n` : ''}

WHAT WE'RE PLANNING TO BUILD:
${plannedCapabilities.map(cap => `* ${cap}`).join('\n')}

${additionalContext ? `\n${additionalContext}\n` : ''}

${inputOpportunities && (inputOpportunities.betaProgram?.available || inputOpportunities.feedbackSession?.available || inputOpportunities.surveyUrl) ? `
WANT TO HELP SHAPE THIS FEATURE?

${inputOpportunities.betaProgram?.available ? `* Beta Program: ${inputOpportunities.betaProgram.signupUrl || 'Reply to express interest'}` : ''}
${inputOpportunities.feedbackSession?.available ? `* Feedback Session: ${inputOpportunities.feedbackSession.schedulingUrl || 'Reply to express interest'}` : ''}
${inputOpportunities.surveyUrl ? `* Quick Survey: ${inputOpportunities.surveyUrl}` : ''}
` : ''}

${personalNote ? `Note: ${personalNote}\n` : ''}

I'll keep you updated as we make progress. Your input was instrumental in getting this on our roadmap, and we want to make sure it meets your needs.

Have additional thoughts or requirements? I'd love to hear them!

${csmCalendarUrl ? `Discuss your requirements: ${csmCalendarUrl}\n` : ''}

Best regards,
${csmName}
${csmTitle}
${csmEmail}

---
You're receiving this update because your feedback is actively being incorporated into our product roadmap.
  `.trim();

  return { subject, bodyHtml, bodyText };
}

export default generateFeedbackPlannedEmail;
