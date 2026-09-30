import { Router } from 'express';
import { roomReservationController } from './roomReservation.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireRoles } from '../../middleware/rbac.middleware.js';
import { validateBody, validateQuery } from '../../middleware/validation.middleware.js';
import { CreateRoomReservationSchema, UpdateRoomReservationSchema, RoomReservationQuerySchema } from '@schedulai/validation';

const router = Router();

router.use(authenticate);
router.get('/', validateQuery(RoomReservationQuerySchema), roomReservationController.getAll);
router.get('/:id', roomReservationController.getById);
router.post('/', requireRoles('ADMIN', 'STAFF'), validateBody(CreateRoomReservationSchema), roomReservationController.create);
router.put('/:id', requireRoles('ADMIN', 'STAFF'), validateBody(UpdateRoomReservationSchema), roomReservationController.update);
router.delete('/:id', requireRoles('ADMIN'), roomReservationController.delete);

export const roomReservationRouter = router;
