import { Router } from 'express';

import DownloadsController from '@server/controllers/DownloadsController';

const router = Router();

router.get('/active', DownloadsController.getActive);
router.get('/completed', DownloadsController.getCompleted);
router.get('/failed', DownloadsController.getFailed);
router.post('/retry', DownloadsController.retry);
router.delete('/', DownloadsController.delete);
router.get('/stats', DownloadsController.getStats);

// Interactive search result selection routes
router.get('/:id/search-results', DownloadsController.getSearchResults);
router.post('/:id/select', DownloadsController.selectResult);
router.post('/:id/skip', DownloadsController.skipResult);
router.post('/:id/retry-search', DownloadsController.retrySearchRequest);
router.post('/:id/auto-select', DownloadsController.autoSelect);

export default router;
