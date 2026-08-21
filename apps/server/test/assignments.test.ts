import { describe, expect, it } from 'vitest';
import { API, adminCookie, createClassAndJoinTeacher, state, teacherCookie } from './helpers.js';

async function createClass() {
  return createClassAndJoinTeacher();
}

describe('作业管理', () => {
  it('创建作业返回 201', async () => {
    const { id: classId } = await createClass();
    const res = await state.app.inject({
      method: 'POST',
      url: `${API}/assignments`,
      headers: { cookie: teacherCookie() },
      payload: { classId, title: '数学作业' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().assignment.title).toBe('数学作业');
  });

  it('教师不能给未加入班级创建作业返回 403', async () => {
    const { id: classId } = await createClassAndJoinTeacher();
    await state.app.inject({
      method: 'DELETE',
      url: `${API}/classes/${classId}/join`,
      headers: { cookie: teacherCookie() },
    });
    const res = await state.app.inject({
      method: 'POST',
      url: `${API}/assignments`,
      headers: { cookie: teacherCookie() },
      payload: { classId, title: '数学作业' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('列表返回 200', async () => {
    const { id: classId } = await createClass();
    await state.app.inject({
      method: 'POST',
      url: `${API}/assignments`,
      headers: { cookie: teacherCookie() },
      payload: { classId, title: '数学作业' },
    });
    const res = await state.app.inject({
      method: 'GET',
      url: `${API}/assignments`,
      headers: { cookie: teacherCookie() },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().assignments.length).toBe(1);
  });

  it('更新状态返回 200', async () => {
    const { id: classId } = await createClass();
    const created = await state.app.inject({
      method: 'POST',
      url: `${API}/assignments`,
      headers: { cookie: teacherCookie() },
      payload: { classId, title: '数学作业' },
    });
    const id = created.json().assignment.id;
    const res = await state.app.inject({
      method: 'PUT',
      url: `${API}/assignments/${id}`,
      headers: { cookie: teacherCookie() },
      payload: { status: 'COLLECTING' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().assignment.status).toBe('COLLECTING');
  });

  it('作业结束后可重新开启', async () => {
    const { id: classId } = await createClass();
    const created = await state.app.inject({
      method: 'POST',
      url: `${API}/assignments`,
      headers: { cookie: teacherCookie() },
      payload: { classId, title: '数学作业' },
    });
    const id = created.json().assignment.id;

    await state.app.inject({
      method: 'PUT',
      url: `${API}/assignments/${id}`,
      headers: { cookie: teacherCookie() },
      payload: { status: 'COLLECTING' },
    });
    const finished = await state.app.inject({
      method: 'PUT',
      url: `${API}/assignments/${id}`,
      headers: { cookie: teacherCookie() },
      payload: { status: 'FINISHED' },
    });
    expect(finished.json().assignment.status).toBe('FINISHED');

    const reopened = await state.app.inject({
      method: 'PUT',
      url: `${API}/assignments/${id}`,
      headers: { cookie: teacherCookie() },
      payload: { status: 'COLLECTING' },
    });
    expect(reopened.statusCode).toBe(200);
    expect(reopened.json().assignment.status).toBe('COLLECTING');
  });

  it('教师删除自己的作业', async () => {
    const { id: classId } = await createClass();
    const created = await state.app.inject({
      method: 'POST',
      url: `${API}/assignments`,
      headers: { cookie: teacherCookie() },
      payload: { classId, title: '数学作业' },
    });
    const id = created.json().assignment.id;

    const del = await state.app.inject({
      method: 'DELETE',
      url: `${API}/assignments/${id}`,
      headers: { cookie: teacherCookie() },
    });
    expect(del.statusCode).toBe(200);

    const list = await state.app.inject({
      method: 'GET',
      url: `${API}/assignments`,
      headers: { cookie: teacherCookie() },
    });
    expect(list.json().assignments.some((a: { id: string }) => a.id === id)).toBe(false);
  });

  it('stats 返回 200', async () => {
    const { id: classId } = await createClass();
    const created = await state.app.inject({
      method: 'POST',
      url: `${API}/assignments`,
      headers: { cookie: teacherCookie() },
      payload: { classId, title: '数学作业' },
    });
    const id = created.json().assignment.id;
    const res = await state.app.inject({
      method: 'GET',
      url: `${API}/assignments/${id}/stats`,
      headers: { cookie: teacherCookie() },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().stats.assignmentId).toBe(id);
  });

  it('教师列表仅返回已加入班级的作业', async () => {
    const { id: joinedId } = await createClassAndJoinTeacher({
      entryYear: 2026,
      department: '01',
      classNumber: 1,
    });
    await state.app.inject({
      method: 'POST',
      url: `${API}/assignments`,
      headers: { cookie: teacherCookie() },
      payload: { classId: joinedId, title: '一班作业' },
    });

    // 管理员建另一班 + 作业，教师未加入
    const cls = await state.app.inject({
      method: 'POST',
      url: `${API}/classes`,
      headers: { cookie: adminCookie() },
      payload: { entryYear: 2026, department: '02', classNumber: 1 },
    });
    const otherId = cls.json().class.id;
    await state.app.inject({
      method: 'POST',
      url: `${API}/assignments`,
      headers: { cookie: adminCookie() },
      payload: { classId: otherId, title: '二班作业' },
    });

    const teacherRes = await state.app.inject({
      method: 'GET',
      url: `${API}/assignments`,
      headers: { cookie: teacherCookie() },
    });
    expect(teacherRes.json().assignments).toHaveLength(1);
    expect(teacherRes.json().assignments[0].classId).toBe(joinedId);

    const adminRes = await state.app.inject({
      method: 'GET',
      url: `${API}/assignments`,
      headers: { cookie: adminCookie() },
    });
    expect(adminRes.json().assignments).toHaveLength(2);
  });
});