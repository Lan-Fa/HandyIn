import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import { loadConfig, type Config } from './config.js';
import { prisma } from './prisma.js';
import { AppError } from './errors.js';
import authPlugin from './plugins/auth.js';
import { authRoutes } from './routes/auth.js';
import { ensureInitTeacher } from './seed.js';
import { cleanupSessions } from './lib/session.js';

export async function buildApp(config: Config = loadConfig()): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: config.logLevel },
    trustProxy: true,
  });

  app.decorate('config', config);

  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({ error: error.code, message: error.message });
    }
    if (error.validation) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: error.message });
    }
    const statusCode = typeof error.statusCode === 'number' ? error.statusCode : 500;
    if (statusCode === 429) {
      return reply.status(429).send({ error: 'TOO_MANY_REQUESTS', message: '请求过于频繁，请稍后再试' });
    }
    if (statusCode >= 400 && statusCode < 500) {
      return reply.status(statusCode).send({ error: 'REQUEST_ERROR', message: error.message });
    }
    request.log.error(error);
    return reply.status(500).send({ error: 'INTERNAL', message: '服务器内部错误' });
  });

  await app.register(import('@fastify/cors'), {
    origin: true,
    credentials: true,
  });

  await app.register(import('@fastify/rate-limit'), {
    global: true,
    max: 1000,
    timeWindow: '1 minute',
  });

  await app.register(authPlugin);

  app.get('/healthz', async () => ({ ok: true }));

  const apiPrefix = `${config.basePath}/api`;
  await app.register(authRoutes, { prefix: apiPrefix });

  return app;
}

async function main(): Promise<void> {
  const config = loadConfig();
  await ensureInitTeacher(config);

  const app = await buildApp(config);

  const interval = setInterval(cleanupSessions, 60 * 60 * 1000);
  interval.unref();

  const shutdown = async () => {
    app.log.info('shutting down');
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await app.listen({ port: config.port, host: config.host });
}

if (process.env.NODE_ENV !== 'test') {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
