import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load .env from monorepo root or local
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config();

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(5000),
  API_PORT: z.coerce.number().default(5000),
  MONGODB_URI: z.string().default('mongodb://127.0.0.1:27017/schedulai'),
  JWT_SECRET: z.string().default('schedulai_super_secure_jwt_secret_key_12345_production'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().default('schedulai_super_secure_jwt_refresh_secret_key_67890_production'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  SCHEDULER_URL: z.string().default('http://127.0.0.1:8000'),
  LLM_PROVIDER: z.string().default('openai'),
  LLM_API_KEY: z.string().optional().default(''),
  LLM_MODEL: z.string().default('gpt-4o-mini'),
  LLM_BASE_URL: z.string().default('https://api.openai.com/v1'),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  MAX_UPLOAD_SIZE_MB: z.coerce.number().default(10),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format());
  throw new Error('Environment variable validation failed');
}

export const env = {
  ...parsed.data,
  port: parsed.data.API_PORT || parsed.data.PORT,
};
