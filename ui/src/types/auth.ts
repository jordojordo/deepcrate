export type AuthMode = 'basic' | 'api_key' | 'proxy' | 'disabled';

export interface AuthConfig {
  enabled: boolean;
  type:    AuthMode;
}

export interface AuthUser {
  username: string;
}

