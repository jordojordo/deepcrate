import type { Request, Response } from 'express';
import type { WishlistResponse, AddToWishlistResponse } from '@server/types/wishlist';

import { BaseController } from '@server/controllers/BaseController';
import { WishlistService } from '@server/services/WishlistService';
import { addToWishlistRequestSchema } from '@server/types/wishlist';
import { sendValidationError } from '@server/utils/errorHandler';

/**
 * Wishlist controller for managing wishlist entries
 */
class WishlistController extends BaseController {
  private wishlistService: WishlistService;

  constructor() {
    super();
    this.wishlistService = new WishlistService();
  }

  /**
   * Get all wishlist entries
   * GET /api/v1/wishlist
   */
  getWishlist = async(_req: Request, res: Response): Promise<Response> => {
    try {
      const entries = this.wishlistService.getAll();

      const response: WishlistResponse = {
        entries,
        total: entries.length,
      };

      return res.json(response);
    } catch(error) {
      return this.handleError(res, error as Error, 'Failed to fetch wishlist');
    }
  };

  /**
   * Add a manual entry to the wishlist
   * POST /api/v1/wishlist
   */
  addToWishlist = async(req: Request, res: Response): Promise<Response> => {
    try {
      // Validate request body
      const parseResult = addToWishlistRequestSchema.safeParse(req.body);

      if (!parseResult.success) {
        return sendValidationError(res, 'Invalid request body', { errors: parseResult.error.issues });
      }

      const { artist, title, type } = parseResult.data;

      // Add to wishlist
      const isAlbum = type === 'album';

      this.wishlistService.append(artist, title, isAlbum);

      const response: AddToWishlistResponse = {
        success: true,
        message: `Added ${ type } to wishlist: ${ artist } - ${ title }`,
        entry:   {
          artist, title, type
        },
      };

      return res.status(201).json(response);
    } catch(error) {
      return this.handleError(res, error as Error, 'Failed to add to wishlist');
    }
  };
}

export default new WishlistController();
