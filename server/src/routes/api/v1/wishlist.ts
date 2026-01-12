import { Router } from 'express';

import WishlistController from '@server/controllers/WishlistController';

const router = Router();

router.get('/', WishlistController.getWishlist);
router.post('/', WishlistController.addToWishlist);

export default router;
