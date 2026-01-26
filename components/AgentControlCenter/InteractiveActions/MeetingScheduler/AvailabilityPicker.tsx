import { useState, useEffect } from 'react';
import type { TimeSlot } from '../types';

const API_URL = import.meta.env.VITE_API_URL || '';

interface AvailabilityPickerProps {
  selectedSlot: TimeSlot | null;
  onSlotSelect: (slot: TimeSlot) => void;
  duration: number; // minutes
}

export function AvailabilityPicker({
  selectedSlot,
  onSlotSelect,
  duration,
}: AvailabilityPickerProps) {
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewDate, setViewDate] = useState(new Date());
  const [error, setError] = useState<string | null>(null);

  // Fetch available slots
  useEffect(() => {
    const fetchSlots = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const startDate = viewDate.toISOString();
        const endDate = new Date(viewDate.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
        const userId = localStorage.getItem('userId') || '';

        const response = await fetch(
          `${API_URL}/api/workspace/calendar/availability?startDate=${startDate}&endDate=${endDate}&duration=${duration}`,
          {
            headers: userId ? { 'x-user-id': userId } : {}
          }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch availability');
        }

        const data = await response.json();
        setSlots(
          data.slots.map((s: { start: string; end: string; duration: number; available: boolean }) => ({
            ...s,
            start: new Date(s.start),
            end: new Date(s.end),
          }))
        );
      } catch (err) {
        console.error('Availability fetch error:', err);
        setError('Could not load availability. Showing suggested times.');
        // Generate fallback slots
        setSlots(generateFallbackSlots(viewDate, duration));
      } finally {
        setIsLoading(false);
      }
    };

    fetchSlots();
  }, [viewDate, duration]);

  // Group slots by day
  const slotsByDay = slots.reduce<Record<string, TimeSlot[]>>((acc, slot) => {
    const dateKey = slot.start.toDateString();
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(slot);
    return acc;
  }, {});

  const handlePrevWeek = () => {
    setViewDate(new Date(viewDate.getTime() - 7 * 24 * 60 * 60 * 1000));
  };

  const handleNextWeek = () => {
    setViewDate(new Date(viewDate.getTime() + 7 * 24 * 60 * 60 * 1000));
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const formatDayHeader = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';

    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  if (isLoading) {
    return (
      <div className="availability-picker">
        <div className="availability-loading">
          <div className="loading-spinner" />
          <span>Finding available times...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="availability-picker">
      {/* Navigation */}
      <div className="availability-nav">
        <button className="nav-btn" onClick={handlePrevWeek}>
          ← Previous
        </button>
        <span className="nav-title">
          {viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </span>
        <button className="nav-btn" onClick={handleNextWeek}>
          Next →
        </button>
      </div>

      {error && <div className="availability-warning">{error}</div>}

      {/* Slots Grid */}
      <div className="availability-grid">
        {Object.entries(slotsByDay).length === 0 ? (
          <div className="no-slots">No available times in this period. Try another week.</div>
        ) : (
          Object.entries(slotsByDay).map(([dateStr, daySlots]) => (
            <div key={dateStr} className="day-column">
              <div className="day-header">{formatDayHeader(dateStr)}</div>
              <div className="day-slots">
                {daySlots.map((slot) => {
                  const isSelected =
                    selectedSlot &&
                    slot.start.getTime() === selectedSlot.start.getTime();
                  return (
                    <button
                      key={slot.start.toISOString()}
                      className={`time-slot ${isSelected ? 'selected' : ''}`}
                      onClick={() => onSlotSelect(slot)}
                    >
                      {formatTime(slot.start)}
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Selected Slot Display */}
      {selectedSlot && (
        <div className="selected-slot-info">
          <span className="check-icon">✓</span>
          <span>
            {selectedSlot.start.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}{' '}
            at {formatTime(selectedSlot.start)} - {formatTime(selectedSlot.end)}
          </span>
        </div>
      )}
    </div>
  );
}

// Fallback slot generation when API is unavailable
function generateFallbackSlots(startDate: Date, duration: number): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const current = new Date(startDate);
  current.setHours(9, 0, 0, 0);

  for (let day = 0; day < 5; day++) {
    const dayDate = new Date(current.getTime() + day * 24 * 60 * 60 * 1000);
    const dayOfWeek = dayDate.getDay();

    // Skip weekends
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;

    // Add slots for 9 AM, 11 AM, 2 PM, 4 PM
    [9, 11, 14, 16].forEach((hour) => {
      const start = new Date(dayDate);
      start.setHours(hour, 0, 0, 0);

      // Only add future slots
      if (start > new Date()) {
        slots.push({
          start,
          end: new Date(start.getTime() + duration * 60 * 1000),
          duration,
          available: true,
        });
      }
    });
  }

  return slots;
}
