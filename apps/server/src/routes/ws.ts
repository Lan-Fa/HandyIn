import type { FastifyInstance } from 'fastify';
import type { FastifyRequest } from 'fastify';
import { prisma } from '../prisma.js';
import { subscribe, unsubscribe } from '../lib/realtime.js';

async function authorize(request: FastifyRequest): Promise<string | null> {
  const user = request.user;
  if (!user) return null;
  if (user.role === 'TEACHER') return user.id;

  const assignmentId = (request.query as { assignmentId?: string }).assignmentId;
  if (!assignmentId) return null;
  const grant = await prisma.assignmentRep.findUnique({
    where: { assignmentId_userId: { assignmentId, userId: user.id } },
  });
  if (!grant || (grant.expiresAt && grant.expiresAt.getTime() < Date.now())) return null;
  return user.id;
}

export async function wsRoutes(app: FastifyInstance): Promise<void> {
  await app.register(import('@fastify/websocket'));

  app.get('/ws', { websocket: true }, async (socket, request) => {
    const assignmentId = (request.query as { assignmentId?: string }).assignmentId;
    if (!assignmentId) {
      socket.close(4400, 'missing assignmentId');
      return;
    }

    const userId = await authorize(request);
    if (!userId) {
      socket.close(4401, 'unauthorized');
      return;
    }

    subscribe(assignmentId, socket);

    socket.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        if (message?.type === 'ping') {
          socket.send(JSON.stringify({ type: 'pong' }));
        }
      } catch {
        /* ignore invalid frames */
      }
    });

    socket.on('close', () => unsubscribe(assignmentId, socket));
    socket.on('error', () => unsubscribe(assignmentId, socket));
  });
}
