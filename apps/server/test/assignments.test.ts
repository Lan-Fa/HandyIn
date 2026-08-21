import { describe, expect, it } from 'vitest';
import { API, state, teacherCookie } from './helpers.js';

async function createClass() {
  const res = await state.app.inject({
    method: 'POST',
    url: `${API}/classes`,
    headers: { cookie: teacherCookie() },
    payload: { entryYear: 2026, department: '01', classNumber: 1 },
  });
  return res.json().class as { id: string };
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
});