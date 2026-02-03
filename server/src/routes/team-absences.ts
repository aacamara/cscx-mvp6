/**
 * PRD-258: Coverage Backup System - Team Absences Routes
 * API endpoints for team-wide absence calendar view
 */

import { Router, Request, Response } from 'express';
import { coverageBackupService } from '../services/collaboration/index.js';

const router = Router();

/**
 * GET /api/team/absences
 * Get all absences for a team in a date range
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const teamId = req.query.teamId as string || req.headers['x-team-id'] as string;
    const startDateStr = req.query.startDate as string;
    const endDateStr = req.query.endDate as string;

    if (!teamId) {
      return res.status(400).json({
        success: false,
        error: 'teamId is required',
      });
    }

    // Default to current month if dates not provided
    const now = new Date();
    const startDate = startDateStr
      ? new Date(startDateStr)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = endDateStr
      ? new Date(endDateStr)
      : new Date(now.getFullYear(), now.getMonth() + 1, 0);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format',
      });
    }

    const calendar = await coverageBackupService.getTeamAbsenceCalendar(
      teamId,
      startDate,
      endDate
    );

    res.json({
      success: true,
      calendar,
    });
  } catch (error) {
    console.error('[Team Absences Routes] Get calendar error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get team absence calendar',
    });
  }
});

/**
 * GET /api/team/coverage-calendar
 * Get coverage calendar view with both absences and assigned backups
 */
router.get('/coverage-calendar', async (req: Request, res: Response) => {
  try {
    const teamId = req.query.teamId as string || req.headers['x-team-id'] as string;
    const startDateStr = req.query.startDate as string;
    const endDateStr = req.query.endDate as string;

    if (!teamId) {
      return res.status(400).json({
        success: false,
        error: 'teamId is required',
      });
    }

    // Default to next 30 days
    const now = new Date();
    const startDate = startDateStr
      ? new Date(startDateStr)
      : now;
    const endDate = endDateStr
      ? new Date(endDateStr)
      : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format',
      });
    }

    const calendar = await coverageBackupService.getTeamAbsenceCalendar(
      teamId,
      startDate,
      endDate
    );

    // Format for calendar view
    const calendarEvents = calendar.absences.map(absence => ({
      id: absence.absenceId,
      title: `${absence.userName} - ${formatAbsenceType(absence.absenceType)}`,
      start: absence.startDate,
      end: absence.endDate,
      userId: absence.userId,
      userName: absence.userName,
      absenceType: absence.absenceType,
      status: absence.status,
      hasCoverage: absence.coverageAssigned,
      backupName: absence.backupName,
      color: getAbsenceColor(absence.absenceType, absence.coverageAssigned),
    }));

    res.json({
      success: true,
      startDate,
      endDate,
      events: calendarEvents,
      summary: {
        totalAbsences: calendar.absences.length,
        withCoverage: calendar.absences.filter(a => a.coverageAssigned).length,
        needsCoverage: calendar.absences.filter(a => !a.coverageAssigned && a.status === 'planned').length,
      },
    });
  } catch (error) {
    console.error('[Team Absences Routes] Get coverage calendar error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get coverage calendar',
    });
  }
});

// Helper functions
function formatAbsenceType(type: string): string {
  const typeMap: Record<string, string> = {
    vacation: 'Vacation',
    sick: 'Sick Leave',
    conference: 'Conference',
    parental: 'Parental Leave',
    other: 'Other',
  };
  return typeMap[type] || type;
}

function getAbsenceColor(type: string, hasCoverage: boolean): string {
  if (!hasCoverage) return '#ef4444'; // Red - needs coverage

  const colorMap: Record<string, string> = {
    vacation: '#3b82f6', // Blue
    sick: '#f59e0b', // Amber
    conference: '#8b5cf6', // Purple
    parental: '#10b981', // Green
    other: '#6b7280', // Gray
  };
  return colorMap[type] || '#6b7280';
}

export default router;
