/**
 * PRD-268: Location-Based Reminders Component
 *
 * A comprehensive mobile component for managing location-based reminders
 * including geofence configuration, visit logging, and privacy controls.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  MapPin,
  Navigation,
  Bell,
  BellOff,
  Settings,
  Clock,
  Building2,
  Plus,
  Edit2,
  Trash2,
  ChevronRight,
  Battery,
  Shield,
  Eye,
  EyeOff,
  Mic,
  FileText,
  CheckCircle,
  AlertCircle,
  Users,
  Calendar,
  Activity,
  X,
  Save,
  RefreshCw
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface CustomerLocation {
  id: string;
  customer_id: string;
  label: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
  geofence_radius: number;
  is_primary: boolean;
  geofence_enabled: boolean;
}

interface LocationPreferences {
  user_id: string;
  location_tracking_enabled: boolean;
  arrival_notifications: boolean;
  departure_notifications: boolean;
  geofence_radius_default: number;
  excluded_locations: ExcludedLocation[];
  battery_optimization: 'low' | 'balanced' | 'high';
  precise_location: boolean;
}

interface ExcludedLocation {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  radius: number;
}

interface VisitLog {
  id: string;
  user_id: string;
  customer_id: string;
  customer_name?: string;
  location_id: string | null;
  arrival_time: string | null;
  departure_time: string | null;
  duration_minutes: number | null;
  notes: string | null;
  follow_up_tasks: FollowUpTask[];
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed' | null;
}

interface FollowUpTask {
  id: string;
  title: string;
  due_date: string | null;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'completed';
}

interface CustomerBrief {
  customer_id: string;
  customer_name: string;
  health_score: number;
  arr: number;
  stage: string;
  open_tasks: number;
  pending_action_items: ActionItem[];
  recent_activities: RecentActivity[];
  last_contact_date: string | null;
}

interface ActionItem {
  id: string;
  title: string;
  due_date: string | null;
  priority: string;
}

interface RecentActivity {
  type: string;
  description: string;
  date: string;
}

interface VisitSummary {
  total_visits_30d: number;
  unique_customers_visited: number;
  avg_duration_minutes: number;
  visits_with_notes: number;
  visits_with_tasks: number;
}

// ============================================
// Props
// ============================================

interface LocationBasedRemindersProps {
  userId: string;
  onNavigateToCustomer?: (customerId: string) => void;
}

// ============================================
// Main Component
// ============================================

export const LocationBasedReminders: React.FC<LocationBasedRemindersProps> = ({
  userId,
  onNavigateToCustomer
}) => {
  // State
  const [activeTab, setActiveTab] = useState<'overview' | 'locations' | 'visits' | 'settings'>('overview');
  const [preferences, setPreferences] = useState<LocationPreferences | null>(null);
  const [activeVisit, setActiveVisit] = useState<VisitLog | null>(null);
  const [customerBrief, setCustomerBrief] = useState<CustomerBrief | null>(null);
  const [visitHistory, setVisitHistory] = useState<VisitLog[]>([]);
  const [visitSummary, setVisitSummary] = useState<VisitSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Visit notes modal state
  const [showVisitNotesModal, setShowVisitNotesModal] = useState(false);
  const [visitNotes, setVisitNotes] = useState('');
  const [visitTasks, setVisitTasks] = useState<Omit<FollowUpTask, 'id' | 'status'>[]>([]);
  const [visitSentiment, setVisitSentiment] = useState<'positive' | 'neutral' | 'negative' | 'mixed'>('neutral');

  // ============================================
  // API Calls
  // ============================================

  const fetchPreferences = useCallback(async () => {
    try {
      const response = await fetch(`/api/locations/preferences/${userId}`);
      const result = await response.json();
      if (result.success) {
        setPreferences(result.data);
      }
    } catch (err) {
      console.error('Error fetching preferences:', err);
    }
  }, [userId]);

  const fetchActiveVisit = useCallback(async () => {
    try {
      const response = await fetch(`/api/locations/visits/active/${userId}`);
      const result = await response.json();
      if (result.success && result.data) {
        setActiveVisit(result.data);
        // Fetch customer brief for active visit
        const briefResponse = await fetch(`/api/locations/brief/${result.data.customer_id}`);
        const briefResult = await briefResponse.json();
        if (briefResult.success) {
          setCustomerBrief(briefResult.data);
        }
      } else {
        setActiveVisit(null);
        setCustomerBrief(null);
      }
    } catch (err) {
      console.error('Error fetching active visit:', err);
    }
  }, [userId]);

  const fetchVisitHistory = useCallback(async () => {
    try {
      const response = await fetch(`/api/locations/visits/${userId}?limit=20`);
      const result = await response.json();
      if (result.success) {
        setVisitHistory(result.data);
      }
    } catch (err) {
      console.error('Error fetching visit history:', err);
    }
  }, [userId]);

  const fetchVisitSummary = useCallback(async () => {
    try {
      const response = await fetch(`/api/locations/summary/${userId}`);
      const result = await response.json();
      if (result.success) {
        setVisitSummary(result.data);
      }
    } catch (err) {
      console.error('Error fetching visit summary:', err);
    }
  }, [userId]);

  const updatePreferences = async (updates: Partial<LocationPreferences>) => {
    try {
      const response = await fetch(`/api/locations/preferences/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      const result = await response.json();
      if (result.success) {
        setPreferences(result.data);
      }
    } catch (err) {
      console.error('Error updating preferences:', err);
      setError('Failed to update preferences');
    }
  };

  const endVisit = async () => {
    if (!activeVisit) return;

    try {
      const response = await fetch(`/api/locations/visits/${activeVisit.id}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: visitNotes,
          follow_up_tasks: visitTasks,
          sentiment: visitSentiment
        })
      });

      const result = await response.json();
      if (result.success) {
        setShowVisitNotesModal(false);
        setActiveVisit(null);
        setCustomerBrief(null);
        setVisitNotes('');
        setVisitTasks([]);
        setVisitSentiment('neutral');
        fetchVisitHistory();
        fetchVisitSummary();
      }
    } catch (err) {
      console.error('Error ending visit:', err);
      setError('Failed to end visit');
    }
  };

  const clearLocationHistory = async () => {
    try {
      await fetch(`/api/locations/history/${userId}`, { method: 'DELETE' });
      // Refresh data
      fetchVisitHistory();
    } catch (err) {
      console.error('Error clearing location history:', err);
      setError('Failed to clear location history');
    }
  };

  // ============================================
  // Effects
  // ============================================

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchPreferences(),
        fetchActiveVisit(),
        fetchVisitHistory(),
        fetchVisitSummary()
      ]);
      setLoading(false);
    };
    loadData();
  }, [fetchPreferences, fetchActiveVisit, fetchVisitHistory, fetchVisitSummary]);

  // ============================================
  // Render Functions
  // ============================================

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Tracking Status */}
      <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {preferences?.location_tracking_enabled ? (
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <Navigation className="w-5 h-5 text-green-400" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                <Navigation className="w-5 h-5 text-gray-500" />
              </div>
            )}
            <div>
              <h3 className="text-white font-medium">Location Tracking</h3>
              <p className="text-sm text-gray-400">
                {preferences?.location_tracking_enabled ? 'Active' : 'Disabled'}
              </p>
            </div>
          </div>
          <button
            onClick={() => updatePreferences({
              location_tracking_enabled: !preferences?.location_tracking_enabled
            })}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              preferences?.location_tracking_enabled
                ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                : 'bg-cscx-accent text-white hover:bg-cscx-accent/80'
            }`}
          >
            {preferences?.location_tracking_enabled ? 'Disable' : 'Enable'}
          </button>
        </div>
      </div>

      {/* Active Visit Card */}
      {activeVisit && customerBrief && (
        <div className="bg-cscx-accent/10 border border-cscx-accent/30 rounded-lg p-4">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 text-cscx-accent text-sm font-medium mb-1">
                <MapPin className="w-4 h-4" />
                Currently Visiting
              </div>
              <h3 className="text-lg text-white font-semibold">{customerBrief.customer_name}</h3>
              <p className="text-sm text-gray-400">
                {activeVisit.arrival_time && formatDuration(activeVisit.arrival_time)}
              </p>
            </div>
            <button
              onClick={() => setShowVisitNotesModal(true)}
              className="px-4 py-2 bg-cscx-accent text-white rounded-lg text-sm font-medium hover:bg-cscx-accent/80 transition-colors"
            >
              End Visit
            </button>
          </div>

          {/* Customer Brief */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-gray-900/50 rounded-lg p-3">
              <div className="text-sm text-gray-400 mb-1">Health Score</div>
              <div className={`text-xl font-bold ${getHealthColor(customerBrief.health_score)}`}>
                {customerBrief.health_score}
              </div>
            </div>
            <div className="bg-gray-900/50 rounded-lg p-3">
              <div className="text-sm text-gray-400 mb-1">Open Tasks</div>
              <div className="text-xl font-bold text-white">{customerBrief.open_tasks}</div>
            </div>
            <div className="bg-gray-900/50 rounded-lg p-3">
              <div className="text-sm text-gray-400 mb-1">ARR</div>
              <div className="text-xl font-bold text-white">
                ${(customerBrief.arr / 1000).toFixed(0)}k
              </div>
            </div>
          </div>

          {/* Action Items */}
          {customerBrief.pending_action_items.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-300 mb-2">Pending Actions</h4>
              <div className="space-y-2">
                {customerBrief.pending_action_items.slice(0, 3).map(item => (
                  <div key={item.id} className="flex items-center gap-2 text-sm text-gray-400">
                    <CheckCircle className="w-4 h-4 text-gray-600" />
                    {item.title}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => onNavigateToCustomer?.(customerBrief.customer_id)}
              className="flex-1 px-3 py-2 bg-gray-800 text-white rounded-lg text-sm hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
            >
              <Building2 className="w-4 h-4" />
              View Customer
            </button>
            <button className="flex-1 px-3 py-2 bg-gray-800 text-white rounded-lg text-sm hover:bg-gray-700 transition-colors flex items-center justify-center gap-2">
              <Users className="w-4 h-4" />
              Contacts
            </button>
          </div>
        </div>
      )}

      {/* Visit Summary */}
      {visitSummary && (
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <h3 className="text-white font-medium mb-4">Last 30 Days</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-2xl font-bold text-white">{visitSummary.total_visits_30d}</div>
              <div className="text-sm text-gray-400">Total Visits</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{visitSummary.unique_customers_visited}</div>
              <div className="text-sm text-gray-400">Customers</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{visitSummary.avg_duration_minutes || 0}</div>
              <div className="text-sm text-gray-400">Avg Minutes</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white">
                {visitSummary.total_visits_30d > 0
                  ? Math.round((visitSummary.visits_with_notes / visitSummary.total_visits_30d) * 100)
                  : 0}%
              </div>
              <div className="text-sm text-gray-400">Notes Rate</div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Visits */}
      <div className="bg-gray-900 rounded-lg border border-gray-800">
        <div className="p-4 border-b border-gray-800">
          <h3 className="text-white font-medium">Recent Visits</h3>
        </div>
        <div className="divide-y divide-gray-800">
          {visitHistory.slice(0, 5).map(visit => (
            <div
              key={visit.id}
              className="p-4 hover:bg-gray-800/50 transition-colors cursor-pointer"
              onClick={() => onNavigateToCustomer?.(visit.customer_id)}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-white font-medium">
                    {visit.customer_name || 'Customer'}
                  </div>
                  <div className="text-sm text-gray-400">
                    {visit.arrival_time && formatDate(visit.arrival_time)}
                    {visit.duration_minutes && ` - ${visit.duration_minutes} min`}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {visit.notes && <FileText className="w-4 h-4 text-gray-500" />}
                  {visit.follow_up_tasks.length > 0 && (
                    <span className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded">
                      {visit.follow_up_tasks.length} tasks
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                </div>
              </div>
            </div>
          ))}
          {visitHistory.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              No visit history yet
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-6">
      {/* Notification Settings */}
      <div className="bg-gray-900 rounded-lg border border-gray-800">
        <div className="p-4 border-b border-gray-800">
          <h3 className="text-white font-medium">Notifications</h3>
        </div>
        <div className="divide-y divide-gray-800">
          <SettingToggle
            icon={<Bell className="w-5 h-5" />}
            label="Arrival Notifications"
            description="Show customer brief when arriving at a location"
            enabled={preferences?.arrival_notifications ?? true}
            onChange={(enabled) => updatePreferences({ arrival_notifications: enabled })}
          />
          <SettingToggle
            icon={<BellOff className="w-5 h-5" />}
            label="Departure Prompts"
            description="Prompt to log notes when leaving a customer site"
            enabled={preferences?.departure_notifications ?? true}
            onChange={(enabled) => updatePreferences({ departure_notifications: enabled })}
          />
        </div>
      </div>

      {/* Location Settings */}
      <div className="bg-gray-900 rounded-lg border border-gray-800">
        <div className="p-4 border-b border-gray-800">
          <h3 className="text-white font-medium">Location Settings</h3>
        </div>
        <div className="divide-y divide-gray-800">
          <SettingToggle
            icon={<Navigation className="w-5 h-5" />}
            label="Precise Location"
            description="Use GPS for accurate location (uses more battery)"
            enabled={preferences?.precise_location ?? false}
            onChange={(enabled) => updatePreferences({ precise_location: enabled })}
          />
          <div className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <MapPin className="w-5 h-5 text-gray-400" />
              <div>
                <div className="text-white">Default Geofence Radius</div>
                <div className="text-sm text-gray-400">{preferences?.geofence_radius_default || 500}m</div>
              </div>
            </div>
            <input
              type="range"
              min="100"
              max="2000"
              step="100"
              value={preferences?.geofence_radius_default || 500}
              onChange={(e) => updatePreferences({ geofence_radius_default: parseInt(e.target.value) })}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>100m</span>
              <span>2000m</span>
            </div>
          </div>
        </div>
      </div>

      {/* Battery Optimization */}
      <div className="bg-gray-900 rounded-lg border border-gray-800">
        <div className="p-4 border-b border-gray-800">
          <h3 className="text-white font-medium">Battery Optimization</h3>
        </div>
        <div className="p-4 space-y-3">
          {(['low', 'balanced', 'high'] as const).map((level) => (
            <button
              key={level}
              onClick={() => updatePreferences({ battery_optimization: level })}
              className={`w-full p-4 rounded-lg border text-left transition-colors ${
                preferences?.battery_optimization === level
                  ? 'border-cscx-accent bg-cscx-accent/10'
                  : 'border-gray-700 hover:border-gray-600'
              }`}
            >
              <div className="flex items-center gap-3">
                <Battery className={`w-5 h-5 ${
                  level === 'low' ? 'text-green-400' :
                  level === 'balanced' ? 'text-yellow-400' : 'text-red-400'
                }`} />
                <div>
                  <div className="text-white font-medium capitalize">{level}</div>
                  <div className="text-sm text-gray-400">
                    {level === 'low' && 'Minimal battery usage, less frequent updates'}
                    {level === 'balanced' && 'Balanced battery and accuracy'}
                    {level === 'high' && 'Maximum accuracy, higher battery usage'}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Privacy Controls */}
      <div className="bg-gray-900 rounded-lg border border-gray-800">
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-gray-400" />
            <h3 className="text-white font-medium">Privacy</h3>
          </div>
        </div>
        <div className="p-4 space-y-4">
          <p className="text-sm text-gray-400">
            Your location is only used to trigger reminders at customer sites.
            Location data is processed locally and not stored on our servers.
          </p>
          <button
            onClick={clearLocationHistory}
            className="w-full px-4 py-3 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Clear Location History
          </button>
        </div>
      </div>
    </div>
  );

  const renderVisits = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-medium">Visit History</h3>
        <button
          onClick={fetchVisitHistory}
          className="p-2 text-gray-400 hover:text-white transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
      <div className="space-y-3">
        {visitHistory.map(visit => (
          <div
            key={visit.id}
            className="bg-gray-900 rounded-lg p-4 border border-gray-800"
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="text-white font-medium">{visit.customer_name || 'Customer'}</div>
                <div className="text-sm text-gray-400">
                  {visit.arrival_time && formatDate(visit.arrival_time)}
                </div>
              </div>
              {visit.duration_minutes && (
                <div className="flex items-center gap-1 text-sm text-gray-400">
                  <Clock className="w-4 h-4" />
                  {visit.duration_minutes} min
                </div>
              )}
            </div>

            {visit.notes && (
              <div className="text-sm text-gray-300 mb-2 line-clamp-2">
                {visit.notes}
              </div>
            )}

            <div className="flex items-center gap-4 text-sm">
              {visit.sentiment && (
                <span className={`flex items-center gap-1 ${getSentimentColor(visit.sentiment)}`}>
                  <Activity className="w-3 h-3" />
                  {visit.sentiment}
                </span>
              )}
              {visit.follow_up_tasks.length > 0 && (
                <span className="text-gray-400">
                  {visit.follow_up_tasks.length} follow-up task{visit.follow_up_tasks.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        ))}
        {visitHistory.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <MapPin className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No visits recorded yet</p>
            <p className="text-sm mt-1">
              Visit history will appear here when you enable location tracking
            </p>
          </div>
        )}
      </div>
    </div>
  );

  // ============================================
  // Visit Notes Modal
  // ============================================

  const renderVisitNotesModal = () => (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center p-4">
      <div className="bg-gray-900 rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gray-900 p-4 border-b border-gray-800 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">End Visit</h3>
          <button
            onClick={() => setShowVisitNotesModal(false)}
            className="p-2 text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-6">
          {/* Visit Duration */}
          <div className="text-center py-4 bg-gray-800/50 rounded-lg">
            <div className="text-sm text-gray-400 mb-1">Visit Duration</div>
            <div className="text-2xl font-bold text-white">
              {activeVisit?.arrival_time && formatDuration(activeVisit.arrival_time)}
            </div>
          </div>

          {/* Sentiment */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              How did the visit go?
            </label>
            <div className="flex gap-2">
              {(['positive', 'neutral', 'negative', 'mixed'] as const).map(sentiment => (
                <button
                  key={sentiment}
                  onClick={() => setVisitSentiment(sentiment)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    visitSentiment === sentiment
                      ? 'bg-cscx-accent text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  {sentiment.charAt(0).toUpperCase() + sentiment.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Notes
            </label>
            <textarea
              value={visitNotes}
              onChange={(e) => setVisitNotes(e.target.value)}
              placeholder="How did the visit go? Key discussion points, decisions made..."
              className="w-full h-32 bg-gray-800 border border-gray-700 rounded-lg p-3 text-white placeholder-gray-500 focus:outline-none focus:border-cscx-accent"
            />
            <button className="mt-2 flex items-center gap-2 text-sm text-gray-400 hover:text-white">
              <Mic className="w-4 h-4" />
              Record voice note
            </button>
          </div>

          {/* Follow-up Tasks */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Follow-up Tasks
            </label>
            <div className="space-y-2 mb-2">
              {visitTasks.map((task, index) => (
                <div key={index} className="flex items-center gap-2 bg-gray-800 rounded-lg p-2">
                  <CheckCircle className="w-4 h-4 text-gray-500" />
                  <span className="flex-1 text-sm text-white">{task.title}</span>
                  <button
                    onClick={() => setVisitTasks(visitTasks.filter((_, i) => i !== index))}
                    className="p-1 text-gray-500 hover:text-red-400"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                const title = prompt('Task title:');
                if (title) {
                  setVisitTasks([...visitTasks, { title, due_date: null, priority: 'medium' }]);
                }
              }}
              className="flex items-center gap-2 text-sm text-cscx-accent hover:text-cscx-accent/80"
            >
              <Plus className="w-4 h-4" />
              Add task
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="sticky bottom-0 bg-gray-900 p-4 border-t border-gray-800 flex gap-3">
          <button
            onClick={() => setShowVisitNotesModal(false)}
            className="flex-1 px-4 py-3 bg-gray-800 text-gray-300 rounded-lg font-medium hover:bg-gray-700 transition-colors"
          >
            Skip
          </button>
          <button
            onClick={endVisit}
            className="flex-1 px-4 py-3 bg-cscx-accent text-white rounded-lg font-medium hover:bg-cscx-accent/80 transition-colors flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            Save & End
          </button>
        </div>
      </div>
    </div>
  );

  // ============================================
  // Loading & Error States
  // ============================================

  if (loading) {
    return (
      <div className="min-h-screen bg-cscx-black p-4 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-cscx-accent border-t-transparent" />
      </div>
    );
  }

  // ============================================
  // Main Render
  // ============================================

  return (
    <div className="min-h-screen bg-cscx-black">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-cscx-black border-b border-gray-800">
        <div className="p-4">
          <h1 className="text-xl font-bold text-white">Location Reminders</h1>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800">
          {(['overview', 'visits', 'settings'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'text-cscx-accent border-b-2 border-cscx-accent'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {error && (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3 text-red-400">
            <AlertCircle className="w-5 h-5" />
            {error}
            <button onClick={() => setError(null)} className="ml-auto">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'visits' && renderVisits()}
        {activeTab === 'settings' && renderSettings()}
      </div>

      {/* Visit Notes Modal */}
      {showVisitNotesModal && renderVisitNotesModal()}
    </div>
  );
};

// ============================================
// Sub-Components
// ============================================

interface SettingToggleProps {
  icon: React.ReactNode;
  label: string;
  description?: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

const SettingToggle: React.FC<SettingToggleProps> = ({
  icon,
  label,
  description,
  enabled,
  onChange
}) => (
  <div className="p-4 flex items-center justify-between">
    <div className="flex items-center gap-3">
      <div className="text-gray-400">{icon}</div>
      <div>
        <div className="text-white">{label}</div>
        {description && <div className="text-sm text-gray-400">{description}</div>}
      </div>
    </div>
    <button
      onClick={() => onChange(!enabled)}
      className={`relative w-12 h-6 rounded-full transition-colors ${
        enabled ? 'bg-cscx-accent' : 'bg-gray-700'
      }`}
    >
      <div
        className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
          enabled ? 'right-1' : 'left-1'
        }`}
      />
    </button>
  </div>
);

// ============================================
// Helper Functions
// ============================================

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function formatDuration(startTime: string): string {
  const start = new Date(startTime);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 60) {
    return `${diffMins} min`;
  }

  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  return `${hours}h ${mins}m`;
}

function getHealthColor(score: number): string {
  if (score >= 80) return 'text-green-400';
  if (score >= 60) return 'text-yellow-400';
  if (score >= 40) return 'text-orange-400';
  return 'text-red-400';
}

function getSentimentColor(sentiment: string): string {
  switch (sentiment) {
    case 'positive': return 'text-green-400';
    case 'negative': return 'text-red-400';
    case 'mixed': return 'text-yellow-400';
    default: return 'text-gray-400';
  }
}

export default LocationBasedReminders;
