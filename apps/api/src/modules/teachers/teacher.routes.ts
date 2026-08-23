import { Router } from 'express';
import { teacherController } from './teacher.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireRoles } from '../../middleware/rbac.middleware.js';
import { validateBody, validateQuery } from '../../middleware/validation.middleware.js';
import { CreateTeacherSchema, UpdateTeacherSchema, PaginationQuerySchema } from '@schedulai/validation';

const router = Router();

router.use(authenticate);

router.get('/', validateQuery(PaginationQuerySchema), teacherController.getAll);
router.get('/:id', teacherController.getById);
router.post('/', requireRoles('ADMIN', 'STAFF'), validateBody(CreateTeacherSchema), teacherController.create);
router.put('/:id', requireRoles('ADMIN', 'STAFF', 'TEACHER'), validateBody(UpdateTeacherSchema), teacherController.update);
router.delete('/:id', requireRoles('ADMIN'), teacherController.delete);

export const teacherRouter = router;
