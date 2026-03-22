/**
 * Each test file must independently vi.mock('@server/config/settings')
 */

const AUTH_CREDENTIALS = {
  username: 'testuser',
  password: 'testpass',
};

export const AUTH_HEADER = `Basic ${ Buffer.from(`${ AUTH_CREDENTIALS.username }:${ AUTH_CREDENTIALS.password }`).toString('base64') }`;

export const AUTH_CONFIG = {
  ui: {
    auth: {
      enabled:  true,
      type:     'basic' as const,
      username: AUTH_CREDENTIALS.username,
      password: AUTH_CREDENTIALS.password,
    },
  },
};
