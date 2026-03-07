import { OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';

import { initializeOpenApiRegistry, registry } from '@server/openapi/registry';

let cachedSpec: object | null = null;

export async function getOpenApiSpec(): Promise<object> {
  if (cachedSpec) {
    return cachedSpec;
  }

  await initializeOpenApiRegistry();

  const generator = new OpenApiGeneratorV31(registry.definitions);

  cachedSpec = generator.generateDocument({
    openapi: '3.1.0',
    info:    {
      title:       'DeepCrate API',
      version:     '1.0.0',
      description: 'Self-hosted music discovery pipeline API',
    },
    servers: [{ url: '/api/v1' }],
  });

  return cachedSpec;
}
