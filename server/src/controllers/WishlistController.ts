import type { Request, Response } from 'express';
import type { WishlistResponse, AddToWishlistResponse, DeleteFromWishlistResponse } from '@server/types/wishlist';

import { BaseController } from '@server/controllers/BaseController';
import { WishlistService } from '@server/services/WishlistService';
import { addToWishlistRequestSchema } from '@server/types/wishlist';
import { sendValidationError, sendNotFoundError } from '@server/utils/errorHandler';

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
      const items = await this.wishlistService.getAll();

      const entries = items.map(item => ({
        id:          item.id,
        artist:      item.artist,
        title:       item.album,
        type:        item.type,
        year:        item.year ?? null,
        mbid:        item.mbid ?? null,
        source:      item.source ?? null,
        coverUrl:    item.coverUrl ?? null,
        addedAt:     item.addedAt,
        processedAt: item.processedAt ?? null,
      }));

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

      const {
        artist, title, type, year, mbid
      } = parseResult.data;

      // Add to wishlist
      const wishlistItem = await this.wishlistService.append({
        artist,
        album:  title,
        type,
        year,
        mbid,
        source: 'manual',
      });

      const response: AddToWishlistResponse = {
        success: true,
        message: `Added ${ type } to wishlist: ${ artist } - ${ title }`,
        entry:   {
          id:          wishlistItem.id,
          artist:      wishlistItem.artist,
          title:       wishlistItem.album,
          type:        wishlistItem.type,
          year:        wishlistItem.year ?? null,
          mbid:        wishlistItem.mbid ?? null,
          source:      wishlistItem.source ?? null,
          coverUrl:    wishlistItem.coverUrl ?? null,
          addedAt:     wishlistItem.addedAt,
          processedAt: wishlistItem.processedAt ?? null,
        },
      };

      return res.status(201).json(response);
    } catch(error) {
      return this.handleError(res, error as Error, 'Failed to add to wishlist');
    }
  };

  /**
   * Delete a wishlist entry by ID
   * DELETE /api/v1/wishlist/:id
   */
  deleteFromWishlist = async(req: Request, res: Response): Promise<Response> => {
    try {
      const id = req.params.id;

      if (!id || typeof id !== 'string') {
        return sendValidationError(res, 'Missing or invalid id parameter');
      }

      const removed = await this.wishlistService.removeById(id);

      if (!removed) {
        return sendNotFoundError(res, 'Wishlist item not found');
      }

      const response: DeleteFromWishlistResponse = {
        success: true,
        message: 'Removed from wishlist',
      };

      return res.json(response);
    } catch(error) {
      return this.handleError(res, error as Error, 'Failed to delete from wishlist');
    }
  };
}

export default new WishlistController();
