import { Router } from 'express';

import ActivityController from '@server/controllers/ActivityController';

const router = Router();

router.get('/recent', ActivityController.getRecent);

export default router;
