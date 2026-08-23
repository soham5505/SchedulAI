import { Router } from 'express';
import multer from 'multer';
import { importController } from './import.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireRoles } from '../../middleware/rbac.middleware.js';
import { validateQuery } from '../../middleware/validation.middleware.js';
import { PaginationQuerySchema } from '@schedulai/validation';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
});

const router = Router();

router.use(authenticate);

router.post('/upload', requireRoles('ADMIN', 'STAFF'), upload.single('file'), importController.uploadAndParse);
router.post('/execute', requireRoles('ADMIN', 'STAFF'), importController.execute);
router.get('/jobs', validateQuery(PaginationQuerySchema), importController.getJobs);
router.get('/jobs/:id', importController.getJobById);

export const importRouter = router;
