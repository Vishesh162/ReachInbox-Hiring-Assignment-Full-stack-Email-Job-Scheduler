import { Router } from 'express';
import {
  getScheduledEmails,
  getSentEmails,
  searchEmailsHandler,
  getEmailStats,
  deleteEmailJob,
} from '../controllers/emailController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/scheduled', requireAuth, getScheduledEmails);
router.get('/sent', requireAuth, getSentEmails);
router.get('/search', requireAuth, searchEmailsHandler);
router.get('/stats', requireAuth, getEmailStats);
router.delete('/:id', requireAuth, deleteEmailJob);

export default router;
