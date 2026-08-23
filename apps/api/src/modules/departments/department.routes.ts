import { Router } from 'express';
import { departmentController } from './department.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireRoles } from '../../middleware/rbac.middleware.js';
import { validateBody, validateQuery } from '../../middleware/validation.middleware.js';
import { CreateDepartmentSchema, UpdateDepartmentSchema, PaginationQuerySchema } from '@schedulai/validation';

const router = Router();

router.use(authenticate);

router.get('/', validateQuery(PaginationQuerySchema), departmentController.getAll);
router.get('/:id', departmentController.getById);
router.post('/', requireRoles('ADMIN', 'STAFF'), validateBody(CreateDepartmentSchema), departmentController.create);
router.put('/:id', requireRoles('ADMIN', 'STAFF'), validateBody(UpdateDepartmentSchema), departmentController.update);
router.delete('/:id', requireRoles('ADMIN'), departmentController.delete);

export const departmentRouter = router;
