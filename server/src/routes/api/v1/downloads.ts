import { Router } from 'express';

import DownloadsController from '@server/controllers/DownloadsController';
import { rateLimit } from '@server/middleware/rateLimit';

const router = Router();

router.get('/active', DownloadsController.getActive);
router.get('/completed', DownloadsController.getCompleted);
router.get('/failed', DownloadsController.getFailed);
router.post('/retry', DownloadsController.retry);
router.delete('/', DownloadsController.delete);
router.get('/stats', DownloadsController.getStats);

// Interactive search result selection routes (rate limited)
const selectionRateLimit = rateLimit({ windowMs: 60000, maxRequests: 30 });

router.get('/:id/search-results', selectionRateLimit, DownloadsController.getSearchResults);
router.post('/:id/select', selectionRateLimit, DownloadsController.selectResult);
router.post('/:id/skip', selectionRateLimit, DownloadsController.skipResult);
router.post('/:id/retry-search', selectionRateLimit, DownloadsController.retrySearchRequest);
router.post('/:id/auto-select', selectionRateLimit, DownloadsController.autoSelect);

export default router;
