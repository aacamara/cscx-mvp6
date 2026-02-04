/**
 * CADGPlanCard - Renders CADG execution plan with approve/reject actions
 * Shows plan structure, data sources, and methodology steps
 */

import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { CADGEmailPreview, EmailData, CustomerData } from './CADGEmailPreview';
import { CADGDocumentPreview, DocumentData, DocumentSection, CustomerData as DocCustomerData } from './CADGDocumentPreview';
import { CADGMeetingPrepPreview, MeetingPrepData, AgendaItem, TalkingPoint, RiskItem, CustomerData as MeetingCustomerData } from './CADGMeetingPrepPreview';
import { CADGMeetingBookingModal, MeetingBookingData, BookedMeeting } from './CADGMeetingBookingModal';
import { CADGKickoffPlanPreview, KickoffPlanData, CustomerData as KickoffCustomerData } from './CADGKickoffPlanPreview';
import { CADGMilestonePlanPreview, MilestonePlanData, CustomerData as MilestoneCustomerData } from './CADGMilestonePlanPreview';

const API_URL = import.meta.env.VITE_API_URL || '';

// ============================================
// Artifact Response Types
// ============================================
interface ArtifactResponse {
  success: boolean;
  artifactId: string;
  status: string;
  preview: string;
  storage: {
    driveFileId?: string;
    driveUrl?: string;
    additionalFiles?: Array<{
      type: string;
      fileId: string;
      url: string;
      title: string;
    }>;
  };
  metadata: {
    generationDurationMs: number;
    sourcesUsed: string[];
  };
  isTemplate?: boolean;
  templateFolderId?: string;
  message?: string;
}

// ============================================
// Types
// ============================================

export interface CADGPlan {
  planId: string;
  taskType: string;
  structure: {
    sections: Array<{
      name: string;
      description: string;
      dataSources: string[];
    }>;
    outputFormat: string;
    estimatedLength: string;
  };
  inputs: {
    knowledgeBase: any[];
    platformData: any[];
    externalSources: any[];
  };
  destination: {
    primary: string;
    secondary: string;
    chatPreview: boolean;
  };
}

export interface CADGCapability {
  id: string;
  name: string;
  description: string;
}

export interface CADGMethodology {
  id: string;
  name: string;
  steps: number;
}

export interface CADGPlanMetadata {
  isGenerative: boolean;
  taskType: string;
  confidence: number;
  requiresApproval: boolean;
  plan: CADGPlan;
  capability: CADGCapability | null;
  methodology: CADGMethodology | null;
  customerId?: string | null;  // When null or undefined, it's template mode
}

interface CADGPlanCardProps {
  metadata: CADGPlanMetadata;
  onApproved?: (artifactId: string) => void;
  onRejected?: () => void;
}

// ============================================
// Component
// ============================================

