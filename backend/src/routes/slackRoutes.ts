import { Router } from 'express';
import {
  getSlackAuthUrlHandler,
  slackCallbackHandler,
} from '../controllers/slackController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/oauth/start', authMiddleware, getSlackAuthUrlHandler);
router.get('/oauth/callback', slackCallbackHandler);

export default router;
