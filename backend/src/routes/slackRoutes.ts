import { Router } from 'express';
import {
  getSlackAuthUrlHandler,
  slackCallbackHandler,
} from '../controllers/slackController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/oauth/start', requireAuth, getSlackAuthUrlHandler);
router.get('/oauth/callback', slackCallbackHandler);

export default router;
