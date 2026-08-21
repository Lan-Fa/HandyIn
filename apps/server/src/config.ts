import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

declare module 'fastify' {
  interface FastifyInstance {
    config: Config;
  }
}

// 加载根目录 .env（不覆盖已存在的环境变量），Docker 场景下 env 由 compose 注入
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

export interface Config {
  basePath: string;
  port: number;
  host: string;
  cookieSecure: boolean;
  sessionSecret: string;
  loginRateLimitMax: number;
  loginRateLimitWindow: string;
  initAdminUsername: string;
  initAdminPassword: string;
  logLevel: string;
  maxUploadSize: number;
  maxUploadFiles: number;
}

function normalizeBasePath(p: string): string {
  let value = p.startsWith('/') ? p : `/${p}`;
  if (value.length > 1 && value.endsWith('/')) value = value.slice(0, -1);
  return value;
}

function parseSize(value: string): number {
  const m = /^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/i.exec(value.trim());
  if (!m) return 10 * 1024 * 1024;
  const n = Number(m[1]);
  const unit = (m[2] ?? 'mb').toLowerCase();
  const factor = { b: 1, kb: 1024, mb: 1024 * 1024, gb: 1024 * 1024 * 1024 }[unit] ?? 1024 * 1024;
  return Math.floor(n * factor);
}

export function loadConfig(): Config {
  return {
    basePath: normalizeBasePath(process.env.HANDYIN_BASE_PATH ?? '/handyin'),
    port: Number(process.env.APP_PORT ?? 3000),
    host: process.env.HOST ?? '0.0.0.0',
    cookieSecure: (process.env.COOKIE_SECURE ?? 'false') === 'true',
    sessionSecret: process.env.SESSION_SECRET ?? 'dev-insecure-secret-change-me',
    loginRateLimitMax: Number(process.env.LOGIN_RATE_LIMIT ?? 5),
    loginRateLimitWindow: '1 minute',
    initAdminUsername: process.env.INIT_ADMIN_USERNAME ?? 'admin',
    initAdminPassword: process.env.INIT_ADMIN_PASSWORD ?? 'change-me-now',
    logLevel: process.env.LOG_LEVEL ?? 'info',
    maxUploadSize: parseSize(process.env.MAX_UPLOAD_SIZE ?? '10mb'),
    maxUploadFiles: Number(process.env.MAX_UPLOAD_FILES ?? 1),
  };
}
