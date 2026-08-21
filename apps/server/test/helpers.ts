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
  role: 'ADMIN' | 'TEACHER' | 'REPRESENTATIVE';
}

export interface AppState {
  app: FastifyInstance;
  admin: SeedUser;
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
    initAdminUsername: 'admin',
    initAdminPassword: 'test-password',
    logLevel: 'silent',
    maxUploadSize: 10 * 1024 * 1024,
    maxUploadFiles: 1,
  };
}

export function cookieFor(user: SeedUser): string {
  const { token } = createSession({ userId: user.id, role: user.role, username: user.username });
  return `handyin_session=${token}`;
}

export function adminCookie(): string {
  return cookieFor(state.admin);
}

export function teacherCookie(): string {
  return cookieFor(state.teacher);
}

export function repCookie(): string {
  return cookieFor(state.rep);
}

export async function seedUsers(): Promise<{ admin: SeedUser; teacher: SeedUser; rep: SeedUser }> {
  const admin = await prisma.user.create({
    data: { username: 'admin', passwordHash: await hashPassword('admin-pass-123'), role: 'ADMIN', name: '管理员' },
  });
  const teacher = await prisma.user.create({
    data: { username: 'teacher1', passwordHash: await hashPassword('teacher-pass-123'), role: 'TEACHER', name: '教师' },
  });
  const rep = await prisma.user.create({
    data: { username: 'rep1', passwordHash: await hashPassword('rep-pass-123'), role: 'REPRESENTATIVE', name: '课代表' },
  });
  return {
    admin: { id: admin.id, username: admin.username, role: 'ADMIN' },
    teacher: { id: teacher.id, username: teacher.username, role: 'TEACHER' },
    rep: { id: rep.id, username: rep.username, role: 'REPRESENTATIVE' },
  };
}

export async function resetData(): Promise<void> {
  await prisma.submission.deleteMany();
  await prisma.repClass.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.student.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.teacherClass.deleteMany();
  await prisma.class.deleteMany();
}

/** 管理员建班 + 教师自助加入，返回班级 id（供教师后续操作该班学生/作业）。 */
export async function createClassAndJoinTeacher(
  payload: { entryYear: number; department: string; classNumber: number } = {
    entryYear: 2026,
    department: '01',
    classNumber: 1,
  },
): Promise<{ id: string }> {
  const res = await state.app.inject({
    method: 'POST',
    url: `${API}/classes`,
    headers: { cookie: adminCookie() },
    payload,
  });
  const cls = res.json().class as { id: string };
  await state.app.inject({
    method: 'POST',
    url: `${API}/classes/${cls.id}/join`,
    headers: { cookie: teacherCookie() },
  });
  return cls;
}