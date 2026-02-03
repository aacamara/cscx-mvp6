/**
 * Event Recommender Service
 * PRD-018: Recommend events to customers and generate invitation lists
 *
 * Features:
 * - Recommends events based on customer engagement and interests
 * - Identifies best contacts for invitations
 * - Generates personalized invitation content
 * - Tracks invitation status
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config/index.js';
import {
  EventDefinition,
  EventType,
  CustomerEventEngagement,
  EventInvitationRecommendation,
  CustomerInviteRecommendation,
  EventInvitation,
  AdvocacyOpportunity,
  AdvocacyType,
} from '../../../../types/eventEngagement.js';
import { engagementScorer } from './engagementScorer.js';

// Initialize Supabase client
let supabase: SupabaseClient | null = null;
if (config.supabaseUrl && config.supabaseServiceKey) {
  supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
}

// Email templates for different event types
const EMAIL_TEMPLATES: Record<EventType, { subject: string; body: string }> = {
  webinar: {
    subject: "You're Invited: {{eventName}}",
    body: `Hi {{contactName}},

Based on your interest in {{topic}}, I thought you'd find our upcoming webinar valuable.

**{{eventName}}**
Date: {{eventDate}}

This session will cover key insights that align with what your team is working on.

[Register Now]

Looking forward to seeing you there!

Best regards,
{{senderName}}`,
  },
  user_group: {
    subject: 'Join Us: {{eventName}}',
    body: `Hi {{contactName}},

As one of our most engaged customers, we'd love to have you join our upcoming user group meeting.

**{{eventName}}**
Date: {{eventDate}}

This is a great opportunity to connect with other customers, share best practices, and provide direct feedback to our product team.

[Register Now]

Hope to see you there!

Best,
{{senderName}}`,
  },
  training: {
    subject: 'Training Session: {{eventName}}',
    body: `Hi {{contactName}},

We're hosting a training session that I think would benefit your team.

**{{eventName}}**
Date: {{eventDate}}

This hands-on session will help your team {{benefit}}.

[Register Now]

Let me know if you have any questions!

Best,
{{senderName}}`,
  },
  conference: {
    subject: "Exclusive Invite: {{eventName}}",
    body: `Hi {{contactName}},

I wanted to personally invite you to our upcoming conference.

**{{eventName}}**
Date: {{eventDate}}

Given your team's engagement and success with our platform, this would be a great opportunity to connect with peers and learn about upcoming innovations.

[Register Now]

Let me know if you'd like more details!

Best,
{{senderName}}`,
  },
  workshop: {
    subject: 'Hands-on Workshop: {{eventName}}',
    body: `Hi {{contactName}},

Based on your team's usage patterns, I thought this workshop would be valuable.

**{{eventName}}**
Date: {{eventDate}}

This interactive session will help you get even more value from the platform.

[Register Now]

Hope to see you there!

Best,
{{senderName}}`,
  },
  meetup: {
    subject: 'Customer Meetup: {{eventName}}',
    body: `Hi {{contactName}},

We're hosting a casual meetup and would love for you to join!

**{{eventName}}**
Date: {{eventDate}}

This is a great opportunity to network with other customers and our team.

[Register Now]

Hope to see you there!

Best,
{{senderName}}`,
  },
  other: {
    subject: "You're Invited: {{eventName}}",
    body: `Hi {{contactName}},

I wanted to invite you to an upcoming event.

**{{eventName}}**
Date: {{eventDate}}

I think you'd find this valuable based on your interests.

[Register Now]

Best,
{{senderName}}`,
  },
};

class EventRecommenderService {
  /**
   * Get event recommendations for upcoming events
   */
  async getEventRecommendations(
    upcomingEvents: EventDefinition[]
  ): Promise<EventInvitationRecommendation[]> {
    const recommendations: EventInvitationRecommendation[] = [];

    // Get all customer engagement scores
    const customerEngagements = await this.getAllCustomerEngagements();

    for (const event of upcomingEvents) {
      // Find best candidates for this event
      const candidates = await this.findCandidatesForEvent(event, customerEngagements);

      if (candidates.length > 0) {
        recommendations.push({
          event: {
            id: event.id,
            name: event.name,
            type: event.type,
            date: event.date,
            description: event.description,
          },
          recommended_customers: candidates.slice(0, 10), // Top 10 recommendations
        });
      }
    }

    return recommendations;
  }

  /**
   * Find best candidates for a specific event
   */
  private async findCandidatesForEvent(
    event: EventDefinition,
    engagements: CustomerEventEngagement[]
  ): Promise<CustomerInviteRecommendation[]> {
    const candidates: CustomerInviteRecommendation[] = [];

    for (const engagement of engagements) {
      // Calculate relevance score
      const relevanceScore = this.calculateRelevanceScore(event, engagement);

      // Skip low relevance
      if (relevanceScore < 30) continue;

      // Get contact information
      const contact = await this.getBestContact(engagement.customer_id);

      if (!contact) continue;

      // Determine reason for recommendation
      const reason = this.generateRecommendationReason(event, engagement, relevanceScore);

      // Get previous attendance for similar events
      const similarEventsAttended = engagement.event_type_breakdown[event.type] || 0;

      candidates.push({
        customer_id: engagement.customer_id,
        customer_name: engagement.customer_name,
        reason,
        relevance_score: relevanceScore,
        contact: {
          name: contact.name,
          email: contact.email,
          role: contact.role,
        },
        previous_attendance: {
          similar_events: similarEventsAttended,
          total_events: engagement.events_attended,
        },
      });
    }

    // Sort by relevance score
    candidates.sort((a, b) => b.relevance_score - a.relevance_score);

    return candidates;
  }

  /**
   * Calculate relevance score for customer-event match
   */
  private calculateRelevanceScore(
    event: EventDefinition,
    engagement: CustomerEventEngagement
  ): number {
    let score = 0;

    // Base score from engagement level
    switch (engagement.engagement_level) {
      case 'high':
        score += 40;
        break;
      case 'good':
        score += 30;
        break;
      case 'medium':
        score += 20;
        break;
      case 'low':
        score += 10;
        break;
    }

    // Bonus for attending similar event types
    const similarEventsAttended = engagement.event_type_breakdown[event.type] || 0;
    score += Math.min(30, similarEventsAttended * 10);

    // Bonus for rising engagement trend
    if (engagement.trend === 'rising') {
      score += 15;
    } else if (engagement.trend === 'stable') {
      score += 5;
    }

    // Penalty for very recent event attendance (avoid over-inviting)
    if (engagement.days_since_last_event < 7) {
      score -= 10;
    }

    // Bonus for active participation
    if (engagement.notable_participation?.includes('Active Q&A participant')) {
      score += 10;
    }

    // Ensure score is within 0-100
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Generate recommendation reason
   */
  private generateRecommendationReason(
    event: EventDefinition,
    engagement: CustomerEventEngagement,
    relevanceScore: number
  ): string {
    const reasons: string[] = [];

    // Check for similar event type interest
    const similarEventsAttended = engagement.event_type_breakdown[event.type] || 0;
    if (similarEventsAttended >= 2) {
      reasons.push(`Attended ${similarEventsAttended} similar ${event.type}s`);
    }

    // High engagement
    if (engagement.engagement_level === 'high') {
      reasons.push('High engagement customer');
    }

    // Rising trend
    if (engagement.trend === 'rising') {
      reasons.push('Increasing event participation');
    }

    // Active participant
    if (engagement.notable_participation?.includes('Active Q&A participant')) {
      reasons.push('Active Q&A participant');
    }

    // New customer (build relationship)
    if (engagement.events_attended <= 2) {
      reasons.push('Building engagement with new customer');
    }

    // Re-engage declining customer
    if (engagement.trend === 'declining' && engagement.engagement_level !== 'low') {
      reasons.push('Re-engage with declining attendance');
    }

    return reasons.length > 0 ? reasons.join(', ') : 'Relevant interest profile';
  }

  /**
   * Get best contact for a customer
   */
  private async getBestContact(
    customerId: string
  ): Promise<{ name: string; email: string; role?: string } | null> {
    if (!supabase) {
      // Return mock contact
      return {
        name: 'Jane Doe',
        email: 'jane@customer.com',
        role: 'Product Manager',
      };
    }

    // Try to get champion first
    const { data: champion } = await supabase
      .from('stakeholders')
      .select('name, email, role')
      .eq('customer_id', customerId)
      .eq('is_champion', true)
      .single();

    if (champion) {
      return champion;
    }

    // Fall back to primary contact
    const { data: contact } = await supabase
      .from('stakeholders')
      .select('name, email, role')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    return contact;
  }

  /**
   * Get all customer engagements
   */
  private async getAllCustomerEngagements(): Promise<CustomerEventEngagement[]> {
    if (!supabase) {
      // Return mock data
      return [
        {
          customer_id: 'cust-1',
          customer_name: 'TechCorp',
          engagement_score: 95,
          engagement_level: 'high',
          trend: 'rising',
          score_components: { event_frequency: 90, event_recency: 100, event_diversity: 80, participation_depth: 90, consistency: 85 },
          total_events_available: 18,
          events_attended: 16,
          attendance_rate: 89,
          unique_users_attending: 12,
          last_event_date: new Date().toISOString(),
          days_since_last_event: 5,
          event_type_breakdown: { webinar: 8, user_group: 4, training: 2, conference: 2, workshop: 0, meetup: 0, other: 0 },
          notable_participation: ['Active Q&A participant', 'User group regular'],
          calculated_at: new Date().toISOString(),
        },
        {
          customer_id: 'cust-2',
          customer_name: 'DataPro',
          engagement_score: 85,
          engagement_level: 'high',
          trend: 'stable',
          score_components: { event_frequency: 80, event_recency: 90, event_diversity: 75, participation_depth: 85, consistency: 80 },
          total_events_available: 18,
          events_attended: 14,
          attendance_rate: 78,
          unique_users_attending: 8,
          last_event_date: new Date().toISOString(),
          days_since_last_event: 14,
          event_type_breakdown: { webinar: 6, user_group: 3, training: 3, conference: 2, workshop: 0, meetup: 0, other: 0 },
          notable_participation: ['Provides regular feedback'],
          calculated_at: new Date().toISOString(),
        },
        {
          customer_id: 'cust-3',
          customer_name: 'GrowthCo',
          engagement_score: 65,
          engagement_level: 'good',
          trend: 'rising',
          score_components: { event_frequency: 60, event_recency: 70, event_diversity: 60, participation_depth: 65, consistency: 60 },
          total_events_available: 18,
          events_attended: 8,
          attendance_rate: 44,
          unique_users_attending: 5,
          last_event_date: new Date().toISOString(),
          days_since_last_event: 21,
          event_type_breakdown: { webinar: 4, user_group: 1, training: 2, conference: 1, workshop: 0, meetup: 0, other: 0 },
          calculated_at: new Date().toISOString(),
        },
      ];
    }

    // Fetch from database - would need to aggregate attendance data
    const { data: customers } = await supabase
      .from('customers')
      .select('id, name');

    if (!customers) return [];

    // Calculate engagement for each customer
    const engagements: CustomerEventEngagement[] = [];

    for (const customer of customers) {
      const engagement = await engagementScorer.getCustomerEngagement(customer.id, 'year');
      if (engagement) {
        engagements.push(engagement);
      }
    }

    return engagements;
  }

  /**
   * Send event invitations
   */
  async sendInvitations(
    eventId: string,
    customerIds: string[],
    customSubject?: string,
    customBody?: string
  ): Promise<{
    invitations: EventInvitation[];
    sent_count: number;
    failed_count: number;
    errors: string[];
  }> {
    const invitations: EventInvitation[] = [];
    const errors: string[] = [];
    let sentCount = 0;
    let failedCount = 0;

    // Get event details
    const event = await this.getEventDetails(eventId);

    if (!event) {
      return {
        invitations: [],
        sent_count: 0,
        failed_count: customerIds.length,
        errors: ['Event not found'],
      };
    }

    // Get email template
    const template = EMAIL_TEMPLATES[event.type];

    for (const customerId of customerIds) {
      try {
        // Get contact
        const contact = await this.getBestContact(customerId);

        if (!contact) {
          errors.push(`No contact found for customer ${customerId}`);
          failedCount++;
          continue;
        }

        // Get customer name
        const customerName = await this.getCustomerName(customerId);

        // Prepare email content
        const subject = (customSubject || template.subject)
          .replace('{{eventName}}', event.name);

        const body = (customBody || template.body)
          .replace('{{contactName}}', contact.name.split(' ')[0])
          .replace('{{eventName}}', event.name)
          .replace('{{eventDate}}', new Date(event.date).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }))
          .replace('{{topic}}', event.topics?.[0] || 'your area of interest')
          .replace('{{benefit}}', 'get more value from the platform')
          .replace('{{senderName}}', 'Your Customer Success Manager');

        // Create invitation record
        const invitation: EventInvitation = {
          id: `inv-${Date.now()}-${customerId}`,
          event_id: eventId,
          event_name: event.name,
          event_date: event.date,
          customer_id: customerId,
          customer_name: customerName,
          contact_email: contact.email,
          contact_name: contact.name,
          status: 'sent',
          sent_at: new Date().toISOString(),
          email_subject: subject,
          email_body_preview: body.substring(0, 200) + '...',
        };

        // Store invitation
        if (supabase) {
          await supabase.from('event_invitations').insert(invitation);
        }

        invitations.push(invitation);
        sentCount++;

        // Note: Actual email sending would be done through Gmail service
        console.log(`[EventRecommender] Invitation sent to ${contact.email} for ${event.name}`);
      } catch (err) {
        errors.push(`Failed to send invitation to customer ${customerId}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        failedCount++;
      }
    }

    return {
      invitations,
      sent_count: sentCount,
      failed_count: failedCount,
      errors,
    };
  }

  /**
   * Create advocacy opportunities from high-engagement customers
   */
  async createAdvocacyOpportunities(
    customerIds: string[],
    advocacyTypes?: AdvocacyType[]
  ): Promise<AdvocacyOpportunity[]> {
    const opportunities: AdvocacyOpportunity[] = [];

    for (const customerId of customerIds) {
      // Get customer engagement
      const engagement = await engagementScorer.getCustomerEngagement(customerId, 'year');

      if (!engagement) continue;

      // Get customer details
      const customerName = await this.getCustomerName(customerId);
      const contact = await this.getBestContact(customerId);

      if (!contact) continue;

      // Determine advocacy types
      const types = advocacyTypes || this.determineAdvocacyTypes(engagement);

      for (const type of types) {
        const opportunity: AdvocacyOpportunity = {
          id: `adv-${Date.now()}-${customerId}-${type}`,
          customer_id: customerId,
          customer_name: customerName,
          engagement_score: engagement.engagement_score,
          advocacy_type: type,
          champion: {
            name: contact.name,
            email: contact.email,
            role: contact.role,
          },
          notes: this.generateAdvocacyNotes(engagement, type),
          status: 'created',
          next_action: this.generateNextAction(type),
          created_at: new Date().toISOString(),
        };

        // Store opportunity
        if (supabase) {
          await supabase.from('advocacy_opportunities').insert(opportunity);
        }

        opportunities.push(opportunity);
      }
    }

    return opportunities;
  }

  /**
   * Get upcoming events
   */
  async getUpcomingEvents(): Promise<EventDefinition[]> {
    if (!supabase) {
      // Return mock upcoming events
      return [
        {
          id: 'evt-upcoming-1',
          name: 'Advanced Analytics Deep Dive',
          type: 'webinar',
          date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
          description: 'Learn advanced analytics techniques',
          topics: ['analytics', 'reporting', 'dashboards'],
        },
        {
          id: 'evt-upcoming-2',
          name: 'Q1 Customer Advisory',
          type: 'user_group',
          date: new Date(Date.now() + 22 * 24 * 60 * 60 * 1000).toISOString(),
          description: 'Quarterly user group meeting',
          topics: ['roadmap', 'feedback', 'networking'],
        },
        {
          id: 'evt-upcoming-3',
          name: 'Admin Training Workshop',
          type: 'training',
          date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          description: 'Hands-on admin training',
          topics: ['administration', 'setup', 'best practices'],
        },
      ];
    }

    const { data: events } = await supabase
      .from('events')
      .select('*')
      .gte('date', new Date().toISOString())
      .order('date', { ascending: true })
      .limit(10);

    return events || [];
  }

  // ============================================
  // Helper Methods
  // ============================================

  private async getEventDetails(eventId: string): Promise<EventDefinition | null> {
    if (!supabase) {
      // Return mock event
      return {
        id: eventId,
        name: 'Advanced Analytics Deep Dive',
        type: 'webinar',
        date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        description: 'Learn advanced analytics techniques',
        topics: ['analytics', 'reporting'],
      };
    }

    const { data: event } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();

    return event;
  }

  private async getCustomerName(customerId: string): Promise<string> {
    if (!supabase) {
      return 'Test Customer';
    }

    const { data: customer } = await supabase
      .from('customers')
      .select('name')
      .eq('id', customerId)
      .single();

    return customer?.name || 'Unknown';
  }

  private determineAdvocacyTypes(engagement: CustomerEventEngagement): AdvocacyType[] {
    const types: AdvocacyType[] = [];

    if (engagement.engagement_score >= 90) {
      types.push('case_study');
      types.push('reference');
    }

    if (engagement.notable_participation?.includes('Active Q&A participant')) {
      types.push('speaking');
    }

    if (engagement.event_type_breakdown.user_group >= 3) {
      types.push('advisory_board');
    }

    if (types.length === 0) {
      types.push('reference');
    }

    return types;
  }

  private generateAdvocacyNotes(
    engagement: CustomerEventEngagement,
    type: AdvocacyType
  ): string {
    const notes: string[] = [];

    notes.push(`Engagement score: ${engagement.engagement_score}/100`);
    notes.push(`Events attended: ${engagement.events_attended}/${engagement.total_events_available}`);

    if (engagement.notable_participation && engagement.notable_participation.length > 0) {
      notes.push(`Notable: ${engagement.notable_participation.join(', ')}`);
    }

    return notes.join('. ');
  }

  private generateNextAction(type: AdvocacyType): string {
    switch (type) {
      case 'case_study':
        return 'Schedule case study discussion call';
      case 'reference':
        return 'Request to join reference pool';
      case 'advisory_board':
        return 'Invite to advisory board';
      case 'speaking':
        return 'Discuss speaking opportunity';
      case 'beta_tester':
        return 'Invite to beta program';
      default:
        return 'Schedule follow-up';
    }
  }
}

// Export singleton instance
export const eventRecommender = new EventRecommenderService();
export default eventRecommender;
