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

// 校验当前用户是该班级的成员（教师需先加入班级；管理员放行）
export async function assertClassMember(request: FastifyRequest, classId: string): Promise<void> {
  const user = request.user;
  if (!user) throw Errors.unauthorized();
  if (user.role === 'ADMIN') return;

  const membership = await prisma.teacherClass.findUnique({
    where: { teacherId_classId: { teacherId: user.id, classId } },
  });
  if (!membership) throw Errors.forbidden();
}

// 校验当前用户是该作业的布置者（教师本人 + 仍是班级成员；管理员放行）
export async function assertAssignmentOwner(request: FastifyRequest, assignmentId: string): Promise<void> {
  const user = request.user;
  if (!user) throw Errors.unauthorized();
  if (user.role === 'ADMIN') return;

  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: { createdById: true, classId: true },
  });
  if (!assignment || assignment.createdById !== user.id) throw Errors.forbidden();
  await assertClassMember(request, assignment.classId);
}

export async function requireAssignmentCollector(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const user = request.user;
  if (!user) throw Errors.unauthorized();
  if (user.role === 'ADMIN') return;

  const assignmentId = extractAssignmentId(request);
  if (!assignmentId) throw Errors.forbidden();

  if (user.role === 'TEACHER') {
    await assertAssignmentOwner(request, assignmentId);
    return;
  }

  const grant = await prisma.assignmentRep.findUnique({
    where: { assignmentId_userId: { assignmentId, userId: user.id } },
  });
  if (!grant || (grant.expiresAt && grant.expiresAt.getTime() < Date.now())) {
    throw Errors.forbidden();
  }
}