import { Router } from 'express';
import { timeSlotController } from './timeslot.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireRoles } from '../../middleware/rbac.middleware.js';
import { validateBody, validateQuery } from '../../middleware/validation.middleware.js';
import { CreateTimeSlotSchema, UpdateTimeSlotSchema, PaginationQuerySchema } from '@schedulai/validation';

const router = Router();

router.use(authenticate);

router.get('/', validateQuery(PaginationQuerySchema), timeSlotController.getAll);
router.get('/:id', timeSlotController.getById);
router.post('/', requireRoles('ADMIN', 'STAFF'), validateBody(CreateTimeSlotSchema), timeSlotController.create);
router.post('/bulk-standard', requireRoles('ADMIN', 'STAFF'), timeSlotController.bulkStandard);
router.put('/:id', requireRoles('ADMIN', 'STAFF'), validateBody(UpdateTimeSlotSchema), timeSlotController.update);
router.delete('/:id', requireRoles('ADMIN'), timeSlotController.delete);

export const timeslotRouter = router;
