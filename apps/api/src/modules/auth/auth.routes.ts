import { Router } from 'express';
import { authController } from './auth.controller.js';
import { validateBody } from '../../middleware/validation.middleware.js';
import { RegisterUserSchema, LoginUserSchema, RefreshTokenSchema } from '@schedulai/validation';
import { authenticate } from '../../middleware/auth.middleware.js';

const router = Router();

router.post('/register', validateBody(RegisterUserSchema), authController.register);
router.post('/login', validateBody(LoginUserSchema), authController.login);
router.post('/refresh', validateBody(RefreshTokenSchema), authController.refresh);
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.getMe);

export const authRouter = router;
