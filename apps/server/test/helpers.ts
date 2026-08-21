import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/index.js';
import { prisma } from '../src/prisma.js';
import { hashPassword } from '../src/lib/password.js';
import { createSession } from '../src/lib/session.js';
import type { Config } from '../src/config.js';

export const BASE = '/handyin';
export const API = `${BASE}/api`;

export interface SeedUser {
  id: string;
  username: string;
  role: 'TEACHER' | 'REPRESENTATIVE';
}

export interface AppState {
  app: FastifyInstance;
  teacher: SeedUser;
  rep: SeedUser;
}

export const state: AppState = {} as AppState;

export function testConfig(): Config {
  return {
    basePath: BASE,
    port: 3000,
    host: '0.0.0.0',
    cookieSecure: false,
    sessionSecret: 'test-secret',
    loginRateLimitMax: 100,
    loginRateLimitWindow: '1 minute',
    initTeacherUsername: 'admin',
    initTeacherPassword: 'test-password',
    logLevel: 'silent',
    maxUploadSize: 10 * 1024 * 1024,
    maxUploadFiles: 1,
  };
}

export function cookieFor(user: SeedUser): string {
  const { token } = createSession({ userId: user.id, role: user.role, username: user.username });
  return `handyin_session=${token}`;
}

export function teacherCookie(): string {
  return cookieFor(state.teacher);
}

export function repCookie(): string {
  return cookieFor(state.rep);
}

export async function seedUsers(): Promise<{ teacher: SeedUser; rep: SeedUser }> {
  const teacher = await prisma.user.create({
    data: { username: 'admin', passwordHash: await hashPassword('admin-pass-123'), role: 'TEACHER', name: '管理员' },
  });
  const rep = await prisma.user.create({
    data: { username: 'rep1', passwordHash: await hashPassword('rep-pass-123'), role: 'REPRESENTATIVE', name: '课代表' },
  });
  return {
    teacher: { id: teacher.id, username: teacher.username, role: 'TEACHER' },
    rep: { id: rep.id, username: rep.username, role: 'REPRESENTATIVE' },
  };
}

export async function resetData(): Promise<void> {
  await prisma.submission.deleteMany();
  await prisma.assignmentRep.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.student.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.class.deleteMany();
}