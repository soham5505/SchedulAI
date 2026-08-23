import { Router } from 'express';
import { dashboardController } from './dashboard.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const router = Router();

router.use(authenticate);

router.get('/stats', dashboardController.getStats);

export const dashboardRouter = router;
