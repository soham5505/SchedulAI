import { Router } from 'express';
import { auditController } from './audit.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireRoles } from '../../middleware/rbac.middleware.js';
import { validateQuery } from '../../middleware/validation.middleware.js';
import { PaginationQuerySchema } from '@schedulai/validation';

const router = Router();

router.use(authenticate);

router.get('/', requireRoles('ADMIN'), validateQuery(PaginationQuerySchema), auditController.getAll);

export const auditRouter = router;
