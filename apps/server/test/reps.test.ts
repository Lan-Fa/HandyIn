import { describe, expect, it } from 'vitest';
import { API, adminCookie, createClassAndJoinTeacher, repCookie, state, teacherCookie } from './helpers.js';

async function setupAssignment() {
  const { id: classId } = await createClassAndJoinTeacher();
  const asg = await state.app.inject({
    method: 'POST',
    url: `${API}/assignments`,
    headers: { cookie: teacherCookie() },
    payload: { classId, title: '数学作业' },
  });
  return asg.json().assignment.id as string;
}

describe('课代表授权', () => {
  it('教师可查看空授权列表', async () => {
    const assignmentId = await setupAssignment();
    const res = await state.app.inject({
      method: 'GET',
      url: `${API}/assignments/${assignmentId}/reps`,
      headers: { cookie: teacherCookie() },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().reps).toEqual([]);
  });

  it('教师授权课代表返回 201', async () => {
    const assignmentId = await setupAssignment();
    const res = await state.app.inject({
      method: 'POST',
      url: `${API}/assignments/${assignmentId}/reps`,
      headers: { cookie: teacherCookie() },
      payload: { assignmentId, userId: state.rep.id },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().rep.userId).toBe(state.rep.id);
  });

  it('重复授权为幂等 upsert', async () => {
    const assignmentId = await setupAssignment();
    const opts = {
      method: 'POST',
      url: `${API}/assignments/${assignmentId}/reps`,
      headers: { cookie: teacherCookie() },
      payload: { assignmentId, userId: state.rep.id },
    };
    await state.app.inject(opts);
    const res = await state.app.inject(opts);
    expect(res.statusCode).toBe(201);
  });

  it('教师回收授权返回 200', async () => {
    const assignmentId = await setupAssignment();
    await state.app.inject({
      method: 'POST',
      url: `${API}/assignments/${assignmentId}/reps`,
      headers: { cookie: teacherCookie() },
      payload: { assignmentId, userId: state.rep.id },
    });
    const res = await state.app.inject({
      method: 'DELETE',
      url: `${API}/assignments/${assignmentId}/reps/${state.rep.id}`,
      headers: { cookie: teacherCookie() },
    });
    expect(res.statusCode).toBe(200);
  });

  it('课代表访问授权接口返回 403', async () => {
    const assignmentId = await setupAssignment();
    const res = await state.app.inject({
      method: 'GET',
      url: `${API}/assignments/${assignmentId}/reps`,
      headers: { cookie: repCookie() },
    });
    expect(res.statusCode).toBe(403);
  });

  it('教师不能给未加入班级的作业授权', async () => {
    // 管理员建班 + 建作业，但教师未加入
    const cls = await state.app.inject({
      method: 'POST',
      url: `${API}/classes`,
      headers: { cookie: adminCookie() },
      payload: { entryYear: 2026, department: '02', classNumber: 1 },
    });
    const classId = cls.json().class.id as string;
    const asg = await state.app.inject({
      method: 'POST',
      url: `${API}/assignments`,
      headers: { cookie: adminCookie() },
      payload: { classId, title: '二班作业' },
    });
    const assignmentId = asg.json().assignment.id as string;

    const res = await state.app.inject({
      method: 'POST',
      url: `${API}/assignments/${assignmentId}/reps`,
      headers: { cookie: teacherCookie() },
      payload: { assignmentId, userId: state.rep.id },
    });
    expect(res.statusCode).toBe(403);
  });

  it('管理员可授权课代表', async () => {
    const assignmentId = await setupAssignment();
    const res = await state.app.inject({
      method: 'POST',
      url: `${API}/assignments/${assignmentId}/reps`,
      headers: { cookie: adminCookie() },
      payload: { assignmentId, userId: state.rep.id },
    });
    expect(res.statusCode).toBe(201);
  });
});