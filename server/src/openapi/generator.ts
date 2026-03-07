import { OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';

import { version } from '../../package.json';
import { initializeOpenApiRegistry, registry } from '@server/openapi/registry';

let cachedSpec: object | null = null;

export async function getOpenApiSpec(): Promise<object> {
  if (cachedSpec) {
    return cachedSpec;
  }

  await initializeOpenApiRegistry();

  const generator = new OpenApiGeneratorV31(registry.definitions);

  // OpenAPI spec version is tied to the generator class (OpenApiGeneratorV31 -> 3.1.0)
  cachedSpec = generator.generateDocument({
    openapi: '3.1.0',
    info:    {
      title:       'DeepCrate API',
      version,
      description: 'Self-hosted music discovery pipeline API',
    },
    servers: [{ url: '/api/v1' }],
  });

  return cachedSpec;
}
