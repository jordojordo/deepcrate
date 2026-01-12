import { Router } from 'express';

import healthRoutes from './health';
import queueRoutes from './queue';

const router = Router();

router.use('/health', healthRoutes);
router.use('/queue', queueRoutes);

export default router;
