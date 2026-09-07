import { Router } from 'express';
import {
  getSlackAuthUrlHandler,
  slackCallbackHandler,
} from '../controllers/slackController.js';

const router = Router();

router.get('/oauth/start', getSlackAuthUrlHandler);
router.get('/oauth/callback', slackCallbackHandler);

export default router;
