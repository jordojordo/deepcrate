import type { ApiReferenceConfiguration } from '@scalar/express-api-reference';

import { apiReference } from '@scalar/express-api-reference';

const docsConfig: ApiReferenceConfiguration = {
  url:         '/api/v1/openapi.json',
  theme:       'deepSpace',
  layout:      'modern',
  darkMode:    true,
  showSidebar: true,
  telemetry:   false
};

export default apiReference(docsConfig);
