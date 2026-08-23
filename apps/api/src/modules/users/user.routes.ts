import { Router } from 'express';
import { userController } from './user.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireRoles } from '../../middleware/rbac.middleware.js';
import { validateBody, validateQuery } from '../../middleware/validation.middleware.js';
import { UpdateUserSchema, PaginationQuerySchema } from '@schedulai/validation';

const router = Router();

router.use(authenticate);

router.get('/', requireRoles('ADMIN'), validateQuery(PaginationQuerySchema), userController.getAll);
router.get('/:id', requireRoles('ADMIN', 'STAFF', 'TEACHER'), userController.getById);
router.post('/', requireRoles('ADMIN'), userController.create);
router.put('/:id', requireRoles('ADMIN'), validateBody(UpdateUserSchema), userController.update);
router.delete('/:id', requireRoles('ADMIN'), userController.delete);

export const userRouter = router;
