/**
 * PRD-268: Location-Based Reminders Service
 *
 * Provides geofencing and location-based notification services for CSMs
 * visiting customer sites. Supports arrival/departure triggers, visit
 * logging, and privacy controls.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config/index.js';

// ============================================
// Types
// ============================================

export interface CustomerLocation {
  id: string;
  customer_id: string;
  label: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
  geofence_radius: number;
  is_primary: boolean;
  geofence_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface LocationPreferences {
  user_id: string;
  location_tracking_enabled: boolean;
  arrival_notifications: boolean;
  departure_notifications: boolean;
  geofence_radius_default: number;
  excluded_locations: ExcludedLocation[];
  battery_optimization: 'low' | 'balanced' | 'high';
  precise_location: boolean;
  updated_at: string;
}

export interface ExcludedLocation {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  radius: number;
}

export interface VisitLog {
  id: string;
  user_id: string;
  customer_id: string;
  location_id: string | null;
  arrival_time: string | null;
  departure_time: string | null;
  duration_minutes: number | null;
  notes: string | null;
  follow_up_tasks: FollowUpTask[];
  voice_note_url: string | null;
  is_planned: boolean;
  calendar_event_id: string | null;
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed' | null;
  created_at: string;
  updated_at: string;
}

export interface FollowUpTask {
  id: string;
  title: string;
  due_date: string | null;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'completed';
}

export interface GeofenceEvent {
  id: string;
  user_id: string;
  customer_id: string;
  location_id: string | null;
  event_type: 'enter' | 'exit' | 'dwell';
  latitude: number | null;
  longitude: number | null;
  accuracy_meters: number | null;
  notification_sent: boolean;
  notification_clicked: boolean;
  triggered_at: string;
}

export interface Geofence {
  id: string;
  customer_id: string;
  customer_name: string;
  latitude: number;
  longitude: number;
  radius: number;
  trigger_on_enter: boolean;
  trigger_on_exit: boolean;
  is_active: boolean;
}

export interface CustomerBrief {
  customer_id: string;
  customer_name: string;
  health_score: number;
  arr: number;
  stage: string;
  open_tasks: number;
  pending_action_items: ActionItem[];
  stakeholders: Stakeholder[];
  recent_activities: Activity[];
  last_contact_date: string | null;
}

export interface ActionItem {
  id: string;
  title: string;
  due_date: string | null;
  priority: string;
}

export interface Stakeholder {
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
}

export interface Activity {
  type: string;
  description: string;
  date: string;
}

export interface NearbyLocation {
  location_id: string;
  customer_id: string;
  customer_name: string;
  label: string;
  distance_meters: number;
  geofence_radius: number;
}

export interface VisitPattern {
  user_id: string;
  customer_id: string;
  avg_visit_duration_minutes: number | null;
  typical_visit_days: string[];
  typical_visit_time: string | null;
  visit_frequency: string | null;
  last_visit_date: string | null;
  total_visits: number;
  suggested_next_visit: string | null;
}

// Input types
export interface CreateLocationInput {
  customer_id: string;
  label?: string;
  address?: string;
  latitude: number;
  longitude: number;
  geofence_radius?: number;
  is_primary?: boolean;
  geofence_enabled?: boolean;
}

export interface UpdateLocationInput {
  label?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  geofence_radius?: number;
  is_primary?: boolean;
  geofence_enabled?: boolean;
}

export interface UpdatePreferencesInput {
  location_tracking_enabled?: boolean;
  arrival_notifications?: boolean;
  departure_notifications?: boolean;
  geofence_radius_default?: number;
  excluded_locations?: ExcludedLocation[];
  battery_optimization?: 'low' | 'balanced' | 'high';
  precise_location?: boolean;
}

export interface StartVisitInput {
  user_id: string;
  customer_id: string;
  location_id?: string;
  is_planned?: boolean;
  calendar_event_id?: string;
}

export interface EndVisitInput {
  notes?: string;
  follow_up_tasks?: Omit<FollowUpTask, 'id' | 'status'>[];
  voice_note_url?: string;
  sentiment?: 'positive' | 'neutral' | 'negative' | 'mixed';
}

export interface LogGeofenceEventInput {
  user_id: string;
  customer_id: string;
  location_id?: string;
  event_type: 'enter' | 'exit' | 'dwell';
  latitude?: number;
  longitude?: number;
  accuracy_meters?: number;
}

// ============================================
// Service Class
// ============================================

export class LocationRemindersService {
  private supabase: SupabaseClient | null = null;
  private locationCache: Map<string, CustomerLocation[]> = new Map();
  private preferencesCache: Map<string, LocationPreferences> = new Map();

  constructor() {
    if (config.supabaseUrl && config.supabaseServiceKey) {
      this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
    }
  }

  // ============================================
  // Customer Location Management
  // ============================================

  async createLocation(input: CreateLocationInput): Promise<CustomerLocation> {
    const location: CustomerLocation = {
      id: uuidv4(),
      customer_id: input.customer_id,
      label: input.label || null,
      address: input.address || null,
      latitude: input.latitude,
      longitude: input.longitude,
      geofence_radius: input.geofence_radius || 500,
      is_primary: input.is_primary || false,
      geofence_enabled: input.geofence_enabled !== false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (this.supabase) {
      const { data, error } = await this.supabase
        .from('customer_locations')
        .insert(location)
        .select()
        .single();

      if (error) {
        console.error('Error creating location:', error);
        throw new Error(`Failed to create location: ${error.message}`);
      }

      // Invalidate cache
      this.locationCache.delete(input.customer_id);

      return data;
    }

    return location;
  }

  async getLocation(id: string): Promise<CustomerLocation | null> {
    if (this.supabase) {
      const { data, error } = await this.supabase
        .from('customer_locations')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw new Error(`Failed to get location: ${error.message}`);
      }

      return data;
    }

    return null;
  }

  async getCustomerLocations(customerId: string): Promise<CustomerLocation[]> {
    // Check cache
    const cached = this.locationCache.get(customerId);
    if (cached) return cached;

    if (this.supabase) {
      const { data, error } = await this.supabase
        .from('customer_locations')
        .select('*')
        .eq('customer_id', customerId)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) {
        throw new Error(`Failed to get customer locations: ${error.message}`);
      }

      // Cache the result
      this.locationCache.set(customerId, data || []);

      return data || [];
    }

    return [];
  }

  async updateLocation(id: string, input: UpdateLocationInput): Promise<CustomerLocation> {
    if (this.supabase) {
      const { data, error } = await this.supabase
        .from('customer_locations')
        .update({
          ...input,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update location: ${error.message}`);
      }

      // Invalidate cache for this customer
      if (data) {
        this.locationCache.delete(data.customer_id);
      }

      return data;
    }

    throw new Error('Database not configured');
  }

  async deleteLocation(id: string): Promise<void> {
    if (this.supabase) {
      // Get customer_id first for cache invalidation
      const location = await this.getLocation(id);

      const { error } = await this.supabase
        .from('customer_locations')
        .delete()
        .eq('id', id);

      if (error) {
        throw new Error(`Failed to delete location: ${error.message}`);
      }

      if (location) {
        this.locationCache.delete(location.customer_id);
      }
    }
  }

  // ============================================
  // Geofence Management
  // ============================================

  async getActiveGeofences(userId: string): Promise<Geofence[]> {
    if (!this.supabase) return [];

    // Get user preferences to check if location tracking is enabled
    const prefs = await this.getPreferences(userId);
    if (!prefs?.location_tracking_enabled) {
      return [];
    }

    // Get all customer locations with geofencing enabled
    // In production, filter by CSM's assigned customers
    const { data, error } = await this.supabase
      .from('customer_locations')
      .select(`
        id,
        customer_id,
        latitude,
        longitude,
        geofence_radius,
        geofence_enabled,
        customers!inner(name)
      `)
      .eq('geofence_enabled', true);

    if (error) {
      console.error('Error fetching geofences:', error);
      return [];
    }

    return (data || []).map(loc => ({
      id: loc.id,
      customer_id: loc.customer_id,
      customer_name: (loc.customers as any)?.name || 'Unknown',
      latitude: loc.latitude,
      longitude: loc.longitude,
      radius: loc.geofence_radius,
      trigger_on_enter: prefs.arrival_notifications,
      trigger_on_exit: prefs.departure_notifications,
      is_active: true
    }));
  }

  async findNearbyLocations(
    latitude: number,
    longitude: number,
    radiusMeters: number = 1000
  ): Promise<NearbyLocation[]> {
    if (!this.supabase) return [];

    // Use the database function for efficient distance calculation
    const { data, error } = await this.supabase
      .rpc('find_nearby_locations', {
        p_latitude: latitude,
        p_longitude: longitude,
        p_radius_meters: radiusMeters
      });

    if (error) {
      console.error('Error finding nearby locations:', error);
      return [];
    }

    return data || [];
  }

  // ============================================
  // User Preferences Management
  // ============================================

  async getPreferences(userId: string): Promise<LocationPreferences | null> {
    // Check cache
    const cached = this.preferencesCache.get(userId);
    if (cached) return cached;

    if (this.supabase) {
      const { data, error } = await this.supabase
        .from('csm_location_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No preferences exist yet, return defaults
          return {
            user_id: userId,
            location_tracking_enabled: false,
            arrival_notifications: true,
            departure_notifications: true,
            geofence_radius_default: 500,
            excluded_locations: [],
            battery_optimization: 'balanced',
            precise_location: false,
            updated_at: new Date().toISOString()
          };
        }
        throw new Error(`Failed to get preferences: ${error.message}`);
      }

      this.preferencesCache.set(userId, data);
      return data;
    }

    return null;
  }

  async updatePreferences(userId: string, input: UpdatePreferencesInput): Promise<LocationPreferences> {
    if (this.supabase) {
      const { data, error } = await this.supabase
        .from('csm_location_preferences')
        .upsert({
          user_id: userId,
          ...input,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update preferences: ${error.message}`);
      }

      // Update cache
      this.preferencesCache.set(userId, data);

      return data;
    }

    throw new Error('Database not configured');
  }

  // ============================================
  // Visit Log Management
  // ============================================

  async startVisit(input: StartVisitInput): Promise<VisitLog> {
    const visit: Partial<VisitLog> = {
      id: uuidv4(),
      user_id: input.user_id,
      customer_id: input.customer_id,
      location_id: input.location_id || null,
      arrival_time: new Date().toISOString(),
      departure_time: null,
      notes: null,
      follow_up_tasks: [],
      voice_note_url: null,
      is_planned: input.is_planned || false,
      calendar_event_id: input.calendar_event_id || null,
      sentiment: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (this.supabase) {
      const { data, error } = await this.supabase
        .from('visit_logs')
        .insert(visit)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to start visit: ${error.message}`);
      }

      return data;
    }

    return visit as VisitLog;
  }

  async endVisit(visitId: string, input: EndVisitInput): Promise<VisitLog> {
    const followUpTasks: FollowUpTask[] = (input.follow_up_tasks || []).map(task => ({
      id: uuidv4(),
      title: task.title,
      due_date: task.due_date || null,
      priority: task.priority || 'medium',
      status: 'pending'
    }));

    if (this.supabase) {
      const { data, error } = await this.supabase
        .from('visit_logs')
        .update({
          departure_time: new Date().toISOString(),
          notes: input.notes || null,
          follow_up_tasks: followUpTasks,
          voice_note_url: input.voice_note_url || null,
          sentiment: input.sentiment || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', visitId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to end visit: ${error.message}`);
      }

      return data;
    }

    throw new Error('Database not configured');
  }

  async getActiveVisit(userId: string, customerId?: string): Promise<VisitLog | null> {
    if (!this.supabase) return null;

    let query = this.supabase
      .from('visit_logs')
      .select('*')
      .eq('user_id', userId)
      .is('departure_time', null)
      .order('arrival_time', { ascending: false })
      .limit(1);

    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    const { data, error } = await query.single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error('Error getting active visit:', error);
      return null;
    }

    return data;
  }

  async getVisitLogs(
    userId: string,
    options: {
      customerId?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ visits: VisitLog[]; total: number }> {
    if (!this.supabase) {
      return { visits: [], total: 0 };
    }

    let query = this.supabase
      .from('visit_logs')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('arrival_time', { ascending: false });

    if (options.customerId) {
      query = query.eq('customer_id', options.customerId);
    }

    if (options.startDate) {
      query = query.gte('arrival_time', options.startDate);
    }

    if (options.endDate) {
      query = query.lte('arrival_time', options.endDate);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
    }

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to get visit logs: ${error.message}`);
    }

    return {
      visits: data || [],
      total: count || 0
    };
  }

  async getVisitLog(visitId: string): Promise<VisitLog | null> {
    if (!this.supabase) return null;

    const { data, error } = await this.supabase
      .from('visit_logs')
      .select('*')
      .eq('id', visitId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to get visit log: ${error.message}`);
    }

    return data;
  }

  async updateVisitNotes(visitId: string, notes: string): Promise<VisitLog> {
    if (!this.supabase) {
      throw new Error('Database not configured');
    }

    const { data, error } = await this.supabase
      .from('visit_logs')
      .update({
        notes,
        updated_at: new Date().toISOString()
      })
      .eq('id', visitId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update visit notes: ${error.message}`);
    }

    return data;
  }

  // ============================================
  // Geofence Events
  // ============================================

  async logGeofenceEvent(input: LogGeofenceEventInput): Promise<GeofenceEvent> {
    const event: Partial<GeofenceEvent> = {
      id: uuidv4(),
      user_id: input.user_id,
      customer_id: input.customer_id,
      location_id: input.location_id || null,
      event_type: input.event_type,
      latitude: input.latitude || null,
      longitude: input.longitude || null,
      accuracy_meters: input.accuracy_meters || null,
      notification_sent: false,
      notification_clicked: false,
      triggered_at: new Date().toISOString()
    };

    if (this.supabase) {
      const { data, error } = await this.supabase
        .from('geofence_events')
        .insert(event)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to log geofence event: ${error.message}`);
      }

      return data;
    }

    return event as GeofenceEvent;
  }

  async markNotificationSent(eventId: string): Promise<void> {
    if (this.supabase) {
      await this.supabase
        .from('geofence_events')
        .update({ notification_sent: true })
        .eq('id', eventId);
    }
  }

  async markNotificationClicked(eventId: string): Promise<void> {
    if (this.supabase) {
      await this.supabase
        .from('geofence_events')
        .update({ notification_clicked: true })
        .eq('id', eventId);
    }
  }

  // ============================================
  // Customer Brief for Arrival Notifications
  // ============================================

  async getCustomerBrief(customerId: string): Promise<CustomerBrief | null> {
    if (!this.supabase) return null;

    // Get customer basic info
    const { data: customer, error: customerError } = await this.supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();

    if (customerError || !customer) {
      return null;
    }

    // Get open tasks count
    const { count: openTasks } = await this.supabase
      .from('plan_tasks')
      .select('*', { count: 'exact', head: true })
      .eq('customer_id', customerId)
      .neq('status', 'completed');

    // Get pending action items
    const { data: actionItems } = await this.supabase
      .from('plan_tasks')
      .select('id, title, due_date, priority')
      .eq('customer_id', customerId)
      .neq('status', 'completed')
      .order('due_date', { ascending: true })
      .limit(5);

    // Get recent activities
    const { data: activities } = await this.supabase
      .from('agent_activity_log')
      .select('action_type, result_data, started_at')
      .eq('customer_id', customerId)
      .order('started_at', { ascending: false })
      .limit(5);

    return {
      customer_id: customerId,
      customer_name: customer.name,
      health_score: customer.health_score || 0,
      arr: customer.arr || 0,
      stage: customer.stage || 'active',
      open_tasks: openTasks || 0,
      pending_action_items: (actionItems || []).map(item => ({
        id: item.id,
        title: item.title,
        due_date: item.due_date,
        priority: item.priority || 'medium'
      })),
      stakeholders: [], // Would need stakeholders table
      recent_activities: (activities || []).map(a => ({
        type: a.action_type,
        description: a.result_data?.summary || a.action_type,
        date: a.started_at
      })),
      last_contact_date: customer.last_contact_date
    };
  }

  // ============================================
  // Visit Patterns & Analytics
  // ============================================

  async getVisitPatterns(userId: string, customerId?: string): Promise<VisitPattern[]> {
    if (!this.supabase) return [];

    let query = this.supabase
      .from('visit_patterns')
      .select('*')
      .eq('user_id', userId);

    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error getting visit patterns:', error);
      return [];
    }

    return data || [];
  }

  async getCsmVisitSummary(userId: string): Promise<{
    total_visits_30d: number;
    unique_customers_visited: number;
    avg_duration_minutes: number;
    visits_with_notes: number;
    visits_with_tasks: number;
  } | null> {
    if (!this.supabase) return null;

    const { data, error } = await this.supabase
      .from('v_csm_visit_summary')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return {
          total_visits_30d: 0,
          unique_customers_visited: 0,
          avg_duration_minutes: 0,
          visits_with_notes: 0,
          visits_with_tasks: 0
        };
      }
      console.error('Error getting CSM visit summary:', error);
      return null;
    }

    return data;
  }

  // ============================================
  // Privacy & Data Management
  // ============================================

  async clearLocationHistory(userId: string): Promise<void> {
    if (this.supabase) {
      // Delete geofence events
      await this.supabase
        .from('geofence_events')
        .delete()
        .eq('user_id', userId);

      // Optionally anonymize visit logs (keep for customer history but remove user tracking)
      // For now, we keep visit logs as they have business value
    }
  }

  async disableLocationTracking(userId: string): Promise<void> {
    await this.updatePreferences(userId, {
      location_tracking_enabled: false
    });

    // Clear any cached data
    this.preferencesCache.delete(userId);
  }

  // ============================================
  // Cache Management
  // ============================================

  clearCache(): void {
    this.locationCache.clear();
    this.preferencesCache.clear();
  }
}

// Export singleton instance
export const locationRemindersService = new LocationRemindersService();
