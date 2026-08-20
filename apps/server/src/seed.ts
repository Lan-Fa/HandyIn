import type { Config } from './config.js';
import { prisma } from './prisma.js';
import { hashPassword } from './lib/password.js';

export async function ensureInitTeacher(config: Config): Promise<void> {
  const existing = await prisma.user.findUnique({
    where: { username: config.initTeacherUsername },
  });
  if (existing) return;

  await prisma.user.create({
    data: {
      username: config.initTeacherUsername,
      passwordHash: await hashPassword(config.initTeacherPassword),
      role: 'TEACHER',
      name: '管理员',
    },
  });
}
