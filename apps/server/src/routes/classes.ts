import type { FastifyInstance } from 'fastify';
import { classBatchCreateSchema, classCreateSchema, classUpdateSchema } from '@handyin/validation';
import type { ClassDto, DepartmentCode, JoinableClassDto } from '@handyin/types';
import { prisma } from '../prisma.js';
import { Errors } from '../errors.js';
import { requireAdmin, requireAuth, requireTeacher } from '../plugins/auth.js';
import { assertClassMember } from '../lib/permissions.js';

function toDto(c: {
  id: string;
  entryYear: number;
  department: string;
  classNumber: number;
  _count?: { students: number };
}): ClassDto {
  return {
    id: c.id,
    entryYear: c.entryYear,
    department: c.department as ClassDto['department'],
    classNumber: c.classNumber,
    studentCount: c._count?.students ?? 0,
  };
}

export async function classRoutes(app: FastifyInstance): Promise<void> {
  // 管理员/教师/课代表均可查看班级；教师返回已加入，课代表返回所属班级
  app.get('/classes', { preHandler: requireAuth }, async (request) => {
    const user = request.user!;
    if (user.role === 'ADMIN') {
      const classes = await prisma.class.findMany({
        orderBy: [{ entryYear: 'desc' }, { department: 'asc' }, { classNumber: 'asc' }],
        include: { _count: { select: { students: true } } },
      });
      return { classes: classes.map(toDto) };
    }

    if (user.role === 'TEACHER') {
      const memberships = await prisma.teacherClass.findMany({
        where: { teacherId: user.id },
        include: { class: { include: { _count: { select: { students: true } } } } },
        orderBy: [
          { class: { entryYear: 'desc' } },
          { class: { department: 'asc' } },
          { class: { classNumber: 'asc' } },
        ],
      });
      return { classes: memberships.map((m) => toDto(m.class)) };
    }

    const memberships = await prisma.repClass.findMany({
      where: { userId: user.id },
      include: { class: { include: { _count: { select: { students: true } } } } },
      orderBy: [
        { class: { entryYear: 'desc' } },
        { class: { department: 'asc' } },
        { class: { classNumber: 'asc' } },
      ],
    });
    return { classes: memberships.map((m) => toDto(m.class)) };
  });

  // 供教师浏览全部班级并自主加入
  app.get('/classes/available', { preHandler: requireTeacher }, async (request) => {
    const user = request.user!;
    const classes = await prisma.class.findMany({
      orderBy: [{ entryYear: 'desc' }, { department: 'asc' }, { classNumber: 'asc' }],
      include: { _count: { select: { students: true } } },
    });
    const memberships = await prisma.teacherClass.findMany({
      where: { teacherId: user.id },
      select: { classId: true },
    });
    const joined = new Set(memberships.map((m) => m.classId));
    const result: JoinableClassDto[] = classes.map((c) => ({ ...toDto(c), joined: joined.has(c.id) }));
    return { classes: result };
  });

  // 教师自助加入班级（需先存在班级，由管理员创建）
  app.post('/classes/:id/join', { preHandler: requireTeacher }, async (request, reply) => {
    const user = request.user!;
    if (user.role !== 'TEACHER') throw Errors.forbidden();

    const { id } = request.params as { id: string };
    const cls = await prisma.class.findUnique({ where: { id } });
    if (!cls) throw Errors.notFound('班级');

    await prisma.teacherClass.upsert({
      where: { teacherId_classId: { teacherId: user.id, classId: id } },
      create: { teacherId: user.id, classId: id },
      update: {},
    });
    return reply.status(201).send({ ok: true });
  });

  // 教师退出班级
  app.delete('/classes/:id/join', { preHandler: requireTeacher }, async (request) => {
    const user = request.user!;
    if (user.role !== 'TEACHER') throw Errors.forbidden();

    const { id } = request.params as { id: string };
    await prisma.teacherClass.deleteMany({ where: { teacherId: user.id, classId: id } });
    return { ok: true };
  });

  app.get('/classes/:id', { preHandler: requireTeacher }, async (request) => {
    const { id } = request.params as { id: string };
    await assertClassMember(request, id);
    const c = await prisma.class.findUnique({
      where: { id },
      include: { _count: { select: { students: true } } },
    });
    if (!c) throw Errors.notFound('班级');
    return { class: toDto(c) };
  });

  app.post('/classes', { preHandler: requireAdmin }, async (request, reply) => {
    const body = classCreateSchema.safeParse(request.body);
    if (!body.success) throw Errors.badRequest(body.error.issues[0]?.message ?? '参数错误');

    const { entryYear, department, classNumber } = body.data;
    const existing = await prisma.class.findUnique({
      where: { entryYear_department_classNumber: { entryYear, department, classNumber } },
    });
    if (existing) throw Errors.conflict('该班级已存在');

    const c = await prisma.class.create({ data: { entryYear, department, classNumber } });
    return reply.status(201).send({ class: toDto(c) });
  });

  app.post('/classes/batch', { preHandler: requireAdmin }, async (request, reply) => {
    const body = classBatchCreateSchema.safeParse(request.body);
    if (!body.success) throw Errors.badRequest(body.error.issues[0]?.message ?? '参数错误');

    const { entryYear, department, count, startFrom } = body.data;

    const { created, skipped } = await prisma.$transaction(async (tx) => {
      const created: { entryYear: number; department: DepartmentCode; classNumber: number }[] = [];
      const skipped: { entryYear: number; department: DepartmentCode; classNumber: number }[] = [];
      for (let i = 0; i < count; i++) {
        const classNumber = startFrom + i;
        const existing = await tx.class.findUnique({
          where: { entryYear_department_classNumber: { entryYear, department, classNumber } },
        });
        if (existing) {
          skipped.push({ entryYear, department, classNumber });
          continue;
        }
        await tx.class.create({ data: { entryYear, department, classNumber } });
        created.push({ entryYear, department, classNumber });
      }
      return { created, skipped };
    });

    return reply.status(201).send({
      result: { created, skipped, total: created.length, skippedCount: skipped.length },
    });
  });

  app.put('/classes/:id', { preHandler: requireAdmin }, async (request) => {
    const { id } = request.params as { id: string };
    const body = classUpdateSchema.safeParse(request.body);
    if (!body.success) throw Errors.badRequest(body.error.issues[0]?.message ?? '参数错误');

    const { entryYear, department, classNumber } = body.data;
    const dup = await prisma.class.findUnique({
      where: { entryYear_department_classNumber: { entryYear, department, classNumber } },
    });
    if (dup && dup.id !== id) throw Errors.conflict('该班级已存在');

    const c = await prisma.class.update({ where: { id }, data: { entryYear, department, classNumber } });
    return { class: toDto(c) };
  });

  app.delete('/classes/:id', { preHandler: requireAdmin }, async (request) => {
    const { id } = request.params as { id: string };
    const studentCount = await prisma.student.count({ where: { classId: id } });
    if (studentCount > 0) {
      throw Errors.conflict('该班级下仍有学生，请先删除或转移学生');
    }
    await prisma.class.delete({ where: { id } });
    return { ok: true };
  });

  app.get('/classes/:id/students', { preHandler: requireTeacher }, async (request) => {
    const { id } = request.params as { id: string };
    await assertClassMember(request, id);
    const students = await prisma.student.findMany({
      where: { classId: id },
      orderBy: { numberInClass: 'asc' },
    });
    return {
      students: students.map((s) => ({
        id: s.id,
        name: s.name,
        studentNumber: s.studentNumber,
        entryYear: s.entryYear,
        department: s.department,
        classNumber: s.classNumber,
        numberInClass: s.numberInClass,
        qrToken: s.qrToken,
        classId: s.classId,
        createdAt: s.createdAt.toISOString(),
      })),
    };
  });
}