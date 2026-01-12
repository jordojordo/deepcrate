import { Router } from 'express';

import JobsController from '@server/controllers/JobsController';

const router = Router();

router.get('/status', JobsController.getStatus);
router.post('/:jobName/trigger', JobsController.trigger);
router.post('/:jobName/cancel', JobsController.cancel);

export default router;
