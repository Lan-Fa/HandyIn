import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveWebRoot(): string | null {
  const fromEnv = process.env.WEB_DIST;
  if (fromEnv) {
    const p = path.resolve(fromEnv);
    if (fs.existsSync(path.join(p, 'index.html'))) return p;
  }
  const candidates = [
    path.resolve(__dirname, '../../web/dist'),
    path.resolve(process.cwd(), 'apps/web/dist'),
    path.resolve(process.cwd(), 'web/dist'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'index.html'))) return c;
  }
  return null;
}

async function staticPlugin(app: FastifyInstance): Promise<void> {
  const webRoot = resolveWebRoot();
  if (!webRoot) return;

  const base = app.config.basePath;

  await app.register(import('@fastify/static'), {
    root: webRoot,
    prefix: `${base}/`,
    index: ['index.html'],
  });

  app.setNotFoundHandler((request, reply) => {
    const url = request.url;
    const isWeb =
      request.method === 'GET' &&
      (url === base || url === `${base}/` || url.startsWith(`${base}/`)) &&
      !url.startsWith(`${base}/api`) &&
      !url.startsWith(`${base}/ws`);

    if (isWeb) {
      return reply.sendFile('index.html', webRoot);
    }
    return reply.status(404).send({ error: 'NOT_FOUND', message: '资源不存在' });
  });
}

export default fp(staticPlugin, { name: 'handyin-static' });
