import { describe, expect, it } from 'vitest';
import { API, createClassAndJoinTeacher, state, teacherCookie } from './helpers.js';

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
});