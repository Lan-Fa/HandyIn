import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { loginSchema } from '@handyin/validation';
import { prisma } from '../prisma.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { createSession, destroySession, SESSION_COOKIE } from '../lib/session.js';
import { Errors } from '../errors.js';
import { requireAuth } from '../plugins/auth.js';

function setSessionCookie(request: FastifyRequest, reply: FastifyReply, token: string, maxAgeMs: number): void {
  reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: request.server.config.cookieSecure,
    sameSite: 'lax',
    path: request.server.config.basePath || '/',
    maxAge: Math.floor(maxAgeMs / 1000),
  });
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/auth/login', {
    config: {
      rateLimit: {
        max: app.config.loginRateLimitMax,
        timeWindow: app.config.loginRateLimitWindow,
      },
    },
  }, async (request, reply) => {
    const body = loginSchema.safeParse(request.body);
    if (!body.success) {
      throw Errors.loginFailed();
    }

    const { username, password } = body.data;
    const user = await prisma.user.findUnique({ where: { username } });

    // 统一报错，不泄露用户是否存在
    if (!user || !(await verifyPassword(user.passwordHash, password))) {
      throw Errors.loginFailed();
    }

    const { token, expiresAt } = createSession({
      userId: user.id,
      role: user.role,
      username: user.username,
    });
    setSessionCookie(request, reply, token, expiresAt - Date.now());

    return reply.send({
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
      },
    });
  });

  app.post('/auth/logout', async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE];
    destroySession(token);
    reply.clearCookie(SESSION_COOKIE, { path: request.server.config.basePath || '/' });
    return reply.send({ ok: true });
  });

  app.get('/auth/me', { preHandler: requireAuth }, async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user!.id },
      select: { id: true, username: true, name: true, role: true },
    });
    if (!user) throw Errors.unauthorized();
    return reply.send({ user });
  });

  // 修改自己的密码
  app.post('/auth/password', { preHandler: requireAuth }, async (request, reply) => {
    const body = request.body as { currentPassword?: string; newPassword?: string };
    const newPassword = body?.newPassword;
    if (!newPassword || newPassword.length < 8 || newPassword.length > 256) {
      throw Errors.badRequest('新密码长度需在 8-256 位之间');
    }

    const user = await prisma.user.findUnique({ where: { id: request.user!.id } });
    if (!user) throw Errors.unauthorized();

    if (body.currentPassword && !(await verifyPassword(user.passwordHash, body.currentPassword))) {
      throw Errors.forbidden();
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(newPassword) },
    });

    // 修改密码后使当前会话失效，重新登录
    destroySession(request.cookies[SESSION_COOKIE]);

    return reply.send({ ok: true });
  });
}
