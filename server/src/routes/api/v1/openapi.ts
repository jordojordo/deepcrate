import { Router } from 'express';

import { getOpenApiSpec } from '@server/openapi/generator';

const router = Router();

router.get('/', async(_req, res) => {
  res.json(await getOpenApiSpec());
});

export default router;
