import { Router } from 'express';
import {
  getScheduledEmails,
  getSentEmails,
  searchEmailsHandler,
  getEmailStats,
} from '../controllers/emailController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/scheduled', requireAuth, getScheduledEmails);
router.get('/sent', requireAuth, getSentEmails);
router.get('/search', requireAuth, searchEmailsHandler);
router.get('/stats', requireAuth, getEmailStats);

export default router;
