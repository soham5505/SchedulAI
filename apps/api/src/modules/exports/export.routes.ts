import { Router } from 'express';
import { exportController } from './export.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const router = Router();

router.use(authenticate);

router.get('/excel', exportController.exportExcel);
router.get('/csv', exportController.exportCSV);
router.get('/printable', exportController.getPrintable);

export const exportRouter = router;
