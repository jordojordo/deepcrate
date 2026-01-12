import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { z } from 'zod';

/**
 * Zod schemas for configuration validation
 */

const AuthSettingsSchema = z.object({
  enabled:  z.boolean(),
  type:     z.enum(['basic', 'api_key', 'proxy']).optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  api_key:  z.string().optional(),
});

const UISettingsSchema = z.object({ auth: AuthSettingsSchema });

const ListenBrainzSettingsSchema = z.object({
  username:      z.string(),
  token:         z.string(),
  approval_mode: z.enum(['auto', 'manual']),
});

const SlskdSettingsSchema = z.object({
  host:    z.string(),
  api_key: z.string(),
});

const NavidromeSettingsSchema = z.object({
  host:     z.string(),
  username: z.string(),
  password: z.string(),
});

const LastFmSettingsSchema = z.object({ api_key: z.string() });

const CatalogDiscoverySettingsSchema = z.object({
  enabled:              z.boolean(),
  navidrome:            NavidromeSettingsSchema.optional(),
  lastfm:               LastFmSettingsSchema.optional(),
  max_artists_per_run:  z.number().int().positive(),
  min_similarity:       z.number().min(0).max(1),
  similar_artist_limit: z.number().int().positive().optional(),
  albums_per_artist:    z.number().int().positive().optional(),
  mode:                 z.enum(['auto', 'manual']),
});

const ConfigSchema = z.object({
  debug:             z.boolean(),
  mode:              z.enum(['album', 'track']),
  fetch_count:       z.number().int().positive(),
  listenbrainz:      ListenBrainzSettingsSchema.optional(),
  slskd:             SlskdSettingsSchema.optional(),
  catalog_discovery: CatalogDiscoverySettingsSchema,
  ui:                UISettingsSchema,
});

export type Config = z.infer<typeof ConfigSchema>;
export type AuthSettings = z.infer<typeof AuthSettingsSchema>;
export type UISettings = z.infer<typeof UISettingsSchema>;
export type ListenBrainzSettings = z.infer<typeof ListenBrainzSettingsSchema>;
export type SlskdSettings = z.infer<typeof SlskdSettingsSchema>;
export type CatalogDiscoverySettings = z.infer<typeof CatalogDiscoverySettingsSchema>;

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Config = {
  debug:             false,
  mode:              'album',
  fetch_count:       100,
  catalog_discovery: {
    enabled:             false,
    max_artists_per_run: 10,
    min_similarity:      0.3,
    mode:                'manual',
  },
  ui: { auth: { enabled: false } },
};

/**
 * Settings singleton
 */
let cachedConfig: Config | null = null;

/**
 * Load config from YAML file with environment variable support.
 *
 * Config path resolution:
 * 1. CONFIG_PATH environment variable
 * 2. /config/config.yaml (Docker default)
 * 3. ./config.yaml (local development)
 *
 * Environment variable overrides:
 * - RESONANCE_* env vars with __ for nesting (e.g., RESONANCE_UI__AUTH__ENABLED=true)
 */
export function loadConfig(): Config {
  if (cachedConfig) {
    return cachedConfig;
  }

  const configPath = resolveConfigPath();
  let rawConfig: Record<string, unknown> = {};

  if (fs.existsSync(configPath)) {
    const fileContent = fs.readFileSync(configPath, 'utf-8');

    rawConfig = yaml.load(fileContent) as Record<string, unknown> || {};
  }

  // Apply environment variable overrides
  rawConfig = applyEnvOverrides(rawConfig);

  // Deep merge with defaults
  const mergedConfig = deepMerge(DEFAULT_CONFIG, rawConfig);

  // Validate and parse config
  const result = ConfigSchema.safeParse(mergedConfig);

  if (!result.success) {
    const errors = result.error.issues.map((issue) => `  ${ issue.path.join('.') }: ${ issue.message }`).join('\n');

    throw new Error(`Invalid configuration:\n${ errors }`);
  }

  cachedConfig = result.data;

  return cachedConfig;
}

/**
 * Get the cached config or load it
 */
export function getConfig(): Config {
  return loadConfig();
}

/**
 * Clear cached config (useful for testing)
 */
export function clearConfigCache(): void {
  cachedConfig = null;
}

/**
 * Resolve the config file path
 */
function resolveConfigPath(): string {
  if (process.env.CONFIG_PATH) {
    return process.env.CONFIG_PATH;
  }

  const dockerPath = '/config/config.yaml';

  if (fs.existsSync(dockerPath)) {
    return dockerPath;
  }

  return path.join(process.cwd(), 'config.yaml');
}

/**
 * Apply RESONANCE_* environment variable overrides to config object.
 * Uses __ as a separator for nested keys.
 *
 * Examples:
 * - RESONANCE_DEBUG=true -> { debug: true }
 * - RESONANCE_UI__AUTH__ENABLED=true -> { ui: { auth: { enabled: true } } }
 * - RESONANCE_SLSKD__HOST=http://localhost:5030 -> { slskd: { host: 'http://localhost:5030' } }
 */
function applyEnvOverrides(config: Record<string, unknown>): Record<string, unknown> {
  const prefix = 'RESONANCE_';

  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith(prefix) || value === undefined) {
      continue;
    }

    const configPath = key.slice(prefix.length).toLowerCase().split('__');

    setNestedValue(config, configPath, parseEnvValue(value));
  }

  return config;
}

/**
 * Deep merge two objects. Source values override target values.
 */
function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...target };

  for (const key of Object.keys(source)) {
    const sourceValue = source[key];
    const targetValue = result[key];

    if (isPlainObject(sourceValue) && isPlainObject(targetValue)) {
      result[key] = deepMerge(targetValue as Record<string, unknown>, sourceValue as Record<string, unknown>);
    } else if (sourceValue !== undefined) {
      result[key] = sourceValue;
    }
  }

  return result;
}

/**
 * Check if a value is a plain object
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Set a nested value in an object by path
 */
function setNestedValue(obj: Record<string, unknown>, path: string[], value: unknown): void {
  let current = obj;

  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];

    if (!(key in current) || typeof current[key] !== 'object' || current[key] === null) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }

  current[path[path.length - 1]] = value;
}

/**
 * Parse environment variable value to appropriate type
 */
function parseEnvValue(value: string): unknown {
  // Boolean
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;

  // Number
  const num = Number(value);

  if (!isNaN(num) && value.trim() !== '') return num;

  // String
  return value;
}

/**
 * Data directory path
 */
export function getDataPath(): string {
  return process.env.DATA_PATH || 'data';
}

/**
 * Ensure data directory exists
 */
export function ensureDataDir(): string {
  const dataPath = getDataPath();

  if (!fs.existsSync(dataPath)) {
    fs.mkdirSync(dataPath, { recursive: true });
  }

  return dataPath;
}
