import type { Request, Response } from 'express';
import type {
  WishlistResponse,
  AddToWishlistResponse,
  DeleteFromWishlistResponse,
  UpdateWishlistItemResponse,
  BulkOperationResponse,
  PaginatedWishlistResponse,
  ImportResponse,
} from '@server/types/wishlist';

import { BaseController } from '@server/controllers/BaseController';
import { WishlistService } from '@server/services/WishlistService';
import {
  addToWishlistRequestSchema,
  updateWishlistItemSchema,
  bulkDeleteSchema,
  bulkRequeueSchema,
  wishlistFiltersSchema,
  exportRequestSchema,
  importRequestSchema,
} from '@server/types/wishlist';
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

  /**
   * Get paginated wishlist with filters and download status
   * GET /api/v1/wishlist/paginated
   */
  getWishlistPaginated = async(req: Request, res: Response): Promise<Response> => {
    try {
      const parseResult = wishlistFiltersSchema.safeParse(req.query);

      if (!parseResult.success) {
        return sendValidationError(res, 'Invalid query parameters', { errors: parseResult.error.issues });
      }

      const result = await this.wishlistService.getPaginatedWithStatus(parseResult.data);

      const response: PaginatedWishlistResponse = {
        entries: result.items,
        total:   result.total,
        limit:   result.limit,
        offset:  result.offset,
      };

      return res.json(response);
    } catch(error) {
      return this.handleError(res, error as Error, 'Failed to fetch wishlist');
    }
  };

  /**
   * Update a wishlist item
   * PUT /api/v1/wishlist/:id
   */
  updateWishlistItem = async(req: Request, res: Response): Promise<Response> => {
    try {
      const id = req.params.id;

      if (!id || typeof id !== 'string') {
        return sendValidationError(res, 'Missing or invalid id parameter');
      }

      const parseResult = updateWishlistItemSchema.safeParse(req.body);

      if (!parseResult.success) {
        return sendValidationError(res, 'Invalid request body', { errors: parseResult.error.issues });
      }

      const item = await this.wishlistService.updateById(id, parseResult.data);

      if (!item) {
        return sendNotFoundError(res, 'Wishlist item not found');
      }

      const response: UpdateWishlistItemResponse = {
        success: true,
        message: parseResult.data.resetDownloadState? 'Updated and re-queued for download': 'Updated wishlist item',
        entry:   {
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
        },
      };

      return res.json(response);
    } catch(error) {
      return this.handleError(res, error as Error, 'Failed to update wishlist item');
    }
  };

  /**
   * Bulk delete wishlist items
   * DELETE /api/v1/wishlist/bulk
   */
  bulkDelete = async(req: Request, res: Response): Promise<Response> => {
    try {
      const parseResult = bulkDeleteSchema.safeParse(req.body);

      if (!parseResult.success) {
        return sendValidationError(res, 'Invalid request body', { errors: parseResult.error.issues });
      }

      const affected = await this.wishlistService.bulkDelete(parseResult.data.ids);

      const response: BulkOperationResponse = {
        success:  true,
        message:  `Deleted ${ affected } item(s)`,
        affected,
      };

      return res.json(response);
    } catch(error) {
      return this.handleError(res, error as Error, 'Failed to bulk delete');
    }
  };

  /**
   * Bulk requeue wishlist items for download
   * POST /api/v1/wishlist/requeue
   */
  bulkRequeue = async(req: Request, res: Response): Promise<Response> => {
    try {
      const parseResult = bulkRequeueSchema.safeParse(req.body);

      if (!parseResult.success) {
        return sendValidationError(res, 'Invalid request body', { errors: parseResult.error.issues });
      }

      const affected = await this.wishlistService.bulkRequeue(parseResult.data.ids);

      const response: BulkOperationResponse = {
        success:  true,
        message:  `Re-queued ${ affected } item(s) for download`,
        affected,
      };

      return res.json(response);
    } catch(error) {
      return this.handleError(res, error as Error, 'Failed to bulk requeue');
    }
  };

  /**
   * Export wishlist items
   * GET /api/v1/wishlist/export
   */
  exportWishlist = async(req: Request, res: Response): Promise<Response> => {
    try {
      // Parse query params - ids comes as comma-separated string
      const format = req.query.format as string || 'json';
      const idsParam = req.query.ids as string | undefined;
      const ids = idsParam ? idsParam.split(',').filter(Boolean) : undefined;

      const parseResult = exportRequestSchema.safeParse({ format, ids });

      if (!parseResult.success) {
        return sendValidationError(res, 'Invalid query parameters', { errors: parseResult.error.issues });
      }

      const content = await this.wishlistService.exportItems(parseResult.data);

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="wishlist.json"');

      return res.send(content);
    } catch(error) {
      return this.handleError(res, error as Error, 'Failed to export wishlist');
    }
  };

  /**
   * Import wishlist items
   * POST /api/v1/wishlist/import
   */
  importWishlist = async(req: Request, res: Response): Promise<Response> => {
    try {
      const parseResult = importRequestSchema.safeParse(req.body);

      if (!parseResult.success) {
        return sendValidationError(res, 'Invalid request body', { errors: parseResult.error.issues });
      }

      const result = await this.wishlistService.importItems(parseResult.data.items);

      const response: ImportResponse = {
        success: result.errors === 0,
        message: `Imported ${ result.added } item(s), ${ result.skipped } skipped, ${ result.errors } errors`,
        added:   result.added,
        skipped: result.skipped,
        errors:  result.errors,
        results: result.results,
      };

      return res.status(result.errors > 0 ? 207 : 200).json(response);
    } catch(error) {
      return this.handleError(res, error as Error, 'Failed to import wishlist');
    }
  };
}

export default new WishlistController();
