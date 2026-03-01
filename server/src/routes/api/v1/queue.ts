import { Router } from 'express';

import QueueController from '@server/controllers/QueueController';

const router = Router();

router.get('/pending', QueueController.getPending);
router.get('/genres', QueueController.getGenres);
router.get('/stats', QueueController.getStats);
router.post('/approve', QueueController.approve);
router.post('/reject', QueueController.reject);

export default router;
