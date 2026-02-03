/**
 * Outlook Routes Index
 * Combines all Microsoft Outlook/Graph API routes
 * PRD-189: Outlook Calendar Integration
 */

import { Router } from 'express';
import authRoutes from './auth.js';
import calendarRoutes from './calendar.js';

const router = Router();

// Auth routes
router.use('/auth', authRoutes);

// Calendar routes
router.use('/calendar', calendarRoutes);

// Future routes:
// router.use('/mail', mailRoutes);
// router.use('/teams', teamsRoutes);

export default router;
