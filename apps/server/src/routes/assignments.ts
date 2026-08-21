import type { FastifyInstance } from 'fastify';
import { assignmentCreateSchema, assignmentUpdateSchema } from '@handyin/validation';
import type { AssignmentDto, AssignmentStatus } from '@handyin/types';
import { prisma } from '../prisma.js';
import { Errors } from '../errors.js';
import { requireTeacher } from '../plugins/auth.js';
import { assertAssignmentOwner, assertClassMember, requireAssignmentCollector } from '../lib/permissions.js';

interface AssignmentWithClass {
  id: string;
  classId: string;
  title: string;
  description: string | null;
  createdById: string;
  status: AssignmentStatus;
  createdAt: Date;
  class: {
    id: string;
    entryYear: number;
    department: string;
    classNumber: number;
  };
}

function toDto(a: AssignmentWithClass, totalCount: number, submittedCount: number): AssignmentDto {
  return {
    id: a.id,
    classId: a.classId,
    title: a.title,
    description: a.description,
    createdById: a.createdById,
    status: a.status,
    createdAt: a.createdAt.toISOString(),
    totalCount,
    submittedCount,
  };
}

async function attachCounts(assignments: AssignmentWithClass[]) {
  if (assignments.length === 0) return [];
  const ids = assignments.map((a) => a.id);
  const classIds = [...new Set(assignments.map((a) => a.classId))];

  const [subGrouped, classGrouped] = await Promise.all([
    prisma.submission.groupBy({ by: ['assignmentId'], where: { assignmentId: { in: ids } }, _count: true }),
    prisma.student.groupBy({ by: ['classId'], where: { classId: { in: classIds } }, _count: true }),
  ]);

  const subCount = new Map(subGrouped.map((g) => [g.assignmentId, g._count]));
  const classCount = new Map(classGrouped.map((g) => [g.classId, g._count]));

  return assignments.map((a) =>
    toDto(a, classCount.get(a.classId) ?? 0, subCount.get(a.id) ?? 0),
  );
}

export async function assignmentRoutes(app: FastifyInstance): Promise<void> {
  app.get('/assignments', async (request) => {
    const user = request.user!;
    let assignments: AssignmentWithClass[];

    if (user.role === 'ADMIN') {
      assignments = await prisma.assignment.findMany({
        include: { class: true },
        orderBy: { createdAt: 'desc' },
      });
    } else if (user.role === 'TEACHER') {
      const memberships = await prisma.teacherClass.findMany({
        where: { teacherId: user.id },
        select: { classId: true },
      });
      const classIds = memberships.map((m) => m.classId);
      assignments = await prisma.assignment.findMany({
        where: { createdById: user.id, classId: { in: classIds } },
        include: { class: true },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      const grants = await prisma.assignmentRep.findMany({
        where: { userId: user.id },
        include: { assignment: { include: { class: true } } },
        orderBy: { createdAt: 'desc' },
      });
      assignments = grants
        .filter((g) => !g.expiresAt || g.expiresAt.getTime() > Date.now())
        .map((g) => g.assignment);
    }

    return { assignments: await attachCounts(assignments) };
  });

  app.get('/assignments/:id', { preHandler: requireAssignmentCollector }, async (request) => {
    const { id } = request.params as { id: string };
    const assignment = await prisma.assignment.findUnique({ where: { id }, include: { class: true } });
    if (!assignment) throw Errors.notFound('作业');
    const [submitted, total] = await Promise.all([
      prisma.submission.count({ where: { assignmentId: id } }),
      prisma.student.count({ where: { classId: assignment.classId } }),
    ]);
    return { assignment: toDto(assignment, total, submitted) };
  });

  app.post('/assignments', { preHandler: requireTeacher }, async (request, reply) => {
    const body = assignmentCreateSchema.safeParse(request.body);
    if (!body.success) throw Errors.badRequest(body.error.issues[0]?.message ?? '参数错误');

    const cls = await prisma.class.findUnique({ where: { id: body.data.classId } });
    if (!cls) throw Errors.notFound('班级');
    await assertClassMember(request, body.data.classId);

    const assignment = await prisma.assignment.create({
      data: {
        classId: body.data.classId,
        title: body.data.title,
        description: body.data.description ?? null,
        createdById: request.user!.id,
      },
      include: { class: true },
    });

    return reply.status(201).send({ assignment: toDto(assignment, 0, 0) });
  });

  app.put('/assignments/:id', { preHandler: requireTeacher }, async (request) => {
    const { id } = request.params as { id: string };
    const body = assignmentUpdateSchema.safeParse(request.body);
    if (!body.success) throw Errors.badRequest(body.error.issues[0]?.message ?? '参数错误');

    const existing = await prisma.assignment.findUnique({ where: { id } });
    if (!existing) throw Errors.notFound('作业');
    await assertAssignmentOwner(request, id);

    const assignment = await prisma.assignment.update({
      where: { id },
      data: body.data,
      include: { class: true },
    });
    const [submitted, total] = await Promise.all([
      prisma.submission.count({ where: { assignmentId: id } }),
      prisma.student.count({ where: { classId: assignment.classId } }),
    ]);
    return { assignment: toDto(assignment, total, submitted) };
  });

  app.delete('/assignments/:id', { preHandler: requireTeacher }, async (request) => {
    const { id } = request.params as { id: string };
    const existing = await prisma.assignment.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw Errors.notFound('作业');
    await assertAssignmentOwner(request, id);
    await prisma.assignment.delete({ where: { id } });
    return { ok: true };
  });

  app.get('/assignments/:id/stats', { preHandler: requireAssignmentCollector }, async (request) => {
    const { id } = request.params as { id: string };
    const assignment = await prisma.assignment.findUnique({
      where: { id },
      include: { class: { include: { students: { orderBy: { numberInClass: 'asc' } } } } },
    });
    if (!assignment) throw Errors.notFound('作业');

    const submissions = await prisma.submission.findMany({
      where: { assignmentId: id },
      include: { student: true, operator: true },
    });
    const submittedMap = new Map(submissions.map((s) => [s.studentId, s]));

    const submittedList = assignment.class.students
      .filter((s) => submittedMap.has(s.id))
      .map((s) => {
        const sub = submittedMap.get(s.id)!;
        return {
          studentId: s.id,
          name: s.name,
          studentNumber: s.studentNumber,
          numberInClass: s.numberInClass,
          submittedAt: sub.submittedAt.toISOString(),
          operatorName: sub.operator.name ?? sub.operator.username,
          submissionId: sub.id,
        };
      });

    const unsubmittedList = assignment.class.students
      .filter((s) => !submittedMap.has(s.id))
      .map((s) => ({
        studentId: s.id,
        name: s.name,
        studentNumber: s.studentNumber,
        numberInClass: s.numberInClass,
      }));

    return {
      stats: {
        assignmentId: id,
        total: assignment.class.students.length,
        submitted: submittedList.length,
        unsubmitted: unsubmittedList.length,
      },
      submitted: submittedList,
      unsubmitted: unsubmittedList,
    };
  });
}
