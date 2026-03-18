import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();
let isInitialized = false;

export async function initializeOpenApiRegistry(): Promise<void> {
  if (isInitialized) {
    return;
  }

  registry.registerComponent('securitySchemes', 'bearerAuth', {
    type:   'http',
    scheme: 'bearer',
  });

  registry.registerComponent('securitySchemes', 'basicAuth', {
    type:   'http',
    scheme: 'basic',
  });

  registry.registerComponent('securitySchemes', 'apiKeyHeader', {
    type: 'apiKey',
    in:   'header',
    name: 'X-API-Key',
  });

  await import('./schemas');
  await import('./routes/health');
  await import('./routes/auth');
  await import('./routes/queue');
  await import('./routes/wishlist');
  await import('./routes/downloads');
  await import('./routes/jobs');
  await import('./routes/search');
  await import('./routes/settings');
  await import('./routes/webhooks');
  await import('./routes/library');
  await import('./routes/preview');
  await import('./routes/activity');

  isInitialized = true;
}
