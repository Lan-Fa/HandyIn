import { afterAll, beforeAll, beforeEach } from 'vitest';
import { buildApp } from '../src/index.js';
import { prisma } from '../src/prisma.js';
import { resetData, seedUsers, state, testConfig } from './helpers.js';

beforeAll(async () => {
  state.app = await buildApp(testConfig());
  await state.app.ready();
  const { teacher, rep } = await seedUsers();
  state.teacher = teacher;
  state.rep = rep;
});

beforeEach(async () => {
  await resetData();
});

afterAll(async () => {
  await state.app?.close();
  await prisma.$disconnect();
});