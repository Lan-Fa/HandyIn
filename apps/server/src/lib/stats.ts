import { prisma } from '../prisma.js';
import { Errors } from '../errors.js';
import type { AssignmentStats } from '@handyin/types';

export async function getAssignmentStats(assignmentId: string): Promise<AssignmentStats> {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: { class: { include: { _count: { select: { students: true } } } } },
  });
  if (!assignment) throw Errors.notFound('作业');
  const submitted = await prisma.submission.count({ where: { assignmentId } });
  const total = assignment.class._count.students;
  return { assignmentId, total, submitted, unsubmitted: total - submitted };
}
