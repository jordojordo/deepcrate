import { Router } from 'express';

import AuthController from '@server/controllers/AuthController';

const router = Router();

// Protected endpoint - requires auth
// Note: /info is registered directly in app.ts before auth middleware
router.get('/me', AuthController.getMe);

export default router;
