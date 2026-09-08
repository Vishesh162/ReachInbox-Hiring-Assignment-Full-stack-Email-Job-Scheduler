import { Router } from 'express';
import {
  getSlackAuthUrlHandler,
  slackCallbackHandler,
  disconnectSlackHandler,
} from '../controllers/slackController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/oauth/start', requireAuth, getSlackAuthUrlHandler);
router.get('/oauth/callback', slackCallbackHandler);
router.post('/disconnect', requireAuth, disconnectSlackHandler);

export default router;

