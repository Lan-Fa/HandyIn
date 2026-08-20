import type { FastifyInstance } from 'fastify';
import { userCreateSchema, userUpdateSchema } from '@handyin/validation';
import type { Role } from '@handyin/types';
import { prisma } from '../prisma.js';
import { Errors } from '../errors.js';
import { requireTeacher } from '../plugins/auth.js';
import { hashPassword } from '../lib/password.js';

export async function userRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireTeacher);

  app.get('/users', async () => {
    const users = await prisma.user.findMany({
      select: { id: true, username: true, name: true, role: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    return {
      users: users.map((u) => ({
        id: u.id,
        username: u.username,
        name: u.name,
        role: u.role as Role,
        createdAt: u.createdAt.toISOString(),
      })),
    };
  });

  app.post('/users', async (request, reply) => {
    const body = userCreateSchema.safeParse(request.body);
    if (!body.success) throw Errors.badRequest(body.error.issues[0]?.message ?? '参数错误');

    const existing = await prisma.user.findUnique({ where: { username: body.data.username } });
    if (existing) throw Errors.conflict('用户名已存在');

    const user = await prisma.user.create({
      data: {
        username: body.data.username,
        passwordHash: await hashPassword(body.data.password),
        name: body.data.name ?? null,
        role: body.data.role,
      },
      select: { id: true, username: true, name: true, role: true, createdAt: true },
    });

    return reply.status(201).send({
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role as Role,
        createdAt: user.createdAt.toISOString(),
      },
    });
  });

  app.put('/users/:id', async (request) => {
    const { id } = request.params as { id: string };
    const body = userUpdateSchema.safeParse(request.body);
    if (!body.success) throw Errors.badRequest(body.error.issues[0]?.message ?? '参数错误');

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw Errors.notFound('用户');

    const data: Record<string, unknown> = {};
    if (body.data.name !== undefined) data.name = body.data.name;
    if (body.data.role !== undefined) data.role = body.data.role;
    if (body.data.password) data.passwordHash = await hashPassword(body.data.password);

    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, username: true, name: true, role: true, createdAt: true },
    });

    return {
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role as Role,
        createdAt: user.createdAt.toISOString(),
      },
    };
  });

  app.delete('/users/:id', async (request) => {
    const { id } = request.params as { id: string };
    if (id === request.user!.id) throw Errors.badRequest('不能删除自己');

    await prisma.user.delete({ where: { id } });
    return { ok: true };
  });
}
