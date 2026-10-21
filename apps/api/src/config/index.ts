import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env from repository root or current directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config();

interface Config {
  nodeEnv: string;
  port: number;
  mongodbUri: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  webOrigin: string;
  uploadDir: string;
  maxUploadBytes: number;
  mlServiceUrl: string;
  mlServiceTimeoutMs: number;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    console.error(`FATAL: Required environment variable ${key} is missing or empty.`);
    console.error('Copy .env.example to .env and fill in the required values.');
    process.exit(1);
  }
  return value.trim();
}

export const config: Config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.API_PORT ?? '4000', 10),
  mongodbUri: requireEnv('MONGODB_URI'),
  jwtSecret: requireEnv('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
  uploadDir: process.env.UPLOAD_DIR ?? './uploads',
  maxUploadBytes: parseInt(process.env.MAX_UPLOAD_BYTES ?? '5242880', 10),
  mlServiceUrl: process.env.ML_SERVICE_URL ?? 'http://127.0.0.1:8000',
  mlServiceTimeoutMs: parseInt(process.env.ML_SERVICE_TIMEOUT_MS ?? '3000', 10),
  adminName: process.env.ADMIN_NAME ?? 'Demo Admin',
  adminEmail: process.env.ADMIN_EMAIL ?? 'admin@example.com',
  adminPassword: process.env.ADMIN_PASSWORD ?? 'replace_with_a_local_password',
};
