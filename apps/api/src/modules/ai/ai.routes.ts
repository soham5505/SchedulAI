import { Router } from 'express';
import { aiController } from './ai.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { validateBody } from '../../middleware/validation.middleware.js';
import { AIPreferenceParseSchema, AIConflictExplainSchema, AITimetableSummarySchema } from '@schedulai/validation';

const router = Router();

router.use(authenticate);

router.post('/preferences', validateBody(AIPreferenceParseSchema), aiController.extractPreferences);
router.post('/explain-conflict', validateBody(AIConflictExplainSchema), aiController.explainConflict);
router.post('/summarize-timetable', validateBody(AITimetableSummarySchema), aiController.summarizeTimetable);

export const aiRouter = router;
