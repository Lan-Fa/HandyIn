import { describe, expect, it } from 'vitest';
import { prisma } from '../src/prisma.js';
import { hashPassword } from '../src/lib/password.js';
import { API, adminCookie, cookieFor, state, teacherCookie } from './helpers.js';

async function ensureTeacher2() {
  const u = await prisma.user.upsert({
    where: { username: 'owner_teacher2' },
    create: {
      username: 'owner_teacher2',
      passwordHash: await hashPassword('teacher2-pass-123'),
      role: 'TEACHER',
      name: '教师2',
    },
    update: {},
  });
  return cookieFor({ id: u.id, username: u.username, role: 'TEACHER' });
}

async function setupOwnedAssignment() {
  const cls = await state.app.inject({
    method: 'POST',
    url: `${API}/classes`,
    headers: { cookie: adminCookie() },
    payload: { entryYear: 2026, department: '01', classNumber: 1 },
  });
  const classId = cls.json().class.id;
  await state.app.inject({
    method: 'POST',
    url: `${API}/classes/${classId}/join`,
    headers: { cookie: teacherCookie() },
  });
  const asg = await state.app.inject({
    method: 'POST',
    url: `${API}/assignments`,
    headers: { cookie: teacherCookie() },
    payload: { classId, title: '数学作业' },
  });
  const assignmentId = asg.json().assignment.id;
  const stu = await state.app.inject({
    method: 'POST',
    url: `${API}/students`,
    headers: { cookie: teacherCookie() },
    payload: { name: '张三', classId, numberInClass: 1 },
  });
  const qrToken = stu.json().student.qrToken;
  return { classId, assignmentId, qrToken };
}

describe('作业归属（教师仅能操作自己布置的作业）', () => {
  it('同班非布置者老师看不到他人作业列表', async () => {
    const { classId, assignmentId } = await setupOwnedAssignment();
    const t2 = await ensureTeacher2();
    await state.app.inject({
      method: 'POST',
      url: `${API}/classes/${classId}/join`,
      headers: { cookie: t2 },
    });

    const res = await state.app.inject({
      method: 'GET',
      url: `${API}/assignments`,
      headers: { cookie: t2 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().assignments).toHaveLength(0);
    void assignmentId;
  });

  it('同班非布置者老师访问他人作业详情返回 403', async () => {
    const { classId, assignmentId } = await setupOwnedAssignment();
    const t2 = await ensureTeacher2();
    await state.app.inject({
      method: 'POST',
      url: `${API}/classes/${classId}/join`,
      headers: { cookie: t2 },
    });

    const res = await state.app.inject({
      method: 'GET',
      url: `${API}/assignments/${assignmentId}`,
      headers: { cookie: t2 },
    });
    expect(res.statusCode).toBe(403);
  });

  it('同班非布置者老师编辑他人作业返回 403', async () => {
    const { classId, assignmentId } = await setupOwnedAssignment();
    const t2 = await ensureTeacher2();
    await state.app.inject({
      method: 'POST',
      url: `${API}/classes/${classId}/join`,
      headers: { cookie: t2 },
    });

    const res = await state.app.inject({
      method: 'PUT',
      url: `${API}/assignments/${assignmentId}`,
      headers: { cookie: t2 },
      payload: { status: 'COLLECTING' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('同班非布置者老师删除他人作业返回 403', async () => {
    const { classId, assignmentId } = await setupOwnedAssignment();
    const t2 = await ensureTeacher2();
    await state.app.inject({
      method: 'POST',
      url: `${API}/classes/${classId}/join`,
      headers: { cookie: t2 },
    });

    const res = await state.app.inject({
      method: 'DELETE',
      url: `${API}/assignments/${assignmentId}`,
      headers: { cookie: t2 },
    });
    expect(res.statusCode).toBe(403);
  });

  it('同班非布置者老师扫码提交他人作业返回 403', async () => {
    const { classId, assignmentId, qrToken } = await setupOwnedAssignment();
    const t2 = await ensureTeacher2();
    await state.app.inject({
      method: 'POST',
      url: `${API}/classes/${classId}/join`,
      headers: { cookie: t2 },
    });

    const res = await state.app.inject({
      method: 'POST',
      url: `${API}/submissions`,
      headers: { cookie: t2 },
      payload: { assignmentId, qrToken },
    });
    expect(res.statusCode).toBe(403);
  });

  it('布置者退出班级后看不到自己的作业，重新加入后恢复', async () => {
    const { classId } = await setupOwnedAssignment();

    const leave = await state.app.inject({
      method: 'DELETE',
      url: `${API}/classes/${classId}/join`,
      headers: { cookie: teacherCookie() },
    });
    expect(leave.statusCode).toBe(200);

    const afterLeave = await state.app.inject({
      method: 'GET',
      url: `${API}/assignments`,
      headers: { cookie: teacherCookie() },
    });
    expect(afterLeave.json().assignments).toHaveLength(0);

    await state.app.inject({
      method: 'POST',
      url: `${API}/classes/${classId}/join`,
      headers: { cookie: teacherCookie() },
    });

    const afterRejoin = await state.app.inject({
      method: 'GET',
      url: `${API}/assignments`,
      headers: { cookie: teacherCookie() },
    });
    expect(afterRejoin.json().assignments).toHaveLength(1);
  });
});