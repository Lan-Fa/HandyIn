import type { FastifyInstance } from 'fastify';
import { submissionCreateSchema } from '@handyin/validation';
import { prisma } from '../prisma.js';
import { Errors } from '../errors.js';
import { requireAssignmentCollector, assertClassMember } from '../lib/permissions.js';
import { requireTeacher } from '../plugins/auth.js';
import { parseQrContent } from '../lib/qrcode.js';
import { getAssignmentStats } from '../lib/stats.js';
import { broadcast } from '../lib/realtime.js';

function isUniqueError(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2002';
}

export async function submissionRoutes(app: FastifyInstance): Promise<void> {
  app.post('/submissions', { preHandler: requireAssignmentCollector }, async (request, reply) => {
    const body = submissionCreateSchema.safeParse(request.body);
    if (!body.success) throw Errors.badRequest(body.error.issues[0]?.message ?? '参数错误');

    const { assignmentId, qrToken } = body.data;

    const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId } });
    if (!assignment) throw Errors.notFound('作业');

    let token = qrToken;
    const parsed = parseQrContent(qrToken);
    if (parsed) token = parsed;

    const student = await prisma.student.findUnique({ where: { qrToken: token } });
    if (!student) throw Errors.badRequest('无法识别二维码');

    if (student.classId !== assignment.classId) {
      throw Errors.badRequest('该学生不属于本作业的班级');
    }

    const operator = await prisma.user.findUnique({
      where: { id: request.user!.id },
      select: { id: true, name: true, username: true },
    });

    const makeResponse = (status: 'submitted' | 'duplicate', submittedAt: Date) => {
      return {
        status,
        student: {
          id: student.id,
          name: student.name,
          studentNumber: student.studentNumber,
          numberInClass: student.numberInClass,
        },
        submittedAt: submittedAt.toISOString(),
        operatorName: operator?.name ?? operator?.username ?? '',
      };
    };

    const existing = await prisma.submission.findUnique({
      where: { assignmentId_studentId: { assignmentId, studentId: student.id } },
    });
    if (existing) {
      const stats = await getAssignmentStats(assignmentId);
      return reply.send({ ...makeResponse('duplicate', existing.submittedAt), stats });
    }

    try {
      const submission = await prisma.submission.create({
        data: { assignmentId, studentId: student.id, operatorId: request.user!.id },
      });
      const stats = await getAssignmentStats(assignmentId);
      const payload = {
        type: 'submission',
        status: 'submitted',
        student: {
          id: student.id,
          name: student.name,
          studentNumber: student.studentNumber,
          numberInClass: student.numberInClass,
        },
        submittedAt: submission.submittedAt.toISOString(),
        operatorName: operator?.name ?? operator?.username ?? '',
        stats,
      };
      broadcast(assignmentId, payload);
      return reply.send({ ...makeResponse('submitted', submission.submittedAt), stats });
    } catch (e) {
      if (isUniqueError(e)) {
        const dup = await prisma.submission.findUnique({
          where: { assignmentId_studentId: { assignmentId, studentId: student.id } },
        });
        const stats = await getAssignmentStats(assignmentId);
        return reply.send({
          ...makeResponse('duplicate', dup!.submittedAt),
          stats,
        });
      }
      throw e;
    }
  });

  app.delete('/submissions/:id', { preHandler: requireTeacher }, async (request) => {
    const { id } = request.params as { id: string };
    const existing = await prisma.submission.findUnique({
      where: { id },
      include: { student: true, assignment: true },
    });
    if (!existing) throw Errors.notFound('收取记录');
    await assertClassMember(request, existing.assignment.classId);

    await prisma.submission.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        userId: request.user!.id,
        action: 'DELETE_SUBMISSION',
        detail: JSON.stringify({
          assignmentId: existing.assignmentId,
          studentNumber: existing.student.studentNumber,
        }),
      },
    });

    const stats = await getAssignmentStats(existing.assignmentId);
    broadcast(existing.assignmentId, {
      type: 'submission_deleted',
      studentId: existing.studentId,
      stats,
    });
    return { ok: true, stats };
  });
}
