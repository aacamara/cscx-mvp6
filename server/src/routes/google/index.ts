/**
 * Google Routes Index
 * Combines all Google Workspace API routes
 */

import { Router } from 'express';
import authRoutes from './auth.js';
import gmailRoutes from './gmail.js';
import calendarRoutes from './calendar.js';
import driveRoutes from './drive.js';
import meetingsRoutes from './meetings.js';
import tasksRoutes from './tasks.js';

const router = Router();

// Auth routes
router.use('/auth', authRoutes);

// Gmail routes
router.use('/gmail', gmailRoutes);

// Calendar routes
router.use('/calendar', calendarRoutes);

// Drive routes
router.use('/drive', driveRoutes);

// Meeting Agent routes (AI-powered meeting preparation)
router.use('/meetings', meetingsRoutes);

// Tasks routes
router.use('/tasks', tasksRoutes);

// Future routes:
// router.use('/docs', docsRoutes);
// router.use('/sheets', sheetsRoutes);
// router.use('/slides', slidesRoutes);
// router.use('/contacts', contactsRoutes);

export default router;
