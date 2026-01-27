export type AuthMode = 'basic' | 'api_key' | 'proxy' | 'disabled';

export interface AuthConfig {
  enabled: boolean;
  type:    AuthMode;
}

export interface AuthUser {
  username: string;
}

export interface AuthCredentials {
  username: string;
  password: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  username:        string | null;
  authConfig:      AuthConfig | null;
}
