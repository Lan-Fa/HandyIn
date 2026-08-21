import type { FastifyInstance } from 'fastify';
import { submissionCreateSchema, submissionManualSchema } from '@handyin/validation';
import type { AssignmentStats } from '@handyin/types';
import { prisma } from '../prisma.js';
import { Errors } from '../errors.js';
import { assertAssignmentOwner, requireAssignmentCollector } from '../lib/permissions.js';
import { requireTeacher } from '../plugins/auth.js';
import { parseQrContent } from '../lib/qrcode.js';
import { getAssignmentStats } from '../lib/stats.js';
import { broadcast } from '../lib/realtime.js';

function isUniqueError(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2002';
}

interface SubmissionStudent {
  id: string;
  name: string;
  studentNumber: string;
  numberInClass: number;
}

interface RecordedSubmission {
  status: 'submitted' | 'duplicate';
  submittedAt: Date;
  operatorName: string;
  stats: AssignmentStats;
}

async function recordSubmission(
  assignmentId: string,
  student: SubmissionStudent,
  operatorId: string,
): Promise<RecordedSubmission> {
  const operator = await prisma.user.findUnique({
    where: { id: operatorId },
    select: { id: true, name: true, username: true },
  });
  const operatorName = operator?.name ?? operator?.username ?? '';

  const studentPayload = {
    id: student.id,
    name: student.name,
    studentNumber: student.studentNumber,
    numberInClass: student.numberInClass,
  };

  const existing = await prisma.submission.findUnique({
    where: { assignmentId_studentId: { assignmentId, studentId: student.id } },
  });
  if (existing) {
    const stats = await getAssignmentStats(assignmentId);
    return { status: 'duplicate', submittedAt: existing.submittedAt, operatorName, stats };
  }

  try {
    const submission = await prisma.submission.create({
      data: { assignmentId, studentId: student.id, operatorId },
    });
    const stats = await getAssignmentStats(assignmentId);
    broadcast(assignmentId, {
      type: 'submission',
      status: 'submitted',
      student: studentPayload,
      submittedAt: submission.submittedAt.toISOString(),
      operatorName,
      stats,
    });
    return { status: 'submitted', submittedAt: submission.submittedAt, operatorName, stats };
  } catch (e) {
    if (isUniqueError(e)) {
      const dup = await prisma.submission.findUnique({
        where: { assignmentId_studentId: { assignmentId, studentId: student.id } },
      });
      const stats = await getAssignmentStats(assignmentId);
      return { status: 'duplicate', submittedAt: dup!.submittedAt, operatorName, stats };
    }
    throw e;
  }
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

    const result = await recordSubmission(assignmentId, student, request.user!.id);

    return reply.send({
      status: result.status,
      student: {
        id: student.id,
        name: student.name,
        studentNumber: student.studentNumber,
        numberInClass: student.numberInClass,
      },
      submittedAt: result.submittedAt.toISOString(),
      operatorName: result.operatorName,
      stats: result.stats,
    });
  });

  app.post('/submissions/manual', { preHandler: requireAssignmentCollector }, async (request, reply) => {
    const body = submissionManualSchema.safeParse(request.body);
    if (!body.success) throw Errors.badRequest(body.error.issues[0]?.message ?? '参数错误');

    const { assignmentId, studentId } = body.data;

    const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId } });
    if (!assignment) throw Errors.notFound('作业');

    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student) throw Errors.notFound('学生');

    if (student.classId !== assignment.classId) {
      throw Errors.badRequest('该学生不属于本作业的班级');
    }

    const result = await recordSubmission(assignmentId, student, request.user!.id);

    if (result.status === 'submitted') {
      await prisma.auditLog.create({
        data: {
          userId: request.user!.id,
          action: 'MANUAL_SUBMIT',
          detail: JSON.stringify({ assignmentId, studentNumber: student.studentNumber }),
        },
      });
    }

    return reply.send({
      status: result.status,
      student: {
        id: student.id,
        name: student.name,
        studentNumber: student.studentNumber,
        numberInClass: student.numberInClass,
      },
      submittedAt: result.submittedAt.toISOString(),
      operatorName: result.operatorName,
      stats: result.stats,
    });
  });

  app.delete('/submissions/:id', { preHandler: requireTeacher }, async (request) => {
    const { id } = request.params as { id: string };
    const existing = await prisma.submission.findUnique({
      where: { id },
      include: { student: true, assignment: true },
    });
    if (!existing) throw Errors.notFound('收取记录');
    await assertAssignmentOwner(request, existing.assignmentId);

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
