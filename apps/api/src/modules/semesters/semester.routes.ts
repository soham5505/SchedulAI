import { Router } from 'express';
import { semesterController } from './semester.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireRoles } from '../../middleware/rbac.middleware.js';
import { validateBody, validateQuery } from '../../middleware/validation.middleware.js';
import { CreateSemesterSchema, UpdateSemesterSchema, PaginationQuerySchema } from '@schedulai/validation';

const router = Router();

router.use(authenticate);

router.get('/', validateQuery(PaginationQuerySchema), semesterController.getAll);
router.get('/:id', semesterController.getById);
router.post('/', requireRoles('ADMIN', 'STAFF'), validateBody(CreateSemesterSchema), semesterController.create);
router.put('/:id', requireRoles('ADMIN', 'STAFF'), validateBody(UpdateSemesterSchema), semesterController.update);
router.delete('/:id', requireRoles('ADMIN'), semesterController.delete);

export const semesterRouter = router;
