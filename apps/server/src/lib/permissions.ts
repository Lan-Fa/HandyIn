import type { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../prisma.js';
import { Errors } from '../errors.js';

function extractAssignmentId(request: FastifyRequest): string | undefined {
  const params = request.params as Record<string, string> | undefined;
  if (params?.assignmentId) return params.assignmentId;
  if (params?.id) return params.id;
  const body = request.body as Record<string, unknown> | undefined;
  if (body && typeof body.assignmentId === 'string') return body.assignmentId;
  return undefined;
}

export async function requireAssignmentCollector(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const user = request.user;
  if (!user) throw Errors.unauthorized();
  if (user.role === 'TEACHER') return;

  const assignmentId = extractAssignmentId(request);
  if (!assignmentId) throw Errors.forbidden();

  const grant = await prisma.assignmentRep.findUnique({
    where: { assignmentId_userId: { assignmentId, userId: user.id } },
  });
  if (!grant || (grant.expiresAt && grant.expiresAt.getTime() < Date.now())) {
    throw Errors.forbidden();
  }
}
