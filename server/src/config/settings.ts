import type { Config } from '@server/config/schemas';

import fs from 'fs';
import path from 'path';
import { parse, stringify } from 'yaml';
import { Mutex } from 'async-mutex';

import { ConfigSchema, DEFAULT_CONFIG } from '@server/config/schemas';
import { deepMerge, isPlainObject, setNestedValue } from '@server/utils/objects';

const configMutex = new Mutex();

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
 * - DEEPCRATE_* env vars with __ for nesting (e.g., DEEPCRATE_UI__AUTH__ENABLED=true)
 */
function loadConfig(): Config {
  if (cachedConfig) {
    return cachedConfig;
  }

  const configPath = resolveConfigPath();
  let rawConfig: Record<string, unknown> = {};

  if (fs.existsSync(configPath)) {
    const fileContent = fs.readFileSync(configPath, 'utf-8');

    rawConfig = parse(fileContent) as Record<string, unknown> || {};
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
 * Update a specific section of the configuration.
 * To clear a secret, set its value to `null` (e.g., { token: null }).
 */
export async function updateConfig(section: string, updates: Record<string, unknown>): Promise<void> {
  await configMutex.runExclusive(async() => {
    const configPath = resolveConfigPath();
    let rawConfig: Record<string, unknown> = {};

    if (fs.existsSync(configPath)) {
      const fileContent = await fs.promises.readFile(configPath, 'utf-8');

      rawConfig = parse(fileContent) as Record<string, unknown> || {};
    }

    const currentSection = rawConfig[section] ?? {};

    if (isPlainObject(updates) && isPlainObject(currentSection)) {
      rawConfig[section] = deepMerge(currentSection, updates);
    } else {
      rawConfig[section] = updates;
    }

    const mergedConfig = deepMerge(DEFAULT_CONFIG, rawConfig);
    const result = ConfigSchema.safeParse(mergedConfig);

    if (!result.success) {
      const errors = result.error.issues.map((issue) => `  ${ issue.path.join('.') }: ${ issue.message }`).join('\n');

      throw new Error(`Invalid configuration:\n${ errors }`);
    }

    const output = stringify(rawConfig, { lineWidth: 120 });

    await fs.promises.writeFile(configPath, output, 'utf-8');
    clearConfigCache();
  });
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
 * Apply DEEPCRATE_* environment variable overrides to config object.
 * Uses __ as a separator for nested keys.
 *
 * Examples:
 * - DEEPCRATE_DEBUG=true -> { debug: true }
 * - DEEPCRATE_UI__AUTH__ENABLED=true -> { ui: { auth: { enabled: true } } }
 * - DEEPCRATE_SLSKD__HOST=http://localhost:5030 -> { slskd: { host: 'http://localhost:5030' } }
 */
function applyEnvOverrides(config: Record<string, unknown>): Record<string, unknown> {
  const prefix = 'DEEPCRATE_';

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
