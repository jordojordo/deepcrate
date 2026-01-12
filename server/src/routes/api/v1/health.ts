import { Router } from 'express';

import HealthController from '@server/controllers/HealthController';

const router = Router();

router.get('/', HealthController.check);

export default router;
