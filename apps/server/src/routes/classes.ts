import type { FastifyInstance } from 'fastify';
import { classCreateSchema, classUpdateSchema } from '@handyin/validation';
import type { ClassDto } from '@handyin/types';
import { prisma } from '../prisma.js';
import { Errors } from '../errors.js';
import { requireTeacher } from '../plugins/auth.js';

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
  app.addHook('preHandler', requireTeacher);

  app.get('/classes', async () => {
    const classes = await prisma.class.findMany({
      orderBy: [{ entryYear: 'desc' }, { department: 'asc' }, { classNumber: 'asc' }],
      include: { _count: { select: { students: true } } },
    });
    return { classes: classes.map(toDto) };
  });

  app.get('/classes/:id', async (request) => {
    const { id } = request.params as { id: string };
    const c = await prisma.class.findUnique({
      where: { id },
      include: { _count: { select: { students: true } } },
    });
    if (!c) throw Errors.notFound('班级');
    return { class: toDto(c) };
  });

  app.post('/classes', async (request, reply) => {
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

  app.put('/classes/:id', async (request) => {
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

  app.delete('/classes/:id', async (request) => {
    const { id } = request.params as { id: string };
    const studentCount = await prisma.student.count({ where: { classId: id } });
    if (studentCount > 0) {
      throw Errors.conflict('该班级下仍有学生，请先删除或转移学生');
    }
    await prisma.class.delete({ where: { id } });
    return { ok: true };
  });

  app.get('/classes/:id/students', async (request) => {
    const { id } = request.params as { id: string };
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
