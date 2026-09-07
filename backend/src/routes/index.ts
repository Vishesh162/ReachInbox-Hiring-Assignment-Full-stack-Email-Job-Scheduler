import { Router } from 'express';
import authRoutes from './authRoutes.js';
import campaignRoutes from './campaignRoutes.js';
import emailRoutes from './emailRoutes.js';
import senderRoutes from './senderRoutes.js';
import slackRoutes from './slackRoutes.js';

const apiRouter = Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/campaigns', campaignRoutes);
apiRouter.use('/emails', emailRoutes);
apiRouter.use('/senders', senderRoutes);
apiRouter.use('/slack', slackRoutes);

apiRouter.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'reachinbox-scheduler-backend',
  });
});

export default apiRouter;
