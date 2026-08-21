import type { FastifyInstance } from 'fastify';
import { repGrantSchema } from '@handyin/validation';
import { prisma } from '../prisma.js';
import { Errors } from '../errors.js';
import { requireTeacher } from '../plugins/auth.js';
import { assertClassMember } from '../lib/permissions.js';

export async function repRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireTeacher);

  app.get('/assignments/:id/reps', async (request) => {
    const { id } = request.params as { id: string };
    const assignment = await prisma.assignment.findUnique({ where: { id }, select: { classId: true } });
    if (!assignment) throw Errors.notFound('作业');
    await assertClassMember(request, assignment.classId);

    const reps = await prisma.assignmentRep.findMany({
      where: { assignmentId: id },
      include: { user: { select: { id: true, username: true, name: true, role: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return {
      reps: reps.map((r) => ({
        id: r.id,
        userId: r.user.id,
        username: r.user.username,
        name: r.user.name,
        expiresAt: r.expiresAt?.toISOString() ?? null,
        active: !r.expiresAt || r.expiresAt.getTime() > Date.now(),
      })),
    };
  });

  app.post('/assignments/:id/reps', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = repGrantSchema.safeParse(request.body);
    if (!body.success) throw Errors.badRequest(body.error.issues[0]?.message ?? '参数错误');

    const assignment = await prisma.assignment.findUnique({ where: { id } });
    if (!assignment) throw Errors.notFound('作业');
    await assertClassMember(request, assignment.classId);

    const user = await prisma.user.findUnique({ where: { id: body.data.userId } });
    if (!user) throw Errors.notFound('用户');
    if (user.role === 'TEACHER' && user.id === request.user!.id) {
      throw Errors.badRequest('教师无需授权');
    }

    const expiresAt = body.data.expiresAt ? new Date(body.data.expiresAt) : null;
    const rep = await prisma.assignmentRep.upsert({
      where: { assignmentId_userId: { assignmentId: id, userId: body.data.userId } },
      create: { assignmentId: id, userId: body.data.userId, expiresAt },
      update: { expiresAt },
    });

    await prisma.auditLog.create({
      data: {
        userId: request.user!.id,
        action: 'GRANT_REPRESENTATIVE',
        detail: JSON.stringify({ assignmentId: id, userId: body.data.userId }),
      },
    });

    return reply.status(201).send({
      rep: {
        id: rep.id,
        userId: rep.userId,
        expiresAt: rep.expiresAt?.toISOString() ?? null,
      },
    });
  });

  app.delete('/assignments/:id/reps/:userId', async (request) => {
    const { id, userId } = request.params as { id: string; userId: string };
    const assignment = await prisma.assignment.findUnique({ where: { id }, select: { classId: true } });
    if (!assignment) throw Errors.notFound('作业');
    await assertClassMember(request, assignment.classId);

    await prisma.assignmentRep.deleteMany({
      where: { assignmentId: id, userId },
    });

    await prisma.auditLog.create({
      data: {
        userId: request.user!.id,
        action: 'REVOKE_REPRESENTATIVE',
        detail: JSON.stringify({ assignmentId: id, userId }),
      },
    });

    return { ok: true };
  });
}
