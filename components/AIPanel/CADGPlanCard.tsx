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
import { CADGStakeholderMapPreview, StakeholderMapData, CustomerData as StakeholderCustomerData } from './CADGStakeholderMapPreview';
import { CADGTrainingSchedulePreview, TrainingScheduleData, CustomerData as TrainingCustomerData } from './CADGTrainingSchedulePreview';
import { CADGUsageAnalysisPreview, UsageAnalysisData, CustomerData as UsageAnalysisCustomerData } from './CADGUsageAnalysisPreview';
import { CADGFeatureCampaignPreview, FeatureCampaignData, CustomerData as FeatureCampaignCustomerData } from './CADGFeatureCampaignPreview';
import { CADGChampionDevelopmentPreview, ChampionDevelopmentData, CustomerData as ChampionDevelopmentCustomerData } from './CADGChampionDevelopmentPreview';
import { CADGTrainingProgramPreview, TrainingProgramData, CustomerData as TrainingProgramCustomerData } from './CADGTrainingProgramPreview';
import { CADGRenewalForecastPreview, RenewalForecastData, CustomerData as RenewalForecastCustomerData } from './CADGRenewalForecastPreview';
import { CADGValueSummaryPreview, ValueSummaryData, CustomerData as ValueSummaryCustomerData } from './CADGValueSummaryPreview';
import { CADGExpansionProposalPreview, ExpansionProposalData, CustomerData as ExpansionProposalCustomerData } from './CADGExpansionProposalPreview';
import { CADGNegotiationBriefPreview, NegotiationBriefData, CustomerData as NegotiationBriefCustomerData } from './CADGNegotiationBriefPreview';
import { CADGRiskAssessmentPreview, RiskAssessmentData, CustomerData as RiskAssessmentCustomerData } from './CADGRiskAssessmentPreview';
import { CADGSavePlayPreview, SavePlayData, CustomerData as SavePlayCustomerData } from './CADGSavePlayPreview';
import { CADGEscalationReportPreview, EscalationReportData, CustomerData as EscalationReportCustomerData } from './CADGEscalationReportPreview';
import { CADGResolutionPlanPreview, ResolutionPlanData, CustomerData as ResolutionPlanCustomerData } from './CADGResolutionPlanPreview';

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

  // Stakeholder map preview state for HITL workflow
  const [showStakeholderMapPreview, setShowStakeholderMapPreview] = useState(false);
  const [stakeholderMapPreviewData, setStakeholderMapPreviewData] = useState<{
    stakeholderMap: StakeholderMapData;
    customer: StakeholderCustomerData;
    planId: string;
  } | null>(null);

  // Training schedule preview state for HITL workflow
  const [showTrainingSchedulePreview, setShowTrainingSchedulePreview] = useState(false);
  const [trainingSchedulePreviewData, setTrainingSchedulePreviewData] = useState<{
    trainingSchedule: TrainingScheduleData;
    customer: TrainingCustomerData;
    planId: string;
  } | null>(null);

  // Usage analysis preview state for HITL workflow
  const [showUsageAnalysisPreview, setShowUsageAnalysisPreview] = useState(false);
  const [usageAnalysisPreviewData, setUsageAnalysisPreviewData] = useState<{
    usageAnalysis: UsageAnalysisData;
    customer: UsageAnalysisCustomerData;
    planId: string;
  } | null>(null);

  // Feature campaign preview state for HITL workflow
  const [showFeatureCampaignPreview, setShowFeatureCampaignPreview] = useState(false);
  const [featureCampaignPreviewData, setFeatureCampaignPreviewData] = useState<{
    featureCampaign: FeatureCampaignData;
    customer: FeatureCampaignCustomerData;
    planId: string;
  } | null>(null);

  // Champion development preview state for HITL workflow
  const [showChampionDevelopmentPreview, setShowChampionDevelopmentPreview] = useState(false);
  const [championDevelopmentPreviewData, setChampionDevelopmentPreviewData] = useState<{
    championDevelopment: ChampionDevelopmentData;
    customer: ChampionDevelopmentCustomerData;
    planId: string;
  } | null>(null);

  // Training program preview state for HITL workflow
  const [showTrainingProgramPreview, setShowTrainingProgramPreview] = useState(false);
  const [trainingProgramPreviewData, setTrainingProgramPreviewData] = useState<{
    trainingProgram: TrainingProgramData;
    customer: TrainingProgramCustomerData;
    planId: string;
  } | null>(null);

  // Renewal forecast preview state for HITL workflow
  const [showRenewalForecastPreview, setShowRenewalForecastPreview] = useState(false);
  const [renewalForecastPreviewData, setRenewalForecastPreviewData] = useState<{
    renewalForecast: RenewalForecastData;
    customer: RenewalForecastCustomerData;
    planId: string;
  } | null>(null);

  // Value summary preview state for HITL workflow
  const [showValueSummaryPreview, setShowValueSummaryPreview] = useState(false);
  const [valueSummaryPreviewData, setValueSummaryPreviewData] = useState<{
    valueSummary: ValueSummaryData;
    customer: ValueSummaryCustomerData;
    planId: string;
  } | null>(null);

  // Expansion proposal preview state for HITL workflow
  const [showExpansionProposalPreview, setShowExpansionProposalPreview] = useState(false);
  const [expansionProposalPreviewData, setExpansionProposalPreviewData] = useState<{
    expansionProposal: ExpansionProposalData;
    customer: ExpansionProposalCustomerData;
    planId: string;
  } | null>(null);

  // Negotiation brief preview state for HITL workflow
  const [showNegotiationBriefPreview, setShowNegotiationBriefPreview] = useState(false);
  const [negotiationBriefPreviewData, setNegotiationBriefPreviewData] = useState<{
    negotiationBrief: NegotiationBriefData;
    customer: NegotiationBriefCustomerData;
    planId: string;
  } | null>(null);

  // Risk assessment preview state for HITL workflow
  const [showRiskAssessmentPreview, setShowRiskAssessmentPreview] = useState(false);
  const [riskAssessmentPreviewData, setRiskAssessmentPreviewData] = useState<{
    riskAssessment: RiskAssessmentData;
    customer: RiskAssessmentCustomerData;
    planId: string;
  } | null>(null);

  // Save play preview state for HITL workflow
  const [showSavePlayPreview, setShowSavePlayPreview] = useState(false);
  const [savePlayPreviewData, setSavePlayPreviewData] = useState<{
    savePlay: SavePlayData;
    customer: SavePlayCustomerData;
    planId: string;
  } | null>(null);

  // Escalation report preview state for HITL workflow
  const [showEscalationReportPreview, setShowEscalationReportPreview] = useState(false);
  const [escalationReportPreviewData, setEscalationReportPreviewData] = useState<{
    escalationReport: EscalationReportData;
    customer: EscalationReportCustomerData;
    planId: string;
  } | null>(null);

  // Resolution plan preview state for HITL workflow
  const [showResolutionPlanPreview, setShowResolutionPlanPreview] = useState(false);
  const [resolutionPlanPreviewData, setResolutionPlanPreviewData] = useState<{
    resolutionPlan: ResolutionPlanData;
    customer: ResolutionPlanCustomerData;
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

      // Check if this is a stakeholder map preview (HITL workflow)
      if (data.isStakeholderMapPreview && data.preview) {
        setStakeholderMapPreviewData({
          stakeholderMap: {
            title: data.preview.title || 'Stakeholder Map',
            stakeholders: data.preview.stakeholders || [],
            relationships: data.preview.relationships || [],
            notes: data.preview.notes || '',
          },
          customer: {
            id: data.preview.customer?.id || customerId || '',
            name: data.preview.customer?.name || 'Customer',
            healthScore: data.preview.customer?.healthScore,
            renewalDate: data.preview.customer?.renewalDate,
          },
          planId: data.planId,
        });
        setShowStakeholderMapPreview(true);
        setStatus('pending'); // Keep in pending until stakeholder map is saved
        setIsApproving(false);
        return;
      }

      // Check if this is a training schedule preview (HITL workflow)
      if (data.isTrainingSchedulePreview && data.preview) {
        setTrainingSchedulePreviewData({
          trainingSchedule: {
            title: data.preview.title || 'Training Schedule',
            sessions: data.preview.sessions || [],
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
        setShowTrainingSchedulePreview(true);
        setStatus('pending'); // Keep in pending until training schedule is saved
        setIsApproving(false);
        return;
      }

      // Check if this is a usage analysis preview (HITL workflow)
      if (data.isUsageAnalysisPreview && data.preview) {
        setUsageAnalysisPreviewData({
          usageAnalysis: {
            title: data.preview.title || 'Usage Analysis Report',
            timeRange: data.preview.timeRange || { start: '', end: '', preset: 'last_30_days' },
            metrics: data.preview.metrics || [],
            featureAdoption: data.preview.featureAdoption || [],
            userSegments: data.preview.userSegments || [],
            recommendations: data.preview.recommendations || [],
            chartTypes: data.preview.chartTypes || {
              showTrendChart: true,
              showAdoptionChart: true,
              showSegmentChart: true,
              showHeatmap: false,
            },
            notes: data.preview.notes || '',
          },
          customer: {
            id: data.preview.customer?.id || customerId || '',
            name: data.preview.customer?.name || 'Customer',
            healthScore: data.preview.customer?.healthScore,
            renewalDate: data.preview.customer?.renewalDate,
          },
          planId: data.planId,
        });
        setShowUsageAnalysisPreview(true);
        setStatus('pending'); // Keep in pending until usage analysis is saved
        setIsApproving(false);
        return;
      }

      // Check if this is a feature campaign preview (HITL workflow)
      if (data.isFeatureCampaignPreview && data.preview) {
        setFeatureCampaignPreviewData({
          featureCampaign: {
            title: data.preview.title || 'Feature Adoption Campaign',
            campaignGoal: data.preview.campaignGoal || '',
            targetFeatures: data.preview.targetFeatures || [],
            userSegments: data.preview.userSegments || [],
            timeline: data.preview.timeline || { startDate: '', endDate: '', phases: [] },
            messaging: data.preview.messaging || [],
            successMetrics: data.preview.successMetrics || [],
            notes: data.preview.notes || '',
          },
          customer: {
            id: data.preview.customer?.id || customerId || '',
            name: data.preview.customer?.name || 'Customer',
            healthScore: data.preview.customer?.healthScore,
            renewalDate: data.preview.customer?.renewalDate,
          },
          planId: data.planId,
        });
        setShowFeatureCampaignPreview(true);
        setStatus('pending'); // Keep in pending until feature campaign is saved
        setIsApproving(false);
        return;
      }

      // Check if this is a champion development preview (HITL workflow)
      if (data.isChampionDevelopmentPreview && data.preview) {
        setChampionDevelopmentPreviewData({
          championDevelopment: {
            title: data.preview.title || 'Champion Development Program',
            programGoal: data.preview.programGoal || '',
            candidates: data.preview.candidates || [],
            activities: data.preview.activities || [],
            rewards: data.preview.rewards || [],
            timeline: data.preview.timeline || { startDate: '', endDate: '', milestones: [] },
            successMetrics: data.preview.successMetrics || [],
            notes: data.preview.notes || '',
          },
          customer: {
            id: data.preview.customer?.id || customerId || '',
            name: data.preview.customer?.name || 'Customer',
            healthScore: data.preview.customer?.healthScore,
            renewalDate: data.preview.customer?.renewalDate,
          },
          planId: data.planId,
        });
        setShowChampionDevelopmentPreview(true);
        setStatus('pending'); // Keep in pending until champion development is saved
        setIsApproving(false);
        return;
      }

      // Check if this is a training program preview (HITL workflow)
      if (data.isTrainingProgramPreview && data.preview) {
        setTrainingProgramPreviewData({
          trainingProgram: {
            title: data.preview.title || 'Training Program',
            programGoal: data.preview.programGoal || '',
            modules: data.preview.modules || [],
            targetAudience: data.preview.targetAudience || [],
            timeline: data.preview.timeline || { startDate: '', endDate: '', totalDuration: '' },
            completionCriteria: data.preview.completionCriteria || [],
            successMetrics: data.preview.successMetrics || [],
            notes: data.preview.notes || '',
          },
          customer: {
            id: data.preview.customer?.id || customerId || '',
            name: data.preview.customer?.name || 'Customer',
            healthScore: data.preview.customer?.healthScore,
            renewalDate: data.preview.customer?.renewalDate,
          },
          planId: data.planId,
        });
        setShowTrainingProgramPreview(true);
        setStatus('pending'); // Keep in pending until training program is saved
        setIsApproving(false);
        return;
      }

      // Check if this is a value summary preview (HITL workflow)
      if (data.isValueSummaryPreview && data.preview) {
        setValueSummaryPreviewData({
          valueSummary: {
            title: data.preview.title || 'Value Summary',
            executiveSummary: data.preview.executiveSummary || '',
            valueMetrics: data.preview.valueMetrics || [],
            successStories: data.preview.successStories || [],
            testimonials: data.preview.testimonials || [],
            roiCalculation: data.preview.roiCalculation || {
              investmentCost: 0,
              annualBenefit: 0,
              roiPercentage: 0,
              paybackMonths: 0,
              threeYearValue: 0,
              assumptions: [],
            },
            keyHighlights: data.preview.keyHighlights || [],
            nextSteps: data.preview.nextSteps || [],
            notes: data.preview.notes || '',
          },
          customer: {
            id: data.preview.customer?.id || customerId || null,
            name: data.preview.customer?.name || 'Customer',
            healthScore: data.preview.customer?.healthScore,
            arr: data.preview.customer?.arr,
          },
          planId: data.planId,
        });
        setShowValueSummaryPreview(true);
        setStatus('pending'); // Keep in pending until value summary is saved
        setIsApproving(false);
        return;
      }

      // Check if this is an expansion proposal preview (HITL workflow)
      if (data.isExpansionProposalPreview && data.preview) {
        setExpansionProposalPreviewData({
          expansionProposal: {
            title: data.preview.title || 'Expansion Proposal',
            proposalDate: data.preview.proposalDate || new Date().toISOString().slice(0, 10),
            validUntil: data.preview.validUntil || '',
            currentArrValue: data.preview.currentArrValue || 0,
            proposedArrValue: data.preview.proposedArrValue || 0,
            expansionAmount: data.preview.expansionAmount || 0,
            expansionProducts: data.preview.expansionProducts || [],
            pricingOptions: data.preview.pricingOptions || [],
            businessCase: data.preview.businessCase || [],
            roiProjection: data.preview.roiProjection || {
              investmentIncrease: 0,
              projectedBenefit: 0,
              roiPercentage: 0,
              paybackMonths: 0,
              assumptions: [],
            },
            usageGaps: data.preview.usageGaps || [],
            growthSignals: data.preview.growthSignals || [],
            nextSteps: data.preview.nextSteps || [],
            notes: data.preview.notes || '',
          },
          customer: {
            id: data.preview.customer?.id || customerId || null,
            name: data.preview.customer?.name || 'Customer',
            healthScore: data.preview.customer?.healthScore,
            arr: data.preview.customer?.arr,
          },
          planId: data.planId,
        });
        setShowExpansionProposalPreview(true);
        setStatus('pending'); // Keep in pending until expansion proposal is saved
        setIsApproving(false);
        return;
      }

      // Check if this is a negotiation brief preview (HITL workflow)
      if (data.isNegotiationBriefPreview && data.preview) {
        setNegotiationBriefPreviewData({
          negotiationBrief: {
            title: data.preview.title || 'Negotiation Brief',
            negotiationDate: data.preview.negotiationDate || new Date().toISOString().slice(0, 10),
            contractValue: data.preview.contractValue || 0,
            contractTerm: data.preview.contractTerm || '12 months',
            renewalDate: data.preview.renewalDate || '',
            currentTerms: data.preview.currentTerms || [],
            leveragePoints: data.preview.leveragePoints || [],
            counterStrategies: data.preview.counterStrategies || [],
            walkAwayPoints: data.preview.walkAwayPoints || [],
            competitorIntel: data.preview.competitorIntel || [],
            valueDelivered: data.preview.valueDelivered || [],
            internalNotes: data.preview.internalNotes || '',
          },
          customer: {
            id: data.preview.customer?.id || customerId || null,
            name: data.preview.customer?.name || 'Customer',
            healthScore: data.preview.customer?.healthScore,
            arr: data.preview.customer?.arr,
            renewalDate: data.preview.customer?.renewalDate,
          },
          planId: data.planId,
        });
        setShowNegotiationBriefPreview(true);
        setStatus('pending'); // Keep in pending until negotiation brief is saved
        setIsApproving(false);
        return;
      }

      // Check if this is a risk assessment preview (HITL workflow)
      if (data.isRiskAssessmentPreview && data.preview) {
        setRiskAssessmentPreviewData({
          riskAssessment: {
            title: data.preview.title || 'Risk Assessment',
            assessmentDate: data.preview.assessmentDate || new Date().toISOString().slice(0, 10),
            overallRiskScore: data.preview.overallRiskScore || 50,
            riskLevel: data.preview.riskLevel || 'medium',
            healthScore: data.preview.healthScore || 0,
            daysUntilRenewal: data.preview.daysUntilRenewal || 0,
            arr: data.preview.arr || 0,
            riskFactors: data.preview.riskFactors || [],
            mitigationActions: data.preview.mitigationActions || [],
            executiveSummary: data.preview.executiveSummary || '',
            notes: data.preview.notes || '',
          },
          customer: {
            id: data.preview.customer?.id || customerId || null,
            name: data.preview.customer?.name || 'Customer',
            healthScore: data.preview.customer?.healthScore,
            arr: data.preview.customer?.arr,
            renewalDate: data.preview.customer?.renewalDate,
          },
          planId: data.planId,
        });
        setShowRiskAssessmentPreview(true);
        setStatus('pending'); // Keep in pending until risk assessment is saved
        setIsApproving(false);
        return;
      }

      // Check if this is a save play preview (HITL workflow)
      if (data.isSavePlayPreview && data.preview) {
        setSavePlayPreviewData({
          savePlay: {
            title: data.preview.title || 'Save Play',
            createdDate: data.preview.createdDate || new Date().toISOString().slice(0, 10),
            riskLevel: data.preview.riskLevel || 'high',
            situation: data.preview.situation || '',
            healthScore: data.preview.healthScore || 0,
            daysUntilRenewal: data.preview.daysUntilRenewal || 0,
            arr: data.preview.arr || 0,
            rootCauses: data.preview.rootCauses || [],
            actionItems: data.preview.actionItems || [],
            successMetrics: data.preview.successMetrics || [],
            timeline: data.preview.timeline || '30 days',
            notes: data.preview.notes || '',
          },
          customer: {
            id: data.preview.customer?.id || customerId || null,
            name: data.preview.customer?.name || 'Customer',
            healthScore: data.preview.customer?.healthScore,
            arr: data.preview.customer?.arr,
            renewalDate: data.preview.customer?.renewalDate,
          },
          planId: data.planId,
        });
        setShowSavePlayPreview(true);
        setStatus('pending'); // Keep in pending until save play is saved
        setIsApproving(false);
        return;
      }

      // Check if this is an escalation report preview (HITL workflow)
      if (data.isEscalationReportPreview && data.preview) {
        setEscalationReportPreviewData({
          escalationReport: {
            title: data.preview.title || 'Escalation Report',
            createdDate: data.preview.createdDate || new Date().toISOString().slice(0, 10),
            escalationLevel: data.preview.escalationLevel || 'high',
            issueSummary: data.preview.issueSummary || '',
            customerName: data.preview.customerName || 'Customer',
            arr: data.preview.arr || 0,
            healthScore: data.preview.healthScore || 0,
            daysUntilRenewal: data.preview.daysUntilRenewal || 0,
            primaryContact: data.preview.primaryContact || '',
            escalationOwner: data.preview.escalationOwner || '',
            timeline: data.preview.timeline || [],
            impactMetrics: data.preview.impactMetrics || [],
            resolutionRequests: data.preview.resolutionRequests || [],
            supportingEvidence: data.preview.supportingEvidence || [],
            recommendedActions: data.preview.recommendedActions || '',
            notes: data.preview.notes || '',
          },
          customer: {
            id: data.preview.customer?.id || customerId || null,
            name: data.preview.customer?.name || 'Customer',
            healthScore: data.preview.customer?.healthScore,
            arr: data.preview.customer?.arr,
            renewalDate: data.preview.customer?.renewalDate,
          },
          planId: data.planId,
        });
        setShowEscalationReportPreview(true);
        setStatus('pending'); // Keep in pending until escalation report is saved
        setIsApproving(false);
        return;
      }

      // Check if this is a resolution plan preview (HITL workflow)
      if (data.isResolutionPlanPreview && data.preview) {
        setResolutionPlanPreviewData({
          resolutionPlan: {
            title: data.preview.title || 'Resolution Plan',
            createdDate: data.preview.createdDate || new Date().toISOString().slice(0, 10),
            targetResolutionDate: data.preview.targetResolutionDate || '',
            overallStatus: data.preview.overallStatus || 'on_track',
            summary: data.preview.summary || '',
            healthScore: data.preview.healthScore || 0,
            daysUntilRenewal: data.preview.daysUntilRenewal || 0,
            arr: data.preview.arr || 0,
            issues: data.preview.issues || [],
            actionItems: data.preview.actionItems || [],
            dependencies: data.preview.dependencies || [],
            timeline: data.preview.timeline || '',
            notes: data.preview.notes || '',
          },
          customer: {
            id: data.preview.customer?.id || customerId || null,
            name: data.preview.customer?.name || 'Customer',
            healthScore: data.preview.customer?.healthScore,
            arr: data.preview.customer?.arr,
            renewalDate: data.preview.customer?.renewalDate,
          },
          planId: data.planId,
        });
        setShowResolutionPlanPreview(true);
        setStatus('pending'); // Keep in pending until resolution plan is saved
        setIsApproving(false);
        return;
      }

      // Check if this is a renewal forecast preview (HITL workflow)
      if (data.isRenewalForecastPreview && data.preview) {
        setRenewalForecastPreviewData({
          renewalForecast: {
            title: data.preview.title || 'Renewal Forecast',
            renewalDate: data.preview.renewalDate || '',
            currentProbability: data.preview.currentProbability || 70,
            targetProbability: data.preview.targetProbability || 85,
            arr: data.preview.arr || 0,
            contractTerm: data.preview.contractTerm || '12 months',
            probabilityFactors: data.preview.probabilityFactors || [],
            riskFactors: data.preview.riskFactors || [],
            positiveSignals: data.preview.positiveSignals || [],
            recommendedActions: data.preview.recommendedActions || [],
            historicalContext: data.preview.historicalContext || '',
            notes: data.preview.notes || '',
          },
          customer: {
            id: data.preview.customer?.id || customerId || null,
            name: data.preview.customer?.name || 'Customer',
            healthScore: data.preview.customer?.healthScore,
            renewalDate: data.preview.customer?.renewalDate,
          },
          planId: data.planId,
        });
        setShowRenewalForecastPreview(true);
        setStatus('pending'); // Keep in pending until renewal forecast is saved
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

  // Handle saving stakeholder map from preview
  const handleStakeholderMapSave = async (stakeholderMap: StakeholderMapData) => {
    if (!stakeholderMapPreviewData) return;

    const response = await fetch(`${API_URL}/api/cadg/stakeholder-map/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        planId: stakeholderMapPreviewData.planId,
        title: stakeholderMap.title,
        stakeholders: stakeholderMap.stakeholders,
        relationships: stakeholderMap.relationships,
        notes: stakeholderMap.notes,
        customerId: stakeholderMapPreviewData.customer.id,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to save stakeholder map');
    }

    const result = await response.json();

    // Success - close preview and update status
    setShowStakeholderMapPreview(false);
    setStakeholderMapPreviewData(null);
    setStatus('complete');
    setArtifact({
      success: true,
      artifactId: result.documentId,
      status: 'completed',
      preview: '',
      storage: {
        driveUrl: result.documentUrl,
        additionalFiles: result.slidesUrl ? [{
          type: 'slides',
          fileId: result.slidesId,
          url: result.slidesUrl,
          title: 'Stakeholder Map Visual',
        }] : undefined,
      },
      metadata: {
        generationDurationMs: 0,
        sourcesUsed: [],
      },
    });
    onApproved?.(result.documentId);
  };

  // Handle canceling stakeholder map preview
  const handleStakeholderMapCancel = () => {
    setShowStakeholderMapPreview(false);
    setStakeholderMapPreviewData(null);
    setStatus('pending');
  };

  // Handle saving training schedule from preview
  const handleTrainingScheduleSave = async (trainingSchedule: TrainingScheduleData) => {
    if (!trainingSchedulePreviewData) return;

    const response = await fetch(`${API_URL}/api/cadg/training-schedule/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        planId: trainingSchedulePreviewData.planId,
        title: trainingSchedule.title,
        sessions: trainingSchedule.sessions,
        notes: trainingSchedule.notes,
        startDate: trainingSchedule.startDate,
        customerId: trainingSchedulePreviewData.customer.id,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to save training schedule');
    }

    const result = await response.json();

    // Success - close preview and update status
    setShowTrainingSchedulePreview(false);
    setTrainingSchedulePreviewData(null);
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
          title: 'Training Calendar',
        }] : undefined,
      },
      metadata: {
        generationDurationMs: 0,
        sourcesUsed: [],
      },
    });
    onApproved?.(result.documentId);
  };

  // Handle canceling training schedule preview
  const handleTrainingScheduleCancel = () => {
    setShowTrainingSchedulePreview(false);
    setTrainingSchedulePreviewData(null);
    setStatus('pending');
  };

  // Handle saving usage analysis from preview
  const handleUsageAnalysisSave = async (usageAnalysis: UsageAnalysisData) => {
    if (!usageAnalysisPreviewData) return;

    const response = await fetch(`${API_URL}/api/cadg/usage-analysis/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        planId: usageAnalysisPreviewData.planId,
        title: usageAnalysis.title,
        timeRange: usageAnalysis.timeRange,
        metrics: usageAnalysis.metrics,
        featureAdoption: usageAnalysis.featureAdoption,
        userSegments: usageAnalysis.userSegments,
        recommendations: usageAnalysis.recommendations,
        chartTypes: usageAnalysis.chartTypes,
        notes: usageAnalysis.notes,
        customerId: usageAnalysisPreviewData.customer.id,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to save usage analysis');
    }

    const result = await response.json();

    // Success - close preview and update status
    setShowUsageAnalysisPreview(false);
    setUsageAnalysisPreviewData(null);
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
          title: 'Usage Metrics Data',
        }] : undefined,
      },
      metadata: {
        generationDurationMs: 0,
        sourcesUsed: [],
      },
    });
    onApproved?.(result.documentId);
  };

  // Handle canceling usage analysis preview
  const handleUsageAnalysisCancel = () => {
    setShowUsageAnalysisPreview(false);
    setUsageAnalysisPreviewData(null);
    setStatus('pending');
  };

  // Handle saving feature campaign from preview
  const handleFeatureCampaignSave = async (featureCampaign: FeatureCampaignData) => {
    if (!featureCampaignPreviewData) return;

    const response = await fetch(`${API_URL}/api/cadg/feature-campaign/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        planId: featureCampaignPreviewData.planId,
        title: featureCampaign.title,
        campaignGoal: featureCampaign.campaignGoal,
        targetFeatures: featureCampaign.targetFeatures,
        userSegments: featureCampaign.userSegments,
        timeline: featureCampaign.timeline,
        messaging: featureCampaign.messaging,
        successMetrics: featureCampaign.successMetrics,
        notes: featureCampaign.notes,
        customerId: featureCampaignPreviewData.customer.id,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to save feature campaign');
    }

    const result = await response.json();

    // Success - close preview and update status
    setShowFeatureCampaignPreview(false);
    setFeatureCampaignPreviewData(null);
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

  // Handle canceling feature campaign preview
  const handleFeatureCampaignCancel = () => {
    setShowFeatureCampaignPreview(false);
    setFeatureCampaignPreviewData(null);
    setStatus('pending');
  };

  // Handle saving champion development from preview
  const handleChampionDevelopmentSave = async (championDevelopment: ChampionDevelopmentData) => {
    if (!championDevelopmentPreviewData) return;

    const response = await fetch(`${API_URL}/api/cadg/champion-development/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        planId: championDevelopmentPreviewData.planId,
        title: championDevelopment.title,
        programGoal: championDevelopment.programGoal,
        candidates: championDevelopment.candidates,
        activities: championDevelopment.activities,
        rewards: championDevelopment.rewards,
        timeline: championDevelopment.timeline,
        successMetrics: championDevelopment.successMetrics,
        notes: championDevelopment.notes,
        customerId: championDevelopmentPreviewData.customer.id,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to save champion development program');
    }

    const result = await response.json();

    // Success - close preview and update status
    setShowChampionDevelopmentPreview(false);
    setChampionDevelopmentPreviewData(null);
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

  // Handle canceling champion development preview
  const handleChampionDevelopmentCancel = () => {
    setShowChampionDevelopmentPreview(false);
    setChampionDevelopmentPreviewData(null);
    setStatus('pending');
  };

  // Handle saving training program from preview
  const handleTrainingProgramSave = async (trainingProgram: TrainingProgramData) => {
    if (!trainingProgramPreviewData) return;

    const response = await fetch(`${API_URL}/api/cadg/training-program/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        planId: trainingProgramPreviewData.planId,
        title: trainingProgram.title,
        programGoal: trainingProgram.programGoal,
        modules: trainingProgram.modules,
        targetAudience: trainingProgram.targetAudience,
        timeline: trainingProgram.timeline,
        completionCriteria: trainingProgram.completionCriteria,
        successMetrics: trainingProgram.successMetrics,
        notes: trainingProgram.notes,
        customerId: trainingProgramPreviewData.customer.id,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to save training program');
    }

    const result = await response.json();

    // Success - close preview and update status
    setShowTrainingProgramPreview(false);
    setTrainingProgramPreviewData(null);
    setStatus('complete');
    setArtifact({
      success: true,
      artifactId: result.documentId,
      status: 'completed',
      preview: '',
      storage: {
        driveUrl: result.documentUrl,
        additionalFiles: result.sheetsId ? [{
          type: 'sheets',
          fileId: result.sheetsId,
          url: result.sheetsUrl,
          title: 'Progress Tracker',
        }] : undefined,
      },
      metadata: {
        generationDurationMs: 0,
        sourcesUsed: [],
      },
    });
    onApproved?.(result.documentId);
  };

  // Handle canceling training program preview
  const handleTrainingProgramCancel = () => {
    setShowTrainingProgramPreview(false);
    setTrainingProgramPreviewData(null);
    setStatus('pending');
  };

  // Handle saving renewal forecast from preview
  const handleRenewalForecastSave = async (renewalForecast: RenewalForecastData) => {
    if (!renewalForecastPreviewData) return;

    const response = await fetch(`${API_URL}/api/cadg/renewal-forecast/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        planId: renewalForecastPreviewData.planId,
        title: renewalForecast.title,
        renewalDate: renewalForecast.renewalDate,
        currentProbability: renewalForecast.currentProbability,
        targetProbability: renewalForecast.targetProbability,
        arr: renewalForecast.arr,
        contractTerm: renewalForecast.contractTerm,
        probabilityFactors: renewalForecast.probabilityFactors,
        riskFactors: renewalForecast.riskFactors,
        positiveSignals: renewalForecast.positiveSignals,
        recommendedActions: renewalForecast.recommendedActions,
        historicalContext: renewalForecast.historicalContext,
        notes: renewalForecast.notes,
        customerId: renewalForecastPreviewData.customer.id,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to save renewal forecast');
    }

    const result = await response.json();

    // Success - close preview and update status
    setShowRenewalForecastPreview(false);
    setRenewalForecastPreviewData(null);
    setStatus('complete');
    setArtifact({
      success: true,
      artifactId: result.sheetsId || 'renewal-forecast',
      status: 'completed',
      preview: '',
      storage: {
        driveUrl: result.sheetsUrl,
      },
      metadata: {
        generationDurationMs: 0,
        sourcesUsed: [],
      },
    });
    onApproved?.(result.sheetsId || 'renewal-forecast');
  };

  // Handle canceling renewal forecast preview
  const handleRenewalForecastCancel = () => {
    setShowRenewalForecastPreview(false);
    setRenewalForecastPreviewData(null);
    setStatus('pending');
  };

  // Handle saving value summary from preview
  const handleValueSummarySave = async (valueSummary: ValueSummaryData) => {
    if (!valueSummaryPreviewData) return;

    const response = await fetch(`${API_URL}/api/cadg/value-summary/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        planId: valueSummaryPreviewData.planId,
        title: valueSummary.title,
        executiveSummary: valueSummary.executiveSummary,
        valueMetrics: valueSummary.valueMetrics,
        successStories: valueSummary.successStories,
        testimonials: valueSummary.testimonials,
        roiCalculation: valueSummary.roiCalculation,
        keyHighlights: valueSummary.keyHighlights,
        nextSteps: valueSummary.nextSteps,
        notes: valueSummary.notes,
        customerId: valueSummaryPreviewData.customer.id,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to save value summary');
    }

    const result = await response.json();

    // Success - close preview and update status
    setShowValueSummaryPreview(false);
    setValueSummaryPreviewData(null);
    setStatus('complete');
    setArtifact({
      success: true,
      artifactId: result.fileId || 'value-summary',
      status: 'completed',
      preview: '',
      storage: {
        driveUrl: result.fileUrl,
      },
      metadata: {
        generationDurationMs: 0,
        sourcesUsed: [],
      },
    });
    onApproved?.(result.fileId || 'value-summary');
  };

  // Handle canceling value summary preview
  const handleValueSummaryCancel = () => {
    setShowValueSummaryPreview(false);
    setValueSummaryPreviewData(null);
    setStatus('pending');
  };

  // Handle saving expansion proposal from preview
  const handleExpansionProposalSave = async (expansionProposal: ExpansionProposalData) => {
    if (!expansionProposalPreviewData) return;

    const response = await fetch(`${API_URL}/api/cadg/expansion-proposal/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        planId: expansionProposalPreviewData.planId,
        title: expansionProposal.title,
        proposalDate: expansionProposal.proposalDate,
        validUntil: expansionProposal.validUntil,
        currentArrValue: expansionProposal.currentArrValue,
        proposedArrValue: expansionProposal.proposedArrValue,
        expansionAmount: expansionProposal.expansionAmount,
        expansionProducts: expansionProposal.expansionProducts,
        pricingOptions: expansionProposal.pricingOptions,
        businessCase: expansionProposal.businessCase,
        roiProjection: expansionProposal.roiProjection,
        usageGaps: expansionProposal.usageGaps,
        growthSignals: expansionProposal.growthSignals,
        nextSteps: expansionProposal.nextSteps,
        notes: expansionProposal.notes,
        customerId: expansionProposalPreviewData.customer.id,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to save expansion proposal');
    }

    const result = await response.json();

    // Success - close preview and update status
    setShowExpansionProposalPreview(false);
    setExpansionProposalPreviewData(null);
    setStatus('complete');
    setArtifact({
      success: true,
      artifactId: result.docId || 'expansion-proposal',
      status: 'completed',
      preview: '',
      storage: {
        driveUrl: result.docUrl,
      },
      metadata: {
        generationDurationMs: 0,
        sourcesUsed: [],
      },
    });
    onApproved?.(result.docId || 'expansion-proposal');
  };

  // Handle canceling expansion proposal preview
  const handleExpansionProposalCancel = () => {
    setShowExpansionProposalPreview(false);
    setExpansionProposalPreviewData(null);
    setStatus('pending');
  };

  // Handle saving negotiation brief from preview
  const handleNegotiationBriefSave = async (negotiationBrief: NegotiationBriefData) => {
    if (!negotiationBriefPreviewData) return;

    const response = await fetch(`${API_URL}/api/cadg/negotiation-brief/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        planId: negotiationBriefPreviewData.planId,
        title: negotiationBrief.title,
        negotiationDate: negotiationBrief.negotiationDate,
        contractValue: negotiationBrief.contractValue,
        contractTerm: negotiationBrief.contractTerm,
        renewalDate: negotiationBrief.renewalDate,
        currentTerms: negotiationBrief.currentTerms,
        leveragePoints: negotiationBrief.leveragePoints,
        counterStrategies: negotiationBrief.counterStrategies,
        walkAwayPoints: negotiationBrief.walkAwayPoints,
        competitorIntel: negotiationBrief.competitorIntel,
        valueDelivered: negotiationBrief.valueDelivered,
        internalNotes: negotiationBrief.internalNotes,
        customerId: negotiationBriefPreviewData.customer.id,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to save negotiation brief');
    }

    const result = await response.json();

    // Success - close preview and update status
    setShowNegotiationBriefPreview(false);
    setNegotiationBriefPreviewData(null);
    setStatus('complete');
    setArtifact({
      success: true,
      artifactId: result.docId || 'negotiation-brief',
      status: 'completed',
      preview: '',
      storage: {
        driveUrl: result.docUrl,
      },
      metadata: {
        generationDurationMs: 0,
        sourcesUsed: [],
      },
    });
    onApproved?.(result.docId || 'negotiation-brief');
  };

  // Handle canceling negotiation brief preview
  const handleNegotiationBriefCancel = () => {
    setShowNegotiationBriefPreview(false);
    setNegotiationBriefPreviewData(null);
    setStatus('pending');
  };

  // Handle saving risk assessment from preview
  const handleRiskAssessmentSave = async (riskAssessment: RiskAssessmentData) => {
    if (!riskAssessmentPreviewData) return;

    const response = await fetch(`${API_URL}/api/cadg/risk-assessment/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        planId: riskAssessmentPreviewData.planId,
        title: riskAssessment.title,
        assessmentDate: riskAssessment.assessmentDate,
        overallRiskScore: riskAssessment.overallRiskScore,
        riskLevel: riskAssessment.riskLevel,
        healthScore: riskAssessment.healthScore,
        daysUntilRenewal: riskAssessment.daysUntilRenewal,
        arr: riskAssessment.arr,
        riskFactors: riskAssessment.riskFactors,
        mitigationActions: riskAssessment.mitigationActions,
        executiveSummary: riskAssessment.executiveSummary,
        notes: riskAssessment.notes,
        customerId: riskAssessmentPreviewData.customer.id,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to save risk assessment');
    }

    const result = await response.json();

    // Success - close preview and update status
    setShowRiskAssessmentPreview(false);
    setRiskAssessmentPreviewData(null);
    setStatus('complete');
    setArtifact({
      success: true,
      artifactId: result.docId || 'risk-assessment',
      status: 'completed',
      preview: '',
      storage: {
        driveUrl: result.docUrl,
        additionalFiles: result.sheetsId ? [{
          type: 'spreadsheet',
          fileId: result.sheetsId,
          url: result.sheetsUrl,
          title: 'Risk Assessment Tracker',
        }] : undefined,
      },
      metadata: {
        generationDurationMs: 0,
        sourcesUsed: [],
      },
    });
    onApproved?.(result.docId || 'risk-assessment');
  };

  // Handle canceling risk assessment preview
  const handleRiskAssessmentCancel = () => {
    setShowRiskAssessmentPreview(false);
    setRiskAssessmentPreviewData(null);
    setStatus('pending');
  };

  // Handle saving save play from preview
  const handleSavePlaySave = async (savePlay: SavePlayData) => {
    if (!savePlayPreviewData) return;

    const response = await fetch(`${API_URL}/api/cadg/save-play/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        planId: savePlayPreviewData.planId,
        title: savePlay.title,
        createdDate: savePlay.createdDate,
        riskLevel: savePlay.riskLevel,
        situation: savePlay.situation,
        healthScore: savePlay.healthScore,
        daysUntilRenewal: savePlay.daysUntilRenewal,
        arr: savePlay.arr,
        rootCauses: savePlay.rootCauses,
        actionItems: savePlay.actionItems,
        successMetrics: savePlay.successMetrics,
        timeline: savePlay.timeline,
        notes: savePlay.notes,
        customerId: savePlayPreviewData.customer.id,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to save save play');
    }

    const result = await response.json();

    // Success - close preview and update status
    setShowSavePlayPreview(false);
    setSavePlayPreviewData(null);
    setStatus('complete');
    setArtifact({
      success: true,
      artifactId: result.docId || 'save-play',
      status: 'completed',
      preview: '',
      storage: {
        driveUrl: result.docUrl,
        additionalFiles: result.sheetsId ? [{
          type: 'spreadsheet',
          fileId: result.sheetsId,
          url: result.sheetsUrl,
          title: 'Save Play Tracker',
        }] : undefined,
      },
      metadata: {
        generationDurationMs: 0,
        sourcesUsed: [],
      },
    });
    onApproved?.(result.docId || 'save-play');
  };

  // Handle canceling save play preview
  const handleSavePlayCancel = () => {
    setShowSavePlayPreview(false);
    setSavePlayPreviewData(null);
    setStatus('pending');
  };

  // Handle saving escalation report from preview
  const handleEscalationReportSave = async (escalationReport: EscalationReportData) => {
    if (!escalationReportPreviewData) return;

    const response = await fetch(`${API_URL}/api/cadg/escalation-report/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        planId: escalationReportPreviewData.planId,
        title: escalationReport.title,
        createdDate: escalationReport.createdDate,
        escalationLevel: escalationReport.escalationLevel,
        issueSummary: escalationReport.issueSummary,
        customerName: escalationReport.customerName,
        arr: escalationReport.arr,
        healthScore: escalationReport.healthScore,
        daysUntilRenewal: escalationReport.daysUntilRenewal,
        primaryContact: escalationReport.primaryContact,
        escalationOwner: escalationReport.escalationOwner,
        timeline: escalationReport.timeline,
        impactMetrics: escalationReport.impactMetrics,
        resolutionRequests: escalationReport.resolutionRequests,
        supportingEvidence: escalationReport.supportingEvidence,
        recommendedActions: escalationReport.recommendedActions,
        notes: escalationReport.notes,
        customerId: escalationReportPreviewData.customer.id,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to save escalation report');
    }

    const result = await response.json();

    // Success - close preview and update status
    setShowEscalationReportPreview(false);
    setEscalationReportPreviewData(null);
    setStatus('complete');
    setArtifact({
      success: true,
      artifactId: result.docId || 'escalation-report',
      status: 'completed',
      preview: '',
      storage: {
        driveUrl: result.docUrl,
      },
      metadata: {
        generationDurationMs: 0,
        sourcesUsed: [],
      },
    });
    onApproved?.(result.docId || 'escalation-report');
  };

  // Handle canceling escalation report preview
  const handleEscalationReportCancel = () => {
    setShowEscalationReportPreview(false);
    setEscalationReportPreviewData(null);
    setStatus('pending');
  };

  // Handle saving resolution plan from preview
  const handleResolutionPlanSave = async (resolutionPlan: ResolutionPlanData) => {
    if (!resolutionPlanPreviewData) return;

    const response = await fetch(`${API_URL}/api/cadg/resolution-plan/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        planId: resolutionPlanPreviewData.planId,
        title: resolutionPlan.title,
        createdDate: resolutionPlan.createdDate,
        targetResolutionDate: resolutionPlan.targetResolutionDate,
        overallStatus: resolutionPlan.overallStatus,
        summary: resolutionPlan.summary,
        healthScore: resolutionPlan.healthScore,
        daysUntilRenewal: resolutionPlan.daysUntilRenewal,
        arr: resolutionPlan.arr,
        issues: resolutionPlan.issues,
        actionItems: resolutionPlan.actionItems,
        dependencies: resolutionPlan.dependencies,
        timeline: resolutionPlan.timeline,
        notes: resolutionPlan.notes,
        customerId: resolutionPlanPreviewData.customer.id,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to save resolution plan');
    }

    const result = await response.json();

    // Success - close preview and update status
    setShowResolutionPlanPreview(false);
    setResolutionPlanPreviewData(null);
    setStatus('complete');
    setArtifact({
      success: true,
      artifactId: result.docId || 'resolution-plan',
      status: 'completed',
      preview: '',
      storage: {
        driveUrl: result.docUrl,
        additionalFiles: result.sheetId ? [{
          type: 'spreadsheet',
          fileId: result.sheetId,
          url: result.sheetUrl,
          title: 'Resolution Plan Tracker',
        }] : undefined,
      },
      metadata: {
        generationDurationMs: 0,
        sourcesUsed: [],
      },
    });
    onApproved?.(result.docId || 'resolution-plan');
  };

  // Handle canceling resolution plan preview
  const handleResolutionPlanCancel = () => {
    setShowResolutionPlanPreview(false);
    setResolutionPlanPreviewData(null);
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

  // Stakeholder map preview for HITL workflow
  if (showStakeholderMapPreview && stakeholderMapPreviewData) {
    return (
      <CADGStakeholderMapPreview
        stakeholderMap={stakeholderMapPreviewData.stakeholderMap}
        customer={stakeholderMapPreviewData.customer}
        onSave={handleStakeholderMapSave}
        onCancel={handleStakeholderMapCancel}
      />
    );
  }

  // Training schedule preview for HITL workflow
  if (showTrainingSchedulePreview && trainingSchedulePreviewData) {
    return (
      <CADGTrainingSchedulePreview
        trainingSchedule={trainingSchedulePreviewData.trainingSchedule}
        customer={trainingSchedulePreviewData.customer}
        onSave={handleTrainingScheduleSave}
        onCancel={handleTrainingScheduleCancel}
      />
    );
  }

  // Usage analysis preview for HITL workflow
  if (showUsageAnalysisPreview && usageAnalysisPreviewData) {
    return (
      <CADGUsageAnalysisPreview
        usageAnalysis={usageAnalysisPreviewData.usageAnalysis}
        customer={usageAnalysisPreviewData.customer}
        onSave={handleUsageAnalysisSave}
        onCancel={handleUsageAnalysisCancel}
      />
    );
  }

  // Feature campaign preview for HITL workflow
  if (showFeatureCampaignPreview && featureCampaignPreviewData) {
    return (
      <CADGFeatureCampaignPreview
        featureCampaign={featureCampaignPreviewData.featureCampaign}
        customer={featureCampaignPreviewData.customer}
        onSave={handleFeatureCampaignSave}
        onCancel={handleFeatureCampaignCancel}
      />
    );
  }

  // Champion development preview for HITL workflow
  if (showChampionDevelopmentPreview && championDevelopmentPreviewData) {
    return (
      <CADGChampionDevelopmentPreview
        championDevelopment={championDevelopmentPreviewData.championDevelopment}
        customer={championDevelopmentPreviewData.customer}
        onSave={handleChampionDevelopmentSave}
        onCancel={handleChampionDevelopmentCancel}
      />
    );
  }

  // Training program preview for HITL workflow
  if (showTrainingProgramPreview && trainingProgramPreviewData) {
    return (
      <CADGTrainingProgramPreview
        trainingProgram={trainingProgramPreviewData.trainingProgram}
        customer={trainingProgramPreviewData.customer}
        onSave={handleTrainingProgramSave}
        onCancel={handleTrainingProgramCancel}
      />
    );
  }

  // Renewal forecast preview for HITL workflow
  if (showRenewalForecastPreview && renewalForecastPreviewData) {
    return (
      <CADGRenewalForecastPreview
        renewalForecast={renewalForecastPreviewData.renewalForecast}
        customer={renewalForecastPreviewData.customer}
        onSave={handleRenewalForecastSave}
        onCancel={handleRenewalForecastCancel}
      />
    );
  }

  // Value summary preview for HITL workflow
  if (showValueSummaryPreview && valueSummaryPreviewData) {
    return (
      <CADGValueSummaryPreview
        valueSummary={valueSummaryPreviewData.valueSummary}
        customer={valueSummaryPreviewData.customer}
        onSave={handleValueSummarySave}
        onCancel={handleValueSummaryCancel}
      />
    );
  }

  // Expansion proposal preview mode
  if (showExpansionProposalPreview && expansionProposalPreviewData) {
    return (
      <CADGExpansionProposalPreview
        expansionProposal={expansionProposalPreviewData.expansionProposal}
        customer={expansionProposalPreviewData.customer}
        onSave={handleExpansionProposalSave}
        onCancel={handleExpansionProposalCancel}
      />
    );
  }

  // Negotiation brief preview mode
  if (showNegotiationBriefPreview && negotiationBriefPreviewData) {
    return (
      <CADGNegotiationBriefPreview
        negotiationBrief={negotiationBriefPreviewData.negotiationBrief}
        customer={negotiationBriefPreviewData.customer}
        onSave={handleNegotiationBriefSave}
        onCancel={handleNegotiationBriefCancel}
      />
    );
  }

  // Risk assessment preview mode
  if (showRiskAssessmentPreview && riskAssessmentPreviewData) {
    return (
      <CADGRiskAssessmentPreview
        riskAssessment={riskAssessmentPreviewData.riskAssessment}
        customer={riskAssessmentPreviewData.customer}
        onSave={handleRiskAssessmentSave}
        onCancel={handleRiskAssessmentCancel}
      />
    );
  }

  // Save play preview mode
  if (showSavePlayPreview && savePlayPreviewData) {
    return (
      <CADGSavePlayPreview
        savePlay={savePlayPreviewData.savePlay}
        customer={savePlayPreviewData.customer}
        onSave={handleSavePlaySave}
        onCancel={handleSavePlayCancel}
      />
    );
  }

  // Escalation report preview mode
  if (showEscalationReportPreview && escalationReportPreviewData) {
    return (
      <CADGEscalationReportPreview
        escalationReport={escalationReportPreviewData.escalationReport}
        customer={escalationReportPreviewData.customer}
        onSave={handleEscalationReportSave}
        onCancel={handleEscalationReportCancel}
      />
    );
  }

  // Resolution plan preview mode
  if (showResolutionPlanPreview && resolutionPlanPreviewData) {
    return (
      <CADGResolutionPlanPreview
        resolutionPlan={resolutionPlanPreviewData.resolutionPlan}
        customer={resolutionPlanPreviewData.customer}
        onSave={handleResolutionPlanSave}
        onCancel={handleResolutionPlanCancel}
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
