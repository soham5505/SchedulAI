import { Router } from 'express';
import { generationController } from './generation.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireRoles } from '../../middleware/rbac.middleware.js';
import { validateBody, validateQuery } from '../../middleware/validation.middleware.js';
import { GenerateTimetableSchema, PaginationQuerySchema } from '@schedulai/validation';

const router = Router();

router.use(authenticate);

router.post('/generate', requireRoles('ADMIN', 'STAFF'), validateBody(GenerateTimetableSchema), generationController.generate);
router.get('/', validateQuery(PaginationQuerySchema), generationController.getAll);
router.get('/:id', generationController.getById);
router.post('/:id/restore', requireRoles('ADMIN', 'STAFF'), generationController.restore);
router.delete('/:id', requireRoles('ADMIN'), generationController.delete);

export const generationRouter = router;
