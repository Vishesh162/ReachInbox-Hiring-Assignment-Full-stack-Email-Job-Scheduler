import { Router } from 'express';
import {
  createCampaignHandler,
  parseCsvRecipientsHandler,
  getCampaignsHandler,
} from '../controllers/campaignController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/', requireAuth, createCampaignHandler);
router.post('/parse-csv', requireAuth, parseCsvRecipientsHandler);
router.get('/', requireAuth, getCampaignsHandler);

export default router;
