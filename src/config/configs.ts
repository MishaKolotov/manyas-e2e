export interface UrlConfig {
  /** Stable id used in test titles and TEST_CONFIG filtering. */
  name: string;
  /** Path under BASE_URL. */
  path: string;
  /** Query string (without leading `?`), config-specific flags. */
  params: string;
}

/**
 * Force the B branch of every A/B test. Set FORCE_B to false to test the A
 * branch instead.
 */
export const FORCE_B = true;
const FORCE_B_PARAMS = 'AValue=0&BValue=100';

/**
 * All URL variants under test. To add a funnel, add one line here.
 */
export const CONFIGS: readonly UrlConfig[] = [
  { name: 'default', path: '/walking/survey/', params: 'stripeV64=true' },
  { name: 'taichiwalking', path: '/walking/survey/', params: 'config=taichiwalking&stripeV64=true' },
  {
    name: 'japanesewalking',
    path: '/walking/survey/',
    params: 'config=taichiwalking&stripeV64=true&japaneseWalkingMethod=true',
  },
] as const;

/** Build the absolute URL for a config against baseUrl, forcing variant B. */
export function buildConfigUrl(config: UrlConfig, baseUrl: string): string {
  const url = new URL(config.path, baseUrl);
  const params = new URLSearchParams(config.params);
  if (FORCE_B) {
    for (const [k, v] of new URLSearchParams(FORCE_B_PARAMS)) params.set(k, v);
  }
  for (const [k, v] of params) url.searchParams.set(k, v);
  return url.toString();
}

/** Pick which configs to run. Undefined → all; otherwise filter by name. */
export function selectedConfigs(testConfig: string | undefined): readonly UrlConfig[] {
  if (!testConfig) return CONFIGS;
  const found = CONFIGS.filter((c) => c.name === testConfig);
  if (found.length === 0) {
    throw new Error(
      `Unknown config "${testConfig}". Valid: ${CONFIGS.map((c) => c.name).join(', ')}.`,
    );
  }
  return found;
}
