import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { Role } from '@handyin/types';
import { getSession } from '../lib/session.js';
import { Errors } from '../errors.js';

declare module 'fastify' {
  interface FastifyRequest {
    user: { id: string; role: Role; username: string } | null;
  }
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!request.user) throw Errors.unauthorized();
}

export async function requireTeacher(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  // 教师与管理员均为「教职工」，可管理学生/作业/课代表
  if (!request.user) throw Errors.unauthorized();
  if (request.user.role !== 'TEACHER' && request.user.role !== 'ADMIN') throw Errors.forbidden();
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!request.user) throw Errors.unauthorized();
  if (request.user.role !== 'ADMIN') throw Errors.forbidden();
}

export async function requireCollector(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  // 教师与课代表均可扫码收集
  if (!request.user) throw Errors.unauthorized();
}

export async function authPlugin(app: FastifyInstance): Promise<void> {
  await app.register(import('@fastify/cookie'), {
    secret: app.config.sessionSecret,
    hook: 'onRequest',
    parseOptions: {},
  });

  app.addHook('onRequest', async (request) => {
    const token = request.cookies.handyin_session;
    const session = getSession(token);
    if (session) {
      request.user = { id: session.userId, role: session.role, username: session.username };
    } else {
      request.user = null;
    }
  });
}

export default fp(authPlugin, {
  name: 'handyin-auth',
  dependencies: [],
});
