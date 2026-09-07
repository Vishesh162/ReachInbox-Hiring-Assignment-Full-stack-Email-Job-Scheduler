import { Router } from 'express';
import {
  getSendersHandler,
  createEtherealSenderHandler,
} from '../controllers/senderController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/', requireAuth, getSendersHandler);
router.post('/ethereal', requireAuth, createEtherealSenderHandler);

export default router;
