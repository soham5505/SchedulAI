import { Router } from 'express';
import { timetableController } from './timetable.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireRoles } from '../../middleware/rbac.middleware.js';
import { validateBody } from '../../middleware/validation.middleware.js';
import { TimetableMoveSchema, TimetableEntryUpdateSchema } from '@schedulai/validation';

const router = Router();

router.use(authenticate);

router.get('/', timetableController.getEntries);
router.post('/move', requireRoles('ADMIN', 'STAFF'), validateBody(TimetableMoveSchema), timetableController.moveEntry);
router.get('/validate/:generationId', timetableController.validateGeneration);
router.put('/entries/:id', requireRoles('ADMIN', 'STAFF'), validateBody(TimetableEntryUpdateSchema), timetableController.updateEntry);
router.delete('/entries/:id', requireRoles('ADMIN'), timetableController.deleteEntry);

export const timetableRouter = router;