export const CADGPlanCard: React.FC<CADGPlanCardProps> = ({
  metadata,
  onApproved,
  onRejected,
}) => {
  const { getAuthHeaders } = useAuth();
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected' | 'generating' | 'complete' | 'error'>('pending');
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0]));
  const [artifact, setArtifact] = useState<ArtifactResponse | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Email preview state for HITL workflow
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [emailPreviewData, setEmailPreviewData] = useState<{
    email: EmailData;
    customer: CustomerData;
    planId: string;
  } | null>(null);

  // Document preview state for HITL workflow
  const [showDocumentPreview, setShowDocumentPreview] = useState(false);
  const [documentPreviewData, setDocumentPreviewData] = useState<{
    document: DocumentData;
    customer: DocCustomerData;
    planId: string;
  } | null>(null);

  // Meeting prep preview state for HITL workflow
  const [showMeetingPrepPreview, setShowMeetingPrepPreview] = useState(false);
  const [meetingPrepPreviewData, setMeetingPrepPreviewData] = useState<{
    meetingPrep: MeetingPrepData;
    customer: MeetingCustomerData;
    planId: string;
  } | null>(null);

  // Meeting booking modal state
  const [showMeetingBookingModal, setShowMeetingBookingModal] = useState(false);
  const [meetingBookingData, setMeetingBookingData] = useState<{
    bookingData: MeetingBookingData;
  } | null>(null);
  const [bookedMeetingInfo, setBookedMeetingInfo] = useState<BookedMeeting | null>(null);

  // Kickoff plan preview state for HITL workflow
  const [showKickoffPlanPreview, setShowKickoffPlanPreview] = useState(false);
  const [kickoffPlanPreviewData, setKickoffPlanPreviewData] = useState<{
    kickoffPlan: KickoffPlanData;
    customer: KickoffCustomerData;
    planId: string;
  } | null>(null);

  // Milestone plan preview state for HITL workflow
  const [showMilestonePlanPreview, setShowMilestonePlanPreview] = useState(false);
  const [milestonePlanPreviewData, setMilestonePlanPreviewData] = useState<{
    milestonePlan: MilestonePlanData;
    customer: MilestoneCustomerData;
    planId: string;
  } | null>(null);

  const { plan, capability, methodology, taskType, confidence, customerId } = metadata;

  // Detect template mode (no customer selected)
  const isTemplateMode = !customerId;

  const toggleSection = (index: number) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleApprove = async () => {
    setIsApproving(true);
    setError(null);
    setStatus('generating');

    try {
      const response = await fetch(`${API_URL}/api/cadg/plan/${plan.planId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Failed to approve plan');
      }

      const data = await response.json();

      // Check if this is an email preview (HITL workflow)
      if (data.isPreview && data.preview) {
        setEmailPreviewData({
          email: {
            to: data.preview.to || [],
            cc: data.preview.cc || [],
            subject: data.preview.subject || '',
            body: data.preview.body || '',
          },
          customer: {
            id: data.preview.customer?.id || customerId || '',
            name: data.preview.customer?.name || 'Customer',
            healthScore: data.preview.customer?.healthScore,
            renewalDate: data.preview.customer?.renewalDate,
          },
          planId: data.planId,
        });
        setShowEmailPreview(true);
        setStatus('pending'); // Keep in pending until email is sent
        setIsApproving(false);
        return;
      }

      // Check if this is a document preview (HITL workflow)
      if (data.isDocumentPreview && data.preview) {
        setDocumentPreviewData({
          document: {
            title: data.preview.title || 'Document',
            sections: data.preview.sections || [],
          },
          customer: {
            id: data.preview.customer?.id || customerId || '',
            name: data.preview.customer?.name || 'Customer',
            healthScore: data.preview.customer?.healthScore,
            renewalDate: data.preview.customer?.renewalDate,
          },
          planId: data.planId,
        });
        setShowDocumentPreview(true);
        setStatus('pending'); // Keep in pending until document is saved
        setIsApproving(false);
        return;
      }

      // Check if this is a meeting prep preview (HITL workflow)
      if (data.isMeetingPrepPreview && data.preview) {
        setMeetingPrepPreviewData({
          meetingPrep: {
            title: data.preview.title || 'Meeting Prep',
            attendees: data.preview.attendees || [],
            agenda: data.preview.agenda || [],
            talkingPoints: data.preview.talkingPoints || [],
            risks: data.preview.risks || [],
          },
          customer: {
            id: data.preview.customer?.id || customerId || '',
            name: data.preview.customer?.name || 'Customer',
            healthScore: data.preview.customer?.healthScore,
            renewalDate: data.preview.customer?.renewalDate,
          },
          planId: data.planId,
        });
        setShowMeetingPrepPreview(true);
        setStatus('pending'); // Keep in pending until meeting prep is saved
        setIsApproving(false);
        return;
      }

      // Check if this is a kickoff plan preview (HITL workflow)
      if (data.isKickoffPlanPreview && data.preview) {
        setKickoffPlanPreviewData({
          kickoffPlan: {
            title: data.preview.title || 'Kickoff Plan',
            attendees: data.preview.attendees || [],
            agenda: data.preview.agenda || [],
            goals: data.preview.goals || [],
            nextSteps: data.preview.nextSteps || [],
            notes: data.preview.notes || '',
            meetingDate: data.preview.meetingDate || '',
            meetingDuration: data.preview.meetingDuration || '90 min',
          },
          customer: {
            id: data.preview.customer?.id || customerId || '',
            name: data.preview.customer?.name || 'Customer',
            healthScore: data.preview.customer?.healthScore,
            renewalDate: data.preview.customer?.renewalDate,
          },
          planId: data.planId,
        });
        setShowKickoffPlanPreview(true);
        setStatus('pending'); // Keep in pending until kickoff plan is saved
        setIsApproving(false);
        return;
      }

      // Check if this is a milestone plan preview (HITL workflow)
      if (data.isMilestonePlanPreview && data.preview) {
        setMilestonePlanPreviewData({
          milestonePlan: {
            title: data.preview.title || '30-60-90 Day Plan',
            phases: data.preview.phases || [],
            notes: data.preview.notes || '',
            startDate: data.preview.startDate || '',
          },
          customer: {
            id: data.preview.customer?.id || customerId || '',
            name: data.preview.customer?.name || 'Customer',
            healthScore: data.preview.customer?.healthScore,
            renewalDate: data.preview.customer?.renewalDate,
          },
          planId: data.planId,
        });
        setShowMilestonePlanPreview(true);
        setStatus('pending'); // Keep in pending until milestone plan is saved
        setIsApproving(false);
        return;
      }

      // Regular artifact response
      setArtifact(data as ArtifactResponse);
      setStatus('complete');
      onApproved?.(data.artifactId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve plan');
      setStatus('error');
    } finally {
      setIsApproving(false);
    }
  };

  // Handle sending email from preview
  const handleEmailSend = async (email: EmailData) => {
    if (!emailPreviewData) return;

    const response = await fetch(`${API_URL}/api/cadg/email/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        planId: emailPreviewData.planId,
        to: email.to,
        cc: email.cc,
        subject: email.subject,
        body: email.body,
        customerId: emailPreviewData.customer.id,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to send email');
    }

    // Success - close preview and update status
    setShowEmailPreview(false);
    setEmailPreviewData(null);
    setStatus('complete');
    onApproved?.('email-sent');
  };

  // Handle canceling email preview
  const handleEmailCancel = () => {
    setShowEmailPreview(false);
    setEmailPreviewData(null);
    setStatus('pending');
  };

  // Handle saving document from preview
  const handleDocumentSave = async (document: DocumentData) => {
    if (!documentPreviewData) return;

    const response = await fetch(`${API_URL}/api/cadg/document/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        planId: documentPreviewData.planId,
        title: document.title,
        sections: document.sections,
        customerId: documentPreviewData.customer.id,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to save document');
    }

    const result = await response.json();

    // Success - close preview and update status
    setShowDocumentPreview(false);
    setDocumentPreviewData(null);
    setStatus('complete');
    setArtifact({
      success: true,
      artifactId: result.documentId,
      status: 'completed',
      preview: '',
      storage: {
        driveUrl: result.documentUrl,
      },
      metadata: {
        generationDurationMs: 0,
        sourcesUsed: [],
      },
    });
    onApproved?.(result.documentId);
  };

  // Handle canceling document preview
  const handleDocumentCancel = () => {
    setShowDocumentPreview(false);
    setDocumentPreviewData(null);
    setStatus('pending');
  };

  // Handle saving meeting prep from preview
  const handleMeetingPrepSave = async (meetingPrep: MeetingPrepData): Promise<{ documentUrl?: string }> => {
    if (!meetingPrepPreviewData) return {};

    const response = await fetch(`${API_URL}/api/cadg/meeting-prep/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        planId: meetingPrepPreviewData.planId,
        title: meetingPrep.title,
        attendees: meetingPrep.attendees,
        agenda: meetingPrep.agenda,
        talkingPoints: meetingPrep.talkingPoints,
        risks: meetingPrep.risks,
        customerId: meetingPrepPreviewData.customer.id,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to save meeting prep');
    }

    const result = await response.json();

    // Success - close preview and update status
    setShowMeetingPrepPreview(false);
    setMeetingPrepPreviewData(null);
    setStatus('complete');
    setArtifact({
      success: true,
      artifactId: result.documentId,
      status: 'completed',
      preview: '',
      storage: {
        driveUrl: result.documentUrl,
      },
      metadata: {
        generationDurationMs: 0,
        sourcesUsed: [],
      },
    });
    onApproved?.(result.documentId);

    return { documentUrl: result.documentUrl };
  };

  // Handle save and book meeting flow
  const handleSaveAndBook = (meetingPrep: MeetingPrepData, documentUrl: string) => {
    // Close the meeting prep preview
    setShowMeetingPrepPreview(false);
    setMeetingPrepPreviewData(null);

    // Open the booking modal with the meeting prep data
    setMeetingBookingData({
      bookingData: {
        title: meetingPrep.title,
        attendees: meetingPrep.attendees,
        agenda: meetingPrep.agenda.map(a => a.topic),
        prepDocumentUrl: documentUrl,
      },
    });
    setShowMeetingBookingModal(true);
  };

  // Handle meeting booked
  const handleMeetingBooked = async (meeting: BookedMeeting) => {
    setBookedMeetingInfo(meeting);
    setShowMeetingBookingModal(false);
    setMeetingBookingData(null);
    setStatus('complete');

    // Log the meeting booking activity
    if (meetingPrepPreviewData?.customer?.id) {
      try {
        await fetch(`${API_URL}/api/agent-activities`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            customerId: meetingPrepPreviewData.customer.id,
            activityType: 'meeting_booked',
            description: `Meeting booked: ${meeting.eventUrl}`,
            metadata: {
              eventId: meeting.eventId,
              eventUrl: meeting.eventUrl,
              meetLink: meeting.meetLink,
              startTime: meeting.startTime,
              endTime: meeting.endTime,
            },
          }),
        });
      } catch (err) {
        console.error('Failed to log meeting booking activity:', err);
      }
    }
  };

  // Handle canceling booking modal
  const handleBookingCancel = () => {
    setShowMeetingBookingModal(false);
    setMeetingBookingData(null);
    // The meeting prep was already saved, so status should stay complete
  };

  // Handle canceling meeting prep preview
  const handleMeetingPrepCancel = () => {
    setShowMeetingPrepPreview(false);
    setMeetingPrepPreviewData(null);
    setStatus('pending');
  };

  // Handle saving kickoff plan from preview
  const handleKickoffPlanSave = async (kickoffPlan: KickoffPlanData) => {
    if (!kickoffPlanPreviewData) return;

    const response = await fetch(`${API_URL}/api/cadg/kickoff-plan/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        planId: kickoffPlanPreviewData.planId,
        title: kickoffPlan.title,
        attendees: kickoffPlan.attendees,
        agenda: kickoffPlan.agenda,
        goals: kickoffPlan.goals,
        nextSteps: kickoffPlan.nextSteps,
        notes: kickoffPlan.notes,
        meetingDate: kickoffPlan.meetingDate,
        meetingDuration: kickoffPlan.meetingDuration,
        customerId: kickoffPlanPreviewData.customer.id,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to save kickoff plan');
    }

    const result = await response.json();

    // Success - close preview and update status
    setShowKickoffPlanPreview(false);
    setKickoffPlanPreviewData(null);
    setStatus('complete');
    setArtifact({
      success: true,
      artifactId: result.documentId,
      status: 'completed',
      preview: '',
      storage: {
        driveUrl: result.documentUrl,
      },
      metadata: {
        generationDurationMs: 0,
        sourcesUsed: [],
      },
    });
    onApproved?.(result.documentId);
  };

  // Handle canceling kickoff plan preview
  const handleKickoffPlanCancel = () => {
    setShowKickoffPlanPreview(false);
    setKickoffPlanPreviewData(null);
    setStatus('pending');
  };

  // Handle saving milestone plan from preview
  const handleMilestonePlanSave = async (milestonePlan: MilestonePlanData) => {
    if (!milestonePlanPreviewData) return;

    const response = await fetch(`${API_URL}/api/cadg/milestone-plan/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        planId: milestonePlanPreviewData.planId,
        title: milestonePlan.title,
        phases: milestonePlan.phases,
        notes: milestonePlan.notes,
        startDate: milestonePlan.startDate,
        customerId: milestonePlanPreviewData.customer.id,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to save milestone plan');
    }

    const result = await response.json();

    // Success - close preview and update status
    setShowMilestonePlanPreview(false);
    setMilestonePlanPreviewData(null);
    setStatus('complete');
    setArtifact({
      success: true,
      artifactId: result.documentId,
      status: 'completed',
      preview: '',
      storage: {
        driveUrl: result.documentUrl,
        additionalFiles: result.sheetUrl ? [{
          type: 'sheets',
          fileId: result.sheetId,
          url: result.sheetUrl,
          title: 'Milestone Tracker',
        }] : undefined,
      },
      metadata: {
        generationDurationMs: 0,
        sourcesUsed: [],
      },
    });
    onApproved?.(result.documentId);
  };

  // Handle canceling milestone plan preview
  const handleMilestonePlanCancel = () => {
    setShowMilestonePlanPreview(false);
    setMilestonePlanPreviewData(null);
    setStatus('pending');
  };

  const handleDownload = async (format: string) => {
    if (!artifact) return;

    setIsDownloading(true);
    setDownloadError(null);

    try {
      const response = await fetch(
        `${API_URL}/api/cadg/artifact/${artifact.artifactId}/download?format=${format}`,
        {
          method: 'GET',
          headers: {
            ...getAuthHeaders(),
          },
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Download failed');
      }

      // Get the blob and trigger download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${formatTaskType(taskType)}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleExportSources = async () => {
    if (!artifact) return;

    setIsExporting(true);
    setDownloadError(null);

    try {
      const response = await fetch(
        `${API_URL}/api/cadg/artifact/${artifact.artifactId}/export-sources`,
        {
          method: 'GET',
          headers: {
            ...getAuthHeaders(),
          },
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Export failed');
      }

      // Get the blob and trigger download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `data-sources-${artifact.artifactId.slice(0, 8)}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const handleReject = async () => {
    setIsRejecting(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/cadg/plan/${plan.planId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ reason: 'User rejected' }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Failed to reject plan');
      }

      setStatus('rejected');
      onRejected?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject plan');
    } finally {
      setIsRejecting(false);
    }
  };

  const formatTaskType = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  // Helper to get icon for artifact type
  const getArtifactIcon = (type: string) => {
    switch (type) {
      case 'slides': return '📽️';
      case 'sheets': return '📊';
      case 'docs': return '📄';
      default: return '📎';
    }
  };

  // Helper to format source names
  const formatSourceName = (source: string) => {
    return source.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  // Helper to format duration
  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    const seconds = (ms / 1000).toFixed(1);
    return `${seconds}s`;
  };

  // Email preview for HITL workflow
  if (showEmailPreview && emailPreviewData) {
    return (
      <CADGEmailPreview
        email={emailPreviewData.email}
        customer={emailPreviewData.customer}
        onSend={handleEmailSend}
        onCancel={handleEmailCancel}
      />
    );
  }

  // Document preview for HITL workflow
  if (showDocumentPreview && documentPreviewData) {
    return (
      <CADGDocumentPreview
        document={documentPreviewData.document}
        customer={documentPreviewData.customer}
        onSave={handleDocumentSave}
        onCancel={handleDocumentCancel}
      />
    );
  }

  // Meeting booking modal
  if (showMeetingBookingModal && meetingBookingData) {
    return (
      <CADGMeetingBookingModal
        initialData={meetingBookingData.bookingData}
        onBook={handleMeetingBooked}
        onCancel={handleBookingCancel}
      />
    );
  }

  // Meeting prep preview for HITL workflow
  if (showMeetingPrepPreview && meetingPrepPreviewData) {
    return (
      <CADGMeetingPrepPreview
        meetingPrep={meetingPrepPreviewData.meetingPrep}
        customer={meetingPrepPreviewData.customer}
        onSave={handleMeetingPrepSave}
        onCancel={handleMeetingPrepCancel}
        onSaveAndBook={handleSaveAndBook}
      />
    );
  }

  // Kickoff plan preview for HITL workflow
  if (showKickoffPlanPreview && kickoffPlanPreviewData) {
    return (
      <CADGKickoffPlanPreview
        kickoffPlan={kickoffPlanPreviewData.kickoffPlan}
        customer={kickoffPlanPreviewData.customer}
        onSave={handleKickoffPlanSave}
        onCancel={handleKickoffPlanCancel}
      />
    );
  }

  // Milestone plan preview for HITL workflow
  if (showMilestonePlanPreview && milestonePlanPreviewData) {
    return (
      <CADGMilestonePlanPreview
        milestonePlan={milestonePlanPreviewData.milestonePlan}
        customer={milestonePlanPreviewData.customer}
        onSave={handleMilestonePlanSave}
        onCancel={handleMilestonePlanCancel}
      />
    );
  }

  // Status-based rendering
  if (status === 'complete' && artifact) {
    return (
      <div className={`${isTemplateMode ? 'bg-blue-900/30 border-blue-600/50' : 'bg-green-900/30 border-green-600/50'} border rounded-xl overflow-hidden`}>
        {/* Header */}
        <div className={`p-4 border-b ${isTemplateMode ? 'border-blue-600/30' : 'border-green-600/30'}`}>
          <div className={`flex items-center gap-2 ${isTemplateMode ? 'text-blue-400' : 'text-green-400'}`}>
            <span className="text-xl">{isTemplateMode ? '📋' : '✅'}</span>
            <span className="font-medium">
              {isTemplateMode ? 'Template Generated Successfully!' : 'Document Generated Successfully!'}
            </span>
          </div>
          <p className={`${isTemplateMode ? 'text-blue-300/80' : 'text-green-300/80'} text-sm mt-1`}>
            {formatTaskType(taskType)} • Generated in {formatDuration(artifact.metadata.generationDurationMs)}
          </p>
        </div>

        {/* Document Links */}
        {artifact.storage.driveUrl && (
          <div className="p-4 border-b border-cscx-gray-700/50">
            <h4 className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider mb-3">
              Generated Documents
            </h4>
            <div className="space-y-2">
              {/* Primary document */}
              <a
                href={artifact.storage.driveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-2 bg-cscx-gray-800/50 rounded-lg hover:bg-cscx-gray-800 transition-colors group"
              >
                <span className="text-lg">{getArtifactIcon('slides')}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white group-hover:text-cscx-accent transition-colors truncate">
                    {formatTaskType(taskType)} Presentation
                  </p>
                  <p className="text-xs text-cscx-gray-500">Open in Google Slides</p>
                </div>
                <span className="text-cscx-gray-500 text-xs">↗</span>
              </a>

              {/* Additional files */}
              {artifact.storage.additionalFiles?.map((file, idx) => (
                <a
                  key={idx}
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-2 bg-cscx-gray-800/50 rounded-lg hover:bg-cscx-gray-800 transition-colors group"
                >
                  <span className="text-lg">{getArtifactIcon(file.type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white group-hover:text-cscx-accent transition-colors truncate">
                      {file.title}
                    </p>
                    <p className="text-xs text-cscx-gray-500">Open in Google {file.type === 'sheets' ? 'Sheets' : 'Drive'}</p>
                  </div>
                  <span className="text-cscx-gray-500 text-xs">↗</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Data Sources Used */}
        {artifact.metadata.sourcesUsed.length > 0 && (
          <div className="p-4 border-b border-cscx-gray-700/50">
            <h4 className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider mb-3">
              Data Sources Used
            </h4>
            <div className="flex flex-wrap gap-2">
              {artifact.metadata.sourcesUsed.map((source, idx) => (
                <span
                  key={idx}
                  className="text-xs bg-cscx-gray-800 text-cscx-gray-300 px-2 py-1 rounded-full flex items-center gap-1"
                >
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                  {formatSourceName(source)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Template Mode Info */}
        {isTemplateMode && (
          <div className="p-4 border-b border-cscx-gray-700/50">
            <div className="bg-blue-900/20 border border-blue-600/30 rounded-lg p-3 text-blue-300 text-sm flex items-start gap-2">
              <span className="text-blue-400 mt-0.5">ℹ️</span>
              <div>
                <p className="font-medium">Template Mode</p>
                <p className="text-blue-300/70 text-xs mt-1">
                  Replace placeholder data from "ACME Corporation" before using with a real customer.
                </p>
                {artifact.templateFolderId && (
                  <p className="text-blue-300/60 text-xs mt-1">
                    Saved to: CSCX Templates folder
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Meeting Booked Info */}
        {bookedMeetingInfo && (
          <div className="p-4 border-b border-cscx-gray-700/50">
            <div className="bg-teal-900/20 border border-teal-600/30 rounded-lg p-3">
              <div className="flex items-center gap-2 text-teal-400 mb-2">
                <span>&#x1F4C5;</span>
                <span className="font-medium text-sm">Meeting Booked</span>
              </div>
              <div className="space-y-2">
                <a
                  href={bookedMeetingInfo.eventUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-sm text-teal-300 hover:text-teal-200 transition-colors"
                >
                  Open in Google Calendar ↗
                </a>
                {bookedMeetingInfo.meetLink && (
                  <a
                    href={bookedMeetingInfo.meetLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-sm text-blue-300 hover:text-blue-200 transition-colors"
                  >
                    Google Meet Link ↗
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="p-4 border-b border-cscx-gray-700/50">
          <div className="flex flex-wrap gap-2">
            {/* Download buttons */}
            {artifact.storage.driveFileId && (
              <>
                <button
                  onClick={() => handleDownload('pdf')}
                  disabled={isDownloading}
                  className="flex items-center gap-2 px-3 py-1.5 bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                >
                  {isDownloading ? (
                    <div className="animate-spin rounded-full h-3 w-3 border border-white border-t-transparent" />
                  ) : (
                    <span>⬇</span>
                  )}
                  Download PDF
                </button>
                <button
                  onClick={() => handleDownload('pptx')}
                  disabled={isDownloading}
                  className="flex items-center gap-2 px-3 py-1.5 bg-cscx-gray-800 hover:bg-cscx-gray-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                >
                  <span>📽️</span>
                  PPTX
                </button>
              </>
            )}

            {/* Export Data Sources */}
            <button
              onClick={handleExportSources}
              disabled={isExporting}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-900/30 hover:bg-blue-900/50 text-blue-300 text-sm rounded-lg transition-colors disabled:opacity-50"
            >
              {isExporting ? (
                <div className="animate-spin rounded-full h-3 w-3 border border-blue-300 border-t-transparent" />
              ) : (
                <span>📊</span>
              )}
              Export Data Sources (CSV)
            </button>
          </div>

          {/* Download Error */}
          {downloadError && (
            <div className="mt-2 text-xs text-red-400">
              {downloadError}
            </div>
          )}
        </div>

        {/* Generation Stats */}
        <div className="p-4 bg-cscx-gray-900/30">
          <div className="flex items-center justify-between text-xs text-cscx-gray-500">
            <span>Artifact ID: {artifact.artifactId.slice(0, 8)}...</span>
            <span>Generated just now</span>
          </div>
        </div>
      </div>
    );
  }

  // Fallback for complete status without artifact data
  if (status === 'complete') {
    return (
      <div className={`${isTemplateMode ? 'bg-blue-900/30 border-blue-600/50' : 'bg-green-900/30 border-green-600/50'} border rounded-xl p-4`}>
        <div className={`flex items-center gap-2 ${isTemplateMode ? 'text-blue-400' : 'text-green-400'}`}>
          <span className="text-xl">{isTemplateMode ? '📋' : '✅'}</span>
          <span className="font-medium">
            {isTemplateMode ? 'Template Generated Successfully!' : 'Document Generated Successfully!'}
          </span>
        </div>
        <p className={`${isTemplateMode ? 'text-blue-300/80' : 'text-green-300/80'} text-sm mt-2`}>
          {isTemplateMode
            ? `Your ${formatTaskType(taskType)} template has been created with sample data. Replace placeholder values before using.`
            : `Your ${formatTaskType(taskType)} has been created and saved to ${plan.destination.primary}.`
          }
        </p>
      </div>
    );
  }

  if (status === 'rejected') {
    return (
      <div className="bg-gray-800/50 border border-gray-600/50 rounded-xl p-4">
        <div className="flex items-center gap-2 text-gray-400">
          <span className="text-xl">❌</span>
          <span className="font-medium">Plan Rejected</span>
        </div>
        <p className="text-gray-500 text-sm mt-2">
          You can ask me to create a different plan or modify your request.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-cscx-gray-800 border border-cscx-gray-700 rounded-xl overflow-hidden">
      {/* Header */}
      <div className={`bg-gradient-to-r ${isTemplateMode ? 'from-blue-600/20' : 'from-cscx-accent/20'} to-transparent p-4 border-b border-cscx-gray-700`}>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{isTemplateMode ? '📋' : '📊'}</span>
              <h3 className="text-white font-semibold">Execution Plan</h3>
              {isTemplateMode && (
                <span className="text-xs bg-blue-600/30 text-blue-400 px-2 py-0.5 rounded-full font-medium">
                  Template Mode
                </span>
              )}
            </div>
            <p className="text-cscx-gray-400 text-sm mt-1">
              {formatTaskType(taskType)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-cscx-gray-400">Confidence</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              confidence >= 0.9 ? 'bg-green-900/50 text-green-400' :
              confidence >= 0.7 ? 'bg-yellow-900/50 text-yellow-400' :
              'bg-orange-900/50 text-orange-400'
            }`}>
              {Math.round(confidence * 100)}%
            </span>
          </div>
        </div>
      </div>

      {/* Capability & Methodology */}
      {(capability || methodology) && (
        <div className="px-4 py-3 border-b border-cscx-gray-700 flex flex-wrap gap-3">
          {capability && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-cscx-gray-500">Capability:</span>
              <span className="text-xs bg-blue-900/30 text-blue-400 px-2 py-0.5 rounded">
                {capability.name}
              </span>
            </div>
          )}
          {methodology && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-cscx-gray-500">Methodology:</span>
              <span className="text-xs bg-purple-900/30 text-purple-400 px-2 py-0.5 rounded">
                {methodology.name} ({methodology.steps} steps)
              </span>
            </div>
          )}
        </div>
      )}

      {/* Sections */}
      <div className="p-4">
        <h4 className="text-xs font-medium text-cscx-gray-400 uppercase tracking-wider mb-3">
          Document Structure
        </h4>
        <div className="space-y-2">
          {plan.structure.sections.map((section, index) => (
            <div
              key={index}
              className="bg-cscx-gray-900/50 rounded-lg overflow-hidden"
            >
              <button
                onClick={() => toggleSection(index)}
                className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-cscx-gray-900/80 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-cscx-gray-500 text-xs font-mono">{index + 1}</span>
                  <span className="text-white text-sm font-medium">{section.name}</span>
                </div>
                <span className="text-cscx-gray-500 text-xs">
                  {expandedSections.has(index) ? '▼' : '▶'}
                </span>
              </button>
              {expandedSections.has(index) && (
                <div className="px-3 pb-3 pt-1">
                  <p className="text-cscx-gray-400 text-xs mb-2">{section.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {section.dataSources.map((source, i) => (
                      <span
                        key={i}
                        className="text-xs bg-cscx-gray-800 text-cscx-gray-400 px-1.5 py-0.5 rounded"
                      >
                        {source.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Output Info */}
      <div className="px-4 pb-4">
        <div className="bg-cscx-gray-900/50 rounded-lg p-3">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-cscx-gray-500">Output Format:</span>
              <span className="text-white ml-2">{plan.structure.outputFormat}</span>
            </div>
            <div>
              <span className="text-cscx-gray-500">Est. Length:</span>
              <span className="text-white ml-2">{plan.structure.estimatedLength}</span>
            </div>
            <div className="col-span-2">
              <span className="text-cscx-gray-500">Destination:</span>
              <span className="text-white ml-2">{plan.destination.primary}</span>
            </div>
          </div>
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

      {/* Template Mode Info */}
      {status === 'pending' && isTemplateMode && (
        <div className="px-4 pb-3">
          <div className="bg-blue-900/20 border border-blue-600/30 rounded-lg p-3 text-blue-300 text-sm flex items-start gap-2">
            <span className="text-blue-400 mt-0.5">ℹ️</span>
            <div>
              <p className="font-medium">No customer selected</p>
              <p className="text-blue-300/70 text-xs mt-1">
                This will generate a template with sample data from "ACME Corporation".
                Replace placeholder values before using with a real customer.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {status === 'pending' && (
        <div className="px-4 pb-4 flex gap-3">
          <button
            onClick={handleReject}
            disabled={isRejecting || isApproving}
            className="flex-1 px-4 py-2.5 bg-cscx-gray-700 hover:bg-cscx-gray-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {isRejecting ? 'Rejecting...' : 'Reject'}
          </button>
          <button
            onClick={handleApprove}
            disabled={isApproving || isRejecting}
            className={`flex-1 px-4 py-2.5 ${isTemplateMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-cscx-accent hover:bg-red-700'} text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2`}
          >
            {isApproving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                {isTemplateMode ? 'Generating Template...' : 'Generating...'}
              </>
            ) : (
              <>
                <span>{isTemplateMode ? '📋' : '✓'}</span>
                {isTemplateMode ? 'Generate Template' : 'Approve & Generate'}
              </>
            )}
          </button>
        </div>
      )}

      {/* Generating Status */}
      {status === 'generating' && (
        <div className="px-4 pb-4">
          <div className="bg-blue-900/30 border border-blue-600/50 rounded-lg p-4 flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-400 border-t-transparent" />
            <div>
              <p className="text-blue-400 font-medium">Generating Document...</p>
              <p className="text-blue-300/70 text-sm">This may take a moment</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CADGPlanCard;
