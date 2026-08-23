import { Router } from 'express';
import { subjectController } from './subject.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireRoles } from '../../middleware/rbac.middleware.js';
import { validateBody, validateQuery } from '../../middleware/validation.middleware.js';
import { CreateSubjectSchema, UpdateSubjectSchema, PaginationQuerySchema } from '@schedulai/validation';

const router = Router();

router.use(authenticate);

router.get('/', validateQuery(PaginationQuerySchema), subjectController.getAll);
router.get('/:id', subjectController.getById);
router.post('/', requireRoles('ADMIN', 'STAFF'), validateBody(CreateSubjectSchema), subjectController.create);
router.put('/:id', requireRoles('ADMIN', 'STAFF'), validateBody(UpdateSubjectSchema), subjectController.update);
router.delete('/:id', requireRoles('ADMIN'), subjectController.delete);

export const subjectRouter = router;
