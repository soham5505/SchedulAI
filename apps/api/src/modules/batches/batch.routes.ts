import { Router } from 'express';
import { batchController } from './batch.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireRoles } from '../../middleware/rbac.middleware.js';
import { validateBody, validateQuery } from '../../middleware/validation.middleware.js';
import { BatchQuerySchema, CreateBatchSchema, UpdateBatchSchema } from '@schedulai/validation';

const router = Router();

router.use(authenticate);
router.get('/', validateQuery(BatchQuerySchema), batchController.getAll);
router.get('/:id', batchController.getById);
router.post('/', requireRoles('ADMIN', 'STAFF'), validateBody(CreateBatchSchema), batchController.create);
router.put('/:id', requireRoles('ADMIN', 'STAFF'), validateBody(UpdateBatchSchema), batchController.update);
router.delete('/:id', requireRoles('ADMIN'), batchController.delete);

export const batchRouter = router;