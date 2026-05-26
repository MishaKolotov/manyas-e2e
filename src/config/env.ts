import 'dotenv/config';

export interface AppEnv {
  basicAuthUser: string;
  basicAuthPass: string;
  baseUrl: string;
  surveyPath: string;
  featureFlags: string;
}

const REQUIRED_VARS = [
  'BASIC_AUTH_USER',
  'BASIC_AUTH_PASS',
  'BASE_URL',
  'SURVEY_PATH',
  'FEATURE_FLAGS',
] as const;

export function loadEnv(): AppEnv {
  const missing = REQUIRED_VARS.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required env vars: ${missing.join(', ')}.\n` +
        `Copy .env.example to .env and fill in credentials.`,
    );
  }
  return {
    basicAuthUser: process.env.BASIC_AUTH_USER!,
    basicAuthPass: process.env.BASIC_AUTH_PASS!,
    baseUrl: process.env.BASE_URL!,
    surveyPath: process.env.SURVEY_PATH!,
    featureFlags: process.env.FEATURE_FLAGS!,
  };
}
