import { Router } from 'express';

import WishlistController from '@server/controllers/WishlistController';

const router = Router();

router.get('/', WishlistController.getWishlist);
router.post('/', WishlistController.addToWishlist);
router.get('/paginated', WishlistController.getWishlistPaginated);
router.get('/export', WishlistController.exportWishlist);
router.post('/import', WishlistController.importWishlist);
router.delete('/bulk', WishlistController.bulkDelete);
router.post('/requeue', WishlistController.bulkRequeue);

router.put('/:id', WishlistController.updateWishlistItem);
router.delete('/:id', WishlistController.deleteFromWishlist);

export default router;
