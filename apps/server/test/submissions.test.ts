import { describe, expect, it } from 'vitest';
import { API, adminCookie, createClassAndJoinTeacher, repCookie, state, teacherCookie } from './helpers.js';
import { prisma } from '../src/prisma.js';

async function setupAssignment() {
  const { id: classId } = await createClassAndJoinTeacher();
  const stu = await state.app.inject({
    method: 'POST',
    url: `${API}/students`,
    headers: { cookie: teacherCookie() },
    payload: { name: '张三', classId, numberInClass: 1 },
  });
  const student = stu.json().student as { id: string; qrToken: string };
  const asg = await state.app.inject({
    method: 'POST',
    url: `${API}/assignments`,
    headers: { cookie: teacherCookie() },
    payload: { classId, title: '数学作业' },
  });
  const assignmentId = asg.json().assignment.id;
  return { classId, student, assignmentId };
}

describe('提交（扫码）', () => {
  it('提交返回 submitted', async () => {
    const { student, assignmentId } = await setupAssignment();
    const res = await state.app.inject({
      method: 'POST',
      url: `${API}/submissions`,
      headers: { cookie: teacherCookie() },
      payload: { assignmentId, qrToken: student.qrToken },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('submitted');
  });

  it('重复提交返回 duplicate', async () => {
    const { student, assignmentId } = await setupAssignment();
    const opts = {
      method: 'POST',
      url: `${API}/submissions`,
      headers: { cookie: teacherCookie() },
      payload: { assignmentId, qrToken: student.qrToken },
    };
    await state.app.inject(opts);
    const res = await state.app.inject(opts);
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('duplicate');
  });

  it('非法 qrToken 返回 400', async () => {
    const { assignmentId } = await setupAssignment();
    const res = await state.app.inject({
      method: 'POST',
      url: `${API}/submissions`,
      headers: { cookie: teacherCookie() },
      payload: { assignmentId, qrToken: 'nonexistent-token' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('非本班学生提交返回 400', async () => {
    const { assignmentId } = await setupAssignment();
    const { id: classId2 } = await createClassAndJoinTeacher({
      entryYear: 2026,
      department: '02',
      classNumber: 2,
    });
    const stu2 = await state.app.inject({
      method: 'POST',
      url: `${API}/students`,
      headers: { cookie: teacherCookie() },
      payload: { name: '李四', classId: classId2, numberInClass: 1 },
    });
    const res = await state.app.inject({
      method: 'POST',
      url: `${API}/submissions`,
      headers: { cookie: teacherCookie() },
      payload: { assignmentId, qrToken: stu2.json().student.qrToken },
    });
    expect(res.statusCode).toBe(400);
  });

  it('未登录提交返回 401', async () => {
    const { student, assignmentId } = await setupAssignment();
    const res = await state.app.inject({
      method: 'POST',
      url: `${API}/submissions`,
      payload: { assignmentId, qrToken: student.qrToken },
    });
    expect(res.statusCode).toBe(401);
  });

  it('课代表在所属班扫码成功', async () => {
    const { classId, student, assignmentId } = await setupAssignment();
    await state.app.inject({
      method: 'POST',
      url: `${API}/classes/${classId}/reps`,
      headers: { cookie: teacherCookie() },
      payload: { userId: state.rep.id },
    });
    const res = await state.app.inject({
      method: 'POST',
      url: `${API}/submissions`,
      headers: { cookie: repCookie() },
      payload: { assignmentId, qrToken: student.qrToken },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('submitted');
  });

  it('课代表跨班扫码返回 403', async () => {
    const { student, assignmentId } = await setupAssignment();
    // 课代表分配到另一个班
    const other = await createClassAndJoinTeacher({
      entryYear: 2026,
      department: '01',
      classNumber: 2,
    });
    await state.app.inject({
      method: 'POST',
      url: `${API}/classes/${other.id}/reps`,
      headers: { cookie: teacherCookie() },
      payload: { userId: state.rep.id },
    });

    const res = await state.app.inject({
      method: 'POST',
      url: `${API}/submissions`,
      headers: { cookie: repCookie() },
      payload: { assignmentId, qrToken: student.qrToken },
    });
    expect(res.statusCode).toBe(403);
  });

  it('教师手动标记返回 submitted', async () => {
    const { student, assignmentId } = await setupAssignment();
    const res = await state.app.inject({
      method: 'POST',
      url: `${API}/submissions/manual`,
      headers: { cookie: teacherCookie() },
      payload: { assignmentId, studentId: student.id },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('submitted');
  });

  it('重复手动标记返回 duplicate', async () => {
    const { student, assignmentId } = await setupAssignment();
    const opts = {
      method: 'POST',
      url: `${API}/submissions/manual`,
      headers: { cookie: teacherCookie() },
      payload: { assignmentId, studentId: student.id },
    };
    await state.app.inject(opts);
    const res = await state.app.inject(opts);
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('duplicate');
  });

  it('课代表在所属班手动标记成功', async () => {
    const { classId, student, assignmentId } = await setupAssignment();
    await state.app.inject({
      method: 'POST',
      url: `${API}/classes/${classId}/reps`,
      headers: { cookie: teacherCookie() },
      payload: { userId: state.rep.id },
    });
    const res = await state.app.inject({
      method: 'POST',
      url: `${API}/submissions/manual`,
      headers: { cookie: repCookie() },
      payload: { assignmentId, studentId: student.id },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('submitted');
  });

  it('课代表跨班手动标记返回 403', async () => {
    const { student, assignmentId } = await setupAssignment();
    const other = await createClassAndJoinTeacher({
      entryYear: 2026,
      department: '01',
      classNumber: 2,
    });
    await state.app.inject({
      method: 'POST',
      url: `${API}/classes/${other.id}/reps`,
      headers: { cookie: teacherCookie() },
      payload: { userId: state.rep.id },
    });
    const res = await state.app.inject({
      method: 'POST',
      url: `${API}/submissions/manual`,
      headers: { cookie: repCookie() },
      payload: { assignmentId, studentId: student.id },
    });
    expect(res.statusCode).toBe(403);
  });

  it('手动标记非本班学生返回 400', async () => {
    const { assignmentId } = await setupAssignment();
    const other = await createClassAndJoinTeacher({
      entryYear: 2026,
      department: '02',
      classNumber: 2,
    });
    const stu2 = await state.app.inject({
      method: 'POST',
      url: `${API}/students`,
      headers: { cookie: teacherCookie() },
      payload: { name: '李四', classId: other.id, numberInClass: 1 },
    });
    const res = await state.app.inject({
      method: 'POST',
      url: `${API}/submissions/manual`,
      headers: { cookie: teacherCookie() },
      payload: { assignmentId, studentId: stu2.json().student.id },
    });
    expect(res.statusCode).toBe(400);
  });

  it('手动标记不存在的学生返回 404', async () => {
    const { assignmentId } = await setupAssignment();
    const res = await state.app.inject({
      method: 'POST',
      url: `${API}/submissions/manual`,
      headers: { cookie: teacherCookie() },
      payload: { assignmentId, studentId: '00000000-0000-0000-0000-000000000000' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('非成员教师手动标记返回 403', async () => {
    const cls = await state.app.inject({
      method: 'POST',
      url: `${API}/classes`,
      headers: { cookie: adminCookie() },
      payload: { entryYear: 2026, department: '02', classNumber: 1 },
    });
    const classId = cls.json().class.id as string;
    const stu = await state.app.inject({
      method: 'POST',
      url: `${API}/students`,
      headers: { cookie: adminCookie() },
      payload: { name: '李四', classId, numberInClass: 1 },
    });
    const asg = await state.app.inject({
      method: 'POST',
      url: `${API}/assignments`,
      headers: { cookie: adminCookie() },
      payload: { classId, title: '二班作业' },
    });
    const assignmentId = asg.json().assignment.id as string;
    const res = await state.app.inject({
      method: 'POST',
      url: `${API}/submissions/manual`,
      headers: { cookie: teacherCookie() },
      payload: { assignmentId, studentId: stu.json().student.id },
    });
    expect(res.statusCode).toBe(403);
  });

  it('教师删除未加入班级的收取记录返回 403', async () => {
    // 管理员建班 + 学生 + 作业 + 提交
    const cls = await state.app.inject({
      method: 'POST',
      url: `${API}/classes`,
      headers: { cookie: adminCookie() },
      payload: { entryYear: 2026, department: '02', classNumber: 1 },
    });
    const classId = cls.json().class.id;
    const stu = await state.app.inject({
      method: 'POST',
      url: `${API}/students`,
      headers: { cookie: adminCookie() },
      payload: { name: '李四', classId, numberInClass: 1 },
    });
    const qrToken = stu.json().student.qrToken;
    const asg = await state.app.inject({
      method: 'POST',
      url: `${API}/assignments`,
      headers: { cookie: adminCookie() },
      payload: { classId, title: '二班作业' },
    });
    const assignmentId = asg.json().assignment.id;
    await state.app.inject({
      method: 'POST',
      url: `${API}/submissions`,
      headers: { cookie: adminCookie() },
      payload: { assignmentId, qrToken },
    });
    const sub = await prisma.submission.findFirst({ where: { assignmentId } });

    const res = await state.app.inject({
      method: 'DELETE',
      url: `${API}/submissions/${sub!.id}`,
      headers: { cookie: teacherCookie() },
    });
    expect(res.statusCode).toBe(403);
  });
});