import { Router } from 'express';

import LibraryController from '@server/controllers/LibraryController';

const router = Router();

router.get('/stats', LibraryController.getStats);
router.post('/sync', LibraryController.triggerSync);
router.post('/organize', LibraryController.triggerOrganize);
router.get('/organize/status', LibraryController.getOrganizeStatus);

export default router;
