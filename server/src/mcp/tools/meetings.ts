/**
 * Meeting MCP Tools
 * Wraps Zoom and Meeting Intelligence services as MCP tools
 */

import { z } from 'zod';
import type { MCPTool, MCPContext, MCPResult } from '../index.js';
import { zoomService } from '../../services/zoom/index.js';
import { zoomOAuthService } from '../../services/zoom/oauth.js';
import { meetingIntelligenceService } from '../../services/meeting-intelligence/index.js';
import { parseTranscript, parseVTT } from '../../services/meeting-intelligence/processors.js';

// ============================================
// Zoom Meeting Tools
// ============================================

export const listZoomMeetings: MCPTool = {
  name: 'zoom_list_meetings',
  description: 'List Zoom meetings for the current user',
  category: 'meetings',
  provider: 'zoom',
  inputSchema: z.object({
    type: z.enum(['scheduled', 'live', 'upcoming', 'upcoming_meetings', 'previous_meetings'])
      .optional()
      .describe('Type of meetings to list'),
    pageSize: z.number().optional().describe('Number of meetings to return'),
  }),
  requiresApproval: false,
  execute: async (params, context: MCPContext): Promise<MCPResult> => {
    try {
      const { type = 'upcoming', pageSize = 30 } = params;

      // Check connection
      const connected = await zoomOAuthService.isConnected(context.userId);
      if (!connected) {
        return {
          success: false,
          error: 'Zoom not connected',
          errorCode: 'NOT_CONNECTED',
        };
      }

      await zoomOAuthService.loadConnection(context.userId);
      const result = await zoomService.listMeetings(context.userId, type, pageSize);

      return {
        success: true,
        data: result.meetings,
        metadata: {
          totalRecords: result.total_records,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        errorCode: 'ZOOM_ERROR',
      };
    }
  },
};

export const getZoomMeeting: MCPTool = {
  name: 'zoom_get_meeting',
  description: 'Get details of a specific Zoom meeting',
  category: 'meetings',
  provider: 'zoom',
  inputSchema: z.object({
    meetingId: z.string().describe('Zoom meeting ID'),
  }),
  requiresApproval: false,
  execute: async (params, context: MCPContext): Promise<MCPResult> => {
    try {
      const { meetingId } = params;

      await zoomOAuthService.loadConnection(context.userId);
      const meeting = await zoomService.getMeeting(context.userId, meetingId);

      return {
        success: true,
        data: meeting,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        errorCode: 'ZOOM_ERROR',
      };
    }
  },
};

export const createZoomMeeting: MCPTool = {
  name: 'zoom_create_meeting',
  description: 'Create a new Zoom meeting',
  category: 'meetings',
  provider: 'zoom',
  inputSchema: z.object({
    topic: z.string().describe('Meeting topic/title'),
    startTime: z.string().optional().describe('Start time in ISO 8601 format'),
    duration: z.number().optional().describe('Duration in minutes'),
    agenda: z.string().optional().describe('Meeting agenda'),
    autoRecording: z.enum(['local', 'cloud', 'none']).optional()
      .describe('Auto recording setting'),
    waitingRoom: z.boolean().optional().describe('Enable waiting room'),
  }),
  requiresApproval: true,
  execute: async (params, context: MCPContext): Promise<MCPResult> => {
    try {
      await zoomOAuthService.loadConnection(context.userId);

      const meeting = await zoomService.createMeeting(context.userId, {
        topic: params.topic,
        start_time: params.startTime,
        duration: params.duration,
        agenda: params.agenda,
        settings: {
          auto_recording: params.autoRecording || 'cloud',
          waiting_room: params.waitingRoom ?? true,
        },
      });

      return {
        success: true,
        data: {
          meetingId: meeting.id,
          joinUrl: meeting.join_url,
          topic: meeting.topic,
          startTime: meeting.start_time,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        errorCode: 'ZOOM_ERROR',
      };
    }
  },
};

export const getZoomRecording: MCPTool = {
  name: 'zoom_get_recording',
  description: 'Get recording details for a Zoom meeting',
  category: 'meetings',
  provider: 'zoom',
  inputSchema: z.object({
    meetingId: z.string().describe('Zoom meeting ID'),
  }),
  requiresApproval: false,
  execute: async (params, context: MCPContext): Promise<MCPResult> => {
    try {
      await zoomOAuthService.loadConnection(context.userId);
      const recording = await zoomService.getRecording(context.userId, params.meetingId);

      return {
        success: true,
        data: recording,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        errorCode: 'ZOOM_ERROR',
      };
    }
  },
};

export const getZoomTranscript: MCPTool = {
  name: 'zoom_get_transcript',
  description: 'Get transcript for a Zoom recording',
  category: 'meetings',
  provider: 'zoom',
  inputSchema: z.object({
    meetingId: z.string().describe('Zoom meeting ID'),
    recordingId: z.string().describe('Recording ID'),
  }),
  requiresApproval: false,
  execute: async (params, context: MCPContext): Promise<MCPResult> => {
    try {
      await zoomOAuthService.loadConnection(context.userId);
      const transcript = await zoomService.getTranscript(
        context.userId,
        params.meetingId,
        params.recordingId
      );

      return {
        success: true,
        data: transcript,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        errorCode: 'ZOOM_ERROR',
      };
    }
  },
};

// ============================================
// Meeting Intelligence Tools
// ============================================

export const analyzeMeetingTranscript: MCPTool = {
  name: 'analyze_meeting_transcript',
  description: 'Analyze a meeting transcript for CS insights using AI',
  category: 'meetings',
  provider: 'cscx',
  inputSchema: z.object({
    transcript: z.string().describe('Meeting transcript text'),
    title: z.string().describe('Meeting title'),
    format: z.enum(['vtt', 'srt', 'otter', 'teams', 'plain']).optional()
      .describe('Transcript format'),
    customerId: z.string().optional().describe('Customer ID to associate'),
    customerName: z.string().optional().describe('Customer name for context'),
  }),
  requiresApproval: false,
  execute: async (params, context: MCPContext): Promise<MCPResult> => {
    try {
      const meetingId = `meeting_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Parse transcript
      const parsedTranscript = parseTranscript(
        params.transcript,
        meetingId,
        params.title,
        params.format
      );

      // Analyze
      const analysis = await meetingIntelligenceService.analyzeMeeting(
        parsedTranscript,
        {
          customerId: params.customerId || context.customerId,
          customerName: params.customerName || context.customerName,
        }
      );

      return {
        success: true,
        data: analysis,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        errorCode: 'ANALYSIS_ERROR',
      };
    }
  },
};

export const analyzeZoomRecording: MCPTool = {
  name: 'analyze_zoom_recording',
  description: 'Fetch and analyze a Zoom recording transcript',
  category: 'meetings',
  provider: 'zoom',
  inputSchema: z.object({
    meetingId: z.string().describe('Zoom meeting ID'),
    customerId: z.string().optional().describe('Customer ID to associate'),
    customerName: z.string().optional().describe('Customer name for context'),
  }),
  requiresApproval: false,
  execute: async (params, context: MCPContext): Promise<MCPResult> => {
    try {
      await zoomOAuthService.loadConnection(context.userId);

      // Get meeting details
      const meeting = await zoomService.getMeeting(context.userId, params.meetingId);

      // Get recording
      const recording = await zoomService.getRecording(context.userId, params.meetingId);

      // Find transcript
      const transcriptFile = recording.recording_files?.find(
        (f: any) => f.recording_type === 'audio_transcript'
      );

      if (!transcriptFile) {
        return {
          success: false,
          error: 'No transcript available for this recording',
          errorCode: 'NO_TRANSCRIPT',
        };
      }

      // Get transcript content
      const transcript = await zoomService.getTranscript(
        context.userId,
        params.meetingId,
        transcriptFile.id
      );

      // Parse VTT transcript
      const parsedTranscript = parseVTT(
        transcript.vtt_content || '',
        params.meetingId,
        meeting.topic
      );

      // Analyze
      const analysis = await meetingIntelligenceService.analyzeMeeting(
        parsedTranscript,
        {
          customerId: params.customerId || context.customerId,
          customerName: params.customerName || context.customerName,
        }
      );

      return {
        success: true,
        data: analysis,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        errorCode: 'ANALYSIS_ERROR',
      };
    }
  },
};

export const getMeetingAnalysis: MCPTool = {
  name: 'get_meeting_analysis',
  description: 'Get existing meeting analysis by meeting ID',
  category: 'meetings',
  provider: 'cscx',
  inputSchema: z.object({
    meetingId: z.string().describe('Meeting ID'),
  }),
  requiresApproval: false,
  execute: async (params): Promise<MCPResult> => {
    try {
      const analysis = await meetingIntelligenceService.getAnalysis(params.meetingId);

      if (!analysis) {
        return {
          success: false,
          error: 'Analysis not found',
          errorCode: 'NOT_FOUND',
        };
      }

      return {
        success: true,
        data: analysis,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        errorCode: 'FETCH_ERROR',
      };
    }
  },
};

export const listCustomerMeetingAnalyses: MCPTool = {
  name: 'list_customer_meeting_analyses',
  description: 'List meeting analyses for a customer',
  category: 'meetings',
  provider: 'cscx',
  inputSchema: z.object({
    customerId: z.string().describe('Customer ID'),
    limit: z.number().optional().describe('Max results to return'),
    offset: z.number().optional().describe('Pagination offset'),
  }),
  requiresApproval: false,
  execute: async (params): Promise<MCPResult> => {
    try {
      const analyses = await meetingIntelligenceService.listAnalysesForCustomer(
        params.customerId,
        { limit: params.limit, offset: params.offset }
      );

      return {
        success: true,
        data: analyses,
        metadata: {
          count: analyses.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        errorCode: 'FETCH_ERROR',
      };
    }
  },
};

export const getCustomerRiskSummary: MCPTool = {
  name: 'get_customer_meeting_risk_summary',
  description: 'Get risk summary from customer meetings',
  category: 'meetings',
  provider: 'cscx',
  inputSchema: z.object({
    customerId: z.string().describe('Customer ID'),
  }),
  requiresApproval: false,
  execute: async (params): Promise<MCPResult> => {
    try {
      const summary = await meetingIntelligenceService.getRiskSummary(params.customerId);

      return {
        success: true,
        data: summary,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        errorCode: 'FETCH_ERROR',
      };
    }
  },
};

// ============================================
// Export All Meeting Tools
// ============================================

export const meetingTools: MCPTool[] = [
  listZoomMeetings,
  getZoomMeeting,
  createZoomMeeting,
  getZoomRecording,
  getZoomTranscript,
  analyzeMeetingTranscript,
  analyzeZoomRecording,
  getMeetingAnalysis,
  listCustomerMeetingAnalyses,
  getCustomerRiskSummary,
];
