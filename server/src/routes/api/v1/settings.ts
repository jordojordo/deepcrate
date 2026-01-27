import { Router } from 'express';

import SettingsController from '@server/controllers/SettingsController';

const router = Router();

router.get('/', SettingsController.getAll);
router.get('/:section', SettingsController.getSection);
router.put('/:section', SettingsController.updateSection);
router.post('/validate', SettingsController.validate);

export default router;
