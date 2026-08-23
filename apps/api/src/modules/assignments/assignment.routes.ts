import { Router } from 'express';
import { assignmentController } from './assignment.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireRoles } from '../../middleware/rbac.middleware.js';
import { validateBody, validateQuery } from '../../middleware/validation.middleware.js';
import { CreateTeachingAssignmentSchema, UpdateTeachingAssignmentSchema, PaginationQuerySchema } from '@schedulai/validation';

const router = Router();

router.use(authenticate);

router.get('/', validateQuery(PaginationQuerySchema), assignmentController.getAll);
router.get('/:id', assignmentController.getById);
router.post('/', requireRoles('ADMIN', 'STAFF'), validateBody(CreateTeachingAssignmentSchema), assignmentController.create);
router.put('/:id', requireRoles('ADMIN', 'STAFF'), validateBody(UpdateTeachingAssignmentSchema), assignmentController.update);
router.delete('/:id', requireRoles('ADMIN'), assignmentController.delete);

export const assignmentRouter = router;
