import type { FastifyInstance } from 'fastify';
import { repClassAssignSchema } from '@handyin/validation';
import { prisma } from '../prisma.js';
import { Errors } from '../errors.js';
import { requireTeacher } from '../plugins/auth.js';
import { assertClassMember } from '../lib/permissions.js';

export async function repRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireTeacher);

  app.get('/classes/:id/reps', async (request) => {
    const { id } = request.params as { id: string };
    await assertClassMember(request, id);

    const reps = await prisma.repClass.findMany({
      where: { classId: id },
      include: { user: { select: { id: true, username: true, name: true, role: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return {
      reps: reps.map((r) => ({
        id: r.id,
        userId: r.user.id,
        username: r.user.username,
        name: r.user.name,
        role: r.user.role,
      })),
    };
  });

  app.post('/classes/:id/reps', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = repClassAssignSchema.safeParse(request.body);
    if (!body.success) throw Errors.badRequest(body.error.issues[0]?.message ?? '参数错误');

    const cls = await prisma.class.findUnique({ where: { id } });
    if (!cls) throw Errors.notFound('班级');
    await assertClassMember(request, id);

    const user = await prisma.user.findUnique({ where: { id: body.data.userId } });
    if (!user) throw Errors.notFound('用户');
    if (user.role !== 'REPRESENTATIVE') throw Errors.badRequest('只能分配课代表');

    const repClass = await prisma.repClass.upsert({
      where: { userId_classId: { userId: body.data.userId, classId: id } },
      create: { userId: body.data.userId, classId: id },
      update: {},
    });

    await prisma.auditLog.create({
      data: {
        userId: request.user!.id,
        action: 'ASSIGN_REP_CLASS',
        detail: JSON.stringify({ classId: id, userId: body.data.userId }),
      },
    });

    return reply.status(201).send({
      rep: { id: repClass.id, userId: repClass.userId, classId: repClass.classId },
    });
  });

  app.delete('/classes/:id/reps/:userId', async (request) => {
    const { id, userId } = request.params as { id: string; userId: string };
    await assertClassMember(request, id);

    await prisma.repClass.deleteMany({
      where: { classId: id, userId },
    });

    await prisma.auditLog.create({
      data: {
        userId: request.user!.id,
        action: 'REMOVE_REP_CLASS',
        detail: JSON.stringify({ classId: id, userId }),
      },
    });

    return { ok: true };
  });
}
