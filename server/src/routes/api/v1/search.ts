import { Router } from 'express';

import SearchController from '@server/controllers/SearchController';

const router = Router();

router.get('/musicbrainz', SearchController.searchMusicBrainz);

export default router;
