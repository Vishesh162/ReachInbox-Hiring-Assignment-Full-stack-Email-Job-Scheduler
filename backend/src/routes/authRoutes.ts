import { Router } from 'express';
import {
  handleGoogleLogin,
  handleEmailLogin,
  getMe,
  logout,
} from '../controllers/authController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/google', handleGoogleLogin);
router.post('/email', handleEmailLogin);
router.get('/me', requireAuth, getMe);
router.post('/logout', logout);

export default router;
