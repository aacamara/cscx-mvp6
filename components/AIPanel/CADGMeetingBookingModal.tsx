/**
 * CADGMeetingBookingModal - Book calendar meetings after preparing meeting content
 * Pre-fills data from meeting prep, allows scheduling with Google Calendar
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

// ============================================
// Types
// ============================================

export interface MeetingBookingData {
  title: string;
  attendees: string[];
  agenda: string[];
  prepDocumentUrl?: string;
}

export interface BookedMeeting {
  eventId: string;
  eventUrl: string;
  meetLink?: string;
  startTime: string;
  endTime: string;
}

interface BusyBlock {
  start: string;
  end: string;
}

interface AvailableSlot {
  start: string;
  end: string;
  label: string;
}

interface CADGMeetingBookingModalProps {
  initialData: MeetingBookingData;
  onBook: (meeting: BookedMeeting) => Promise<void>;
  onCancel: () => void;
}

// ============================================
// Helpers
// ============================================

// Get next business day (skip weekends)
const getNextBusinessDay = (): string => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() + 1);
  }
  return date.toISOString().split('T')[0];
};

// Generate time options in 15-minute increments
const generateTimeOptions = (): { value: string; label: string }[] => {
  const options: { value: string; label: string }[] = [];
  for (let hour = 9; hour <= 18; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      if (hour === 18 && minute > 0) break; // Stop at 6:00 PM
      const h = hour.toString().padStart(2, '0');
      const m = minute.toString().padStart(2, '0');
      const value = `${h}:${m}`;
      const period = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
      const label = `${displayHour}:${m} ${period}`;
      options.push({ value, label });
    }
  }
  return options;
};

// Duration options
const DURATION_OPTIONS = [
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 45, label: '45 minutes' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '1.5 hours' },
  { value: 120, label: '2 hours' },
];

// Calculate end time from start time and duration
const calculateEndTime = (date: string, startTime: string, durationMinutes: number): string => {
  const [hours, minutes] = startTime.split(':').map(Number);
  const startDate = new Date(`${date}T${startTime}:00`);
  startDate.setMinutes(startDate.getMinutes() + durationMinutes);
  return startDate.toISOString();
};

// Format time for display
const formatTimeForDisplay = (isoString: string): string => {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

// ============================================
// Component
// ============================================

export const CADGMeetingBookingModal: React.FC<CADGMeetingBookingModalProps> = ({
  initialData,
  onBook,
  onCancel,
}) => {
  const { getAuthHeaders } = useAuth();
  const timeOptions = useMemo(() => generateTimeOptions(), []);

  // Form state
  const [title, setTitle] = useState(initialData.title);
  const [attendees, setAttendees] = useState(initialData.attendees.join(', '));
  const [date, setDate] = useState(getNextBusinessDay());
  const [startTime, setStartTime] = useState('10:00');
  const [duration, setDuration] = useState(60);
  const [addMeet, setAddMeet] = useState(true);
  const [description, setDescription] = useState('');

  // UI state
  const [isBooking, setIsBooking] = useState(false);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyBlocks, setBusyBlocks] = useState<BusyBlock[]>([]);
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [bookedMeeting, setBookedMeeting] = useState<BookedMeeting | null>(null);
  const [copied, setCopied] = useState(false);

  // Generate description from agenda
  useEffect(() => {
    const agendaList = initialData.agenda
      .filter(a => a.trim())
      .map(a => `• ${a}`)
      .join('\n');

    let desc = 'Agenda:\n' + (agendaList || '• To be discussed');

    if (initialData.prepDocumentUrl) {
      desc += `\n\nMeeting Prep Document:\n${initialData.prepDocumentUrl}`;
    }

    setDescription(desc);
  }, [initialData.agenda, initialData.prepDocumentUrl]);

  // Check availability for selected date
  const handleCheckAvailability = async () => {
    setIsCheckingAvailability(true);
    setError(null);
    setBusyBlocks([]);
    setAvailableSlots([]);

    try {
      const attendeeList = attendees.split(',').map(e => e.trim()).filter(Boolean);

      const response = await fetch(
        `${import.meta.env.VITE_API_URL || ''}/api/google/calendar/freebusy`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            timeMin: `${date}T09:00:00`,
            timeMax: `${date}T18:00:00`,
            attendees: attendeeList,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to check availability');
      }

      const data = await response.json();

      // Extract busy blocks
      const busy: BusyBlock[] = [];
      if (data.calendars) {
        Object.values(data.calendars).forEach((cal: any) => {
          if (cal.busy) {
            busy.push(...cal.busy);
          }
        });
      }
      setBusyBlocks(busy);

      // Find available slots (9 AM - 6 PM, duration-sized gaps)
      const slots: AvailableSlot[] = [];
      const dayStart = new Date(`${date}T09:00:00`);
      const dayEnd = new Date(`${date}T18:00:00`);

      let current = dayStart;
      while (current < dayEnd && slots.length < 3) {
        const slotEnd = new Date(current.getTime() + duration * 60000);
        if (slotEnd > dayEnd) break;

        const isSlotFree = !busy.some(b => {
          const busyStart = new Date(b.start);
          const busyEnd = new Date(b.end);
          return current < busyEnd && slotEnd > busyStart;
        });

        if (isSlotFree) {
          slots.push({
            start: current.toISOString(),
            end: slotEnd.toISOString(),
            label: `${formatTimeForDisplay(current.toISOString())} - ${formatTimeForDisplay(slotEnd.toISOString())}`,
          });
        }

        current = new Date(current.getTime() + 15 * 60000); // Move by 15 min
      }
      setAvailableSlots(slots);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check availability');
    } finally {
      setIsCheckingAvailability(false);
    }
  };

  // Apply suggested slot
  const handleApplySlot = (slot: AvailableSlot) => {
    const slotDate = new Date(slot.start);
    const hours = slotDate.getHours().toString().padStart(2, '0');
    const minutes = slotDate.getMinutes().toString().padStart(2, '0');
    setStartTime(`${hours}:${minutes}`);
    setAvailableSlots([]);
  };

  // Book the meeting
  const handleBook = async () => {
    setIsBooking(true);
    setError(null);

    try {
      const attendeeList = attendees.split(',').map(e => e.trim()).filter(Boolean);
      const startDateTime = `${date}T${startTime}:00`;
      const endDateTime = calculateEndTime(date, startTime, duration);

      const response = await fetch(
        `${import.meta.env.VITE_API_URL || ''}/api/google/calendar/meetings`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            title,
            attendees: attendeeList,
            startTime: startDateTime,
            endTime: endDateTime,
            description,
            addMeet,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to book meeting');
      }

      const data = await response.json();

      const meeting: BookedMeeting = {
        eventId: data.id || data.eventId,
        eventUrl: data.htmlLink || data.eventUrl,
        meetLink: data.hangoutLink || data.meetLink,
        startTime: startDateTime,
        endTime: endDateTime,
      };

      setBookedMeeting(meeting);
      setShowSuccess(true);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to book meeting');
    } finally {
      setIsBooking(false);
    }
  };

  // Handle done after success
  const handleDone = async () => {
    if (bookedMeeting) {
      await onBook(bookedMeeting);
    }
  };

  // Copy meeting link
  const handleCopyLink = () => {
    if (bookedMeeting?.meetLink) {
      navigator.clipboard.writeText(bookedMeeting.meetLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Check if time slot overlaps with busy blocks
  const isTimeSlotBusy = (time: string): boolean => {
    if (busyBlocks.length === 0) return false;
    const slotStart = new Date(`${date}T${time}:00`);
    const slotEnd = new Date(slotStart.getTime() + duration * 60000);

    return busyBlocks.some(b => {
      const busyStart = new Date(b.start);
      const busyEnd = new Date(b.end);
      return slotStart < busyEnd && slotEnd > busyStart;
    });
  };

  // Success view
  if (showSuccess && bookedMeeting) {
    return (
      <div className="bg-cscx-gray-800 border border-cscx-gray-700 rounded-xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600/20 to-transparent p-4 border-b border-cscx-gray-700">
          <div className="flex items-center gap-2">
            <span className="text-2xl">&#x2714;&#xFE0F;</span>
            <h3 className="text-white font-semibold">Meeting Booked!</h3>
          </div>
        </div>

        {/* Success content */}
        <div className="p-6 space-y-4">
          <div className="text-center">
            <p className="text-white text-lg font-medium">{title}</p>
            <p className="text-cscx-gray-400 text-sm mt-1">
              {new Date(bookedMeeting.startTime).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
            <p className="text-cscx-gray-300 text-sm">
              {formatTimeForDisplay(bookedMeeting.startTime)} - {formatTimeForDisplay(bookedMeeting.endTime)}
            </p>
          </div>

          <div className="space-y-2">
            <a
              href={bookedMeeting.eventUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full px-4 py-2.5 bg-cscx-gray-700 hover:bg-cscx-gray-600 text-white text-sm text-center rounded-lg transition-colors"
            >
              Open in Google Calendar
            </a>

            {bookedMeeting.meetLink && (
              <a
                href={bookedMeeting.meetLink}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full px-4 py-2.5 bg-blue-900/30 hover:bg-blue-900/50 text-blue-300 text-sm text-center rounded-lg transition-colors"
              >
                Open Google Meet Link
              </a>
            )}

            {initialData.prepDocumentUrl && (
              <a
                href={initialData.prepDocumentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full px-4 py-2.5 bg-teal-900/30 hover:bg-teal-900/50 text-teal-300 text-sm text-center rounded-lg transition-colors"
              >
                View Meeting Prep Document
              </a>
            )}

            {bookedMeeting.meetLink && (
              <button
                onClick={handleCopyLink}
                className="w-full px-4 py-2.5 bg-cscx-gray-700 hover:bg-cscx-gray-600 text-white text-sm rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {copied ? (
                  <>
                    <span>&#x2714;</span>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                    Copy Meeting Link
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Done button */}
        <div className="px-4 pb-4">
          <button
            onClick={handleDone}
            className="w-full px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  // Booking form view
  return (
    <div className="bg-cscx-gray-800 border border-cscx-gray-700 rounded-xl overflow-hidden max-h-[80vh] overflow-y-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600/20 to-transparent p-4 border-b border-cscx-gray-700 sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <span className="text-2xl">&#x1F4C5;</span>
          <h3 className="text-white font-semibold">Book Meeting</h3>
        </div>
        <p className="text-cscx-gray-400 text-sm mt-1">
          Schedule a calendar event with your meeting prep
        </p>
      </div>

      {/* Form */}
      <div className="p-4 space-y-4">
        {/* Title */}
        <div>
          <label className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider block mb-1.5">
            Meeting Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isBooking}
            className="w-full bg-cscx-gray-900/50 border border-cscx-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500 disabled:opacity-50"
            placeholder="Meeting title"
          />
        </div>

        {/* Attendees */}
        <div>
          <label className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider block mb-1.5">
            Attendees
          </label>
          <input
            type="text"
            value={attendees}
            onChange={(e) => setAttendees(e.target.value)}
            disabled={isBooking}
            className="w-full bg-cscx-gray-900/50 border border-cscx-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500 disabled:opacity-50"
            placeholder="email@example.com, another@example.com"
          />
        </div>

        {/* Date and Time Row */}
        <div className="grid grid-cols-2 gap-3">
          {/* Date */}
          <div>
            <label className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider block mb-1.5">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={isBooking}
              min={new Date().toISOString().split('T')[0]}
              className="w-full bg-cscx-gray-900/50 border border-cscx-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500 disabled:opacity-50"
            />
          </div>

          {/* Time */}
          <div>
            <label className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider block mb-1.5">
              Start Time
            </label>
            <select
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              disabled={isBooking}
              className={`w-full bg-cscx-gray-900/50 border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500 disabled:opacity-50 ${
                isTimeSlotBusy(startTime) ? 'border-red-500' : 'border-cscx-gray-700'
              }`}
            >
              {timeOptions.map(opt => (
                <option
                  key={opt.value}
                  value={opt.value}
                  className={isTimeSlotBusy(opt.value) ? 'text-red-400' : ''}
                >
                  {opt.label} {isTimeSlotBusy(opt.value) ? '(Busy)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Duration and Check Availability */}
        <div className="grid grid-cols-2 gap-3">
          {/* Duration */}
          <div>
            <label className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider block mb-1.5">
              Duration
            </label>
            <select
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              disabled={isBooking}
              className="w-full bg-cscx-gray-900/50 border border-cscx-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500 disabled:opacity-50"
            >
              {DURATION_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Check Availability */}
          <div className="flex items-end">
            <button
              onClick={handleCheckAvailability}
              disabled={isBooking || isCheckingAvailability}
              className="w-full px-3 py-2 bg-blue-900/30 hover:bg-blue-900/50 text-blue-300 text-sm rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isCheckingAvailability ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-300 border-t-transparent" />
                  Checking...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Check Availability
                </>
              )}
            </button>
          </div>
        </div>

        {/* Available Slots */}
        {availableSlots.length > 0 && (
          <div className="bg-green-900/20 border border-green-600/50 rounded-lg p-3">
            <p className="text-green-400 text-xs font-medium mb-2">Available Slots:</p>
            <div className="flex flex-wrap gap-2">
              {availableSlots.map((slot, i) => (
                <button
                  key={i}
                  onClick={() => handleApplySlot(slot)}
                  className="px-3 py-1.5 bg-green-900/30 hover:bg-green-900/50 text-green-300 text-sm rounded-lg transition-colors"
                >
                  {slot.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Busy blocks indicator */}
        {busyBlocks.length > 0 && availableSlots.length === 0 && (
          <div className="bg-red-900/20 border border-red-600/50 rounded-lg p-3">
            <p className="text-red-400 text-xs font-medium">
              No available slots found for the selected duration. Try a shorter meeting or different date.
            </p>
          </div>
        )}

        {/* Google Meet Toggle */}
        <div className="flex items-center gap-3 py-2">
          <input
            type="checkbox"
            id="addMeet"
            checked={addMeet}
            onChange={(e) => setAddMeet(e.target.checked)}
            disabled={isBooking}
            className="w-4 h-4 rounded border-cscx-gray-600 bg-cscx-gray-900 text-teal-500 focus:ring-teal-500 focus:ring-offset-0"
          />
          <label htmlFor="addMeet" className="text-white text-sm flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.372 0 0 5.373 0 12s5.372 12 12 12 12-5.373 12-12S18.628 0 12 0zm5.82 12.566l-3.08 1.776v1.903c0 .47-.38.85-.85.85H6.11a.85.85 0 01-.85-.85v-8.49c0-.47.38-.85.85-.85h7.78c.47 0 .85.38.85.85v1.903l3.08 1.776a.5.5 0 01.25.433v.266a.5.5 0 01-.25.433z"/>
            </svg>
            Add Google Meet video call
          </label>
        </div>

        {/* Description */}
        <div>
          <label className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider block mb-1.5">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isBooking}
            rows={4}
            className="w-full bg-cscx-gray-900/50 border border-cscx-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500 disabled:opacity-50 resize-none"
            placeholder="Meeting description and agenda"
          />
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="px-4 pb-4">
          <div className="bg-red-900/30 border border-red-600/50 rounded-lg p-3 text-red-400 text-sm">
            {error}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="px-4 pb-4 flex gap-3 sticky bottom-0 bg-cscx-gray-800 pt-2 border-t border-cscx-gray-700">
        <button
          onClick={onCancel}
          disabled={isBooking}
          className="flex-1 px-4 py-2.5 bg-cscx-gray-700 hover:bg-cscx-gray-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleBook}
          disabled={isBooking || !title || !attendees}
          className="flex-1 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isBooking ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              Booking...
            </>
          ) : (
            <>
              <span>&#x1F4C5;</span>
              Book Meeting
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default CADGMeetingBookingModal;
