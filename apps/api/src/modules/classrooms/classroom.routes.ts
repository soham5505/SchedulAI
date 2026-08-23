import { Router } from 'express';
import { classroomController } from './classroom.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireRoles } from '../../middleware/rbac.middleware.js';
import { validateBody, validateQuery } from '../../middleware/validation.middleware.js';
import { CreateClassroomSchema, UpdateClassroomSchema, PaginationQuerySchema } from '@schedulai/validation';

const router = Router();

router.use(authenticate);

router.get('/', validateQuery(PaginationQuerySchema), classroomController.getAll);
router.get('/:id', classroomController.getById);
router.post('/', requireRoles('ADMIN', 'STAFF'), validateBody(CreateClassroomSchema), classroomController.create);
router.put('/:id', requireRoles('ADMIN', 'STAFF'), validateBody(UpdateClassroomSchema), classroomController.update);
router.delete('/:id', requireRoles('ADMIN'), classroomController.delete);

export const classroomRouter = router;
