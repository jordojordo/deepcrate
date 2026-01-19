import { Router } from 'express';

import DownloadsController from '@server/controllers/DownloadsController';

const router = Router();

router.get('/active', DownloadsController.getActive);
router.get('/completed', DownloadsController.getCompleted);
router.get('/failed', DownloadsController.getFailed);
router.post('/retry', DownloadsController.retry);
router.delete('/', DownloadsController.delete);
router.get('/stats', DownloadsController.getStats);

export default router;
