#!/usr/bin/env tsx
import fs from 'fs';
import path from 'path';

import { getOpenApiSpec } from '@server/openapi/generator';

async function main() {
  const outputPath = process.argv[2] ?? './openapi.json';
  const spec = await getOpenApiSpec();
  const resolvedPath = path.resolve(outputPath);

  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  fs.writeFileSync(resolvedPath, JSON.stringify(spec, null, 2));
  console.log(`OpenAPI spec written to ${ resolvedPath }`);
}

main();
