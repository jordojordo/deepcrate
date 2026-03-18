import { Router } from 'express';

import WebhookController from '@server/controllers/WebhookController';

const router = Router();

router.post('/test', WebhookController.testWebhook);

export default router;
