import { describe, expect, it } from 'vitest';
import { API, adminCookie, createClassAndJoinTeacher, repCookie, state, teacherCookie } from './helpers.js';

async function setupClass() {
  return createClassAndJoinTeacher();
}

describe('课代表班级归属', () => {
  it('教师可查看空课代表列表', async () => {
    const { id: classId } = await setupClass();
    const res = await state.app.inject({
      method: 'GET',
      url: `${API}/classes/${classId}/reps`,
      headers: { cookie: teacherCookie() },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().reps).toEqual([]);
  });

  it('教师给班级分配课代表返回 201', async () => {
    const { id: classId } = await setupClass();
    const res = await state.app.inject({
      method: 'POST',
      url: `${API}/classes/${classId}/reps`,
      headers: { cookie: teacherCookie() },
      payload: { userId: state.rep.id },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().rep.userId).toBe(state.rep.id);
  });

  it('重复分配为幂等 upsert', async () => {
    const { id: classId } = await setupClass();
    const opts = {
      method: 'POST',
      url: `${API}/classes/${classId}/reps`,
      headers: { cookie: teacherCookie() },
      payload: { userId: state.rep.id },
    };
    await state.app.inject(opts);
    const res = await state.app.inject(opts);
    expect(res.statusCode).toBe(201);
  });

  it('教师移除课代表返回 200', async () => {
    const { id: classId } = await setupClass();
    await state.app.inject({
      method: 'POST',
      url: `${API}/classes/${classId}/reps`,
      headers: { cookie: teacherCookie() },
      payload: { userId: state.rep.id },
    });
    const res = await state.app.inject({
      method: 'DELETE',
      url: `${API}/classes/${classId}/reps/${state.rep.id}`,
      headers: { cookie: teacherCookie() },
    });
    expect(res.statusCode).toBe(200);

    const list = await state.app.inject({
      method: 'GET',
      url: `${API}/classes/${classId}/reps`,
      headers: { cookie: teacherCookie() },
    });
    expect(list.json().reps).toEqual([]);
  });

  it('管理员可给班级分配课代表', async () => {
    const { id: classId } = await setupClass();
    const res = await state.app.inject({
      method: 'POST',
      url: `${API}/classes/${classId}/reps`,
      headers: { cookie: adminCookie() },
      payload: { userId: state.rep.id },
    });
    expect(res.statusCode).toBe(201);
  });

  it('非成员教师给未加入班级分配课代表返回 403', async () => {
    const cls = await state.app.inject({
      method: 'POST',
      url: `${API}/classes`,
      headers: { cookie: adminCookie() },
      payload: { entryYear: 2026, department: '02', classNumber: 1 },
    });
    const classId = cls.json().class.id as string;

    const res = await state.app.inject({
      method: 'POST',
      url: `${API}/classes/${classId}/reps`,
      headers: { cookie: teacherCookie() },
      payload: { userId: state.rep.id },
    });
    expect(res.statusCode).toBe(403);
  });

  it('课代表访问分配接口返回 403', async () => {
    const { id: classId } = await setupClass();
    const res = await state.app.inject({
      method: 'GET',
      url: `${API}/classes/${classId}/reps`,
      headers: { cookie: repCookie() },
    });
    expect(res.statusCode).toBe(403);
  });

  it('只能分配课代表角色返回 400', async () => {
    const { id: classId } = await setupClass();
    const res = await state.app.inject({
      method: 'POST',
      url: `${API}/classes/${classId}/reps`,
      headers: { cookie: teacherCookie() },
      payload: { userId: state.teacher.id },
    });
    expect(res.statusCode).toBe(400);
  });
});
