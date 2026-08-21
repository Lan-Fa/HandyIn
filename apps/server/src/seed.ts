import type { Config } from './config.js';
import { prisma } from './prisma.js';
import { hashPassword } from './lib/password.js';

export async function ensureInitAdmin(config: Config): Promise<void> {
  const existing = await prisma.user.findUnique({
    where: { username: config.initAdminUsername },
  });

  if (existing) {
    if (existing.role !== 'ADMIN') {
      await prisma.user.update({ where: { id: existing.id }, data: { role: 'ADMIN' } });
    }
    return;
  }

  await prisma.user.create({
    data: {
      username: config.initAdminUsername,
      passwordHash: await hashPassword(config.initAdminPassword),
      role: 'ADMIN',
      name: '管理员',
    },
  });
}