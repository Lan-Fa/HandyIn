import { describe, expect, it } from 'vitest';
import { API, repCookie, state, teacherCookie } from './helpers.js';

const CLASS_PAYLOAD = { entryYear: 2026, department: '01', classNumber: 1 };

describe('班级管理', () => {
  it('未登录 GET /classes 返回 401', async () => {
    const res = await state.app.inject({ method: 'GET', url: `${API}/classes` });
    expect(res.statusCode).toBe(401);
  });

  it('REPRESENTATIVE GET /classes 返回 403', async () => {
    const res = await state.app.inject({
      method: 'GET',
      url: `${API}/classes`,
      headers: { cookie: repCookie() },
    });
    expect(res.statusCode).toBe(403);
  });

  it('已登录 TEACHER GET /classes 返回 200（回归：原永久挂起）', async () => {
    const res = await state.app.inject({
      method: 'GET',
      url: `${API}/classes`,
      headers: { cookie: teacherCookie() },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().classes).toEqual([]);
  });

  it('创建班级返回 201', async () => {
    const res = await state.app.inject({
      method: 'POST',
      url: `${API}/classes`,
      headers: { cookie: teacherCookie() },
      payload: CLASS_PAYLOAD,
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().class.department).toBe('01');
  });

  it('重复创建班级返回 409', async () => {
    const opts = {
      method: 'POST',
      url: `${API}/classes`,
      headers: { cookie: teacherCookie() },
      payload: CLASS_PAYLOAD,
    };
    await state.app.inject(opts);
    const res = await state.app.inject(opts);
    expect(res.statusCode).toBe(409);
  });

  it('非法 department 返回 400', async () => {
    const res = await state.app.inject({
      method: 'POST',
      url: `${API}/classes`,
      headers: { cookie: teacherCookie() },
      payload: { entryYear: 2026, department: '99', classNumber: 1 },
    });
    expect(res.statusCode).toBe(400);
  });

  it('列表含 studentCount', async () => {
    await state.app.inject({
      method: 'POST',
      url: `${API}/classes`,
      headers: { cookie: teacherCookie() },
      payload: CLASS_PAYLOAD,
    });
    const res = await state.app.inject({
      method: 'GET',
      url: `${API}/classes`,
      headers: { cookie: teacherCookie() },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().classes[0].studentCount).toBe(0);
  });

  it('删除空班返回 200', async () => {
    const created = await state.app.inject({
      method: 'POST',
      url: `${API}/classes`,
      headers: { cookie: teacherCookie() },
      payload: CLASS_PAYLOAD,
    });
    const id = created.json().class.id;
    const res = await state.app.inject({
      method: 'DELETE',
      url: `${API}/classes/${id}`,
      headers: { cookie: teacherCookie() },
    });
    expect(res.statusCode).toBe(200);
  });

  it('删除有学生的班返回 409', async () => {
    const created = await state.app.inject({
      method: 'POST',
      url: `${API}/classes`,
      headers: { cookie: teacherCookie() },
      payload: CLASS_PAYLOAD,
    });
    const classId = created.json().class.id;
    await state.app.inject({
      method: 'POST',
      url: `${API}/students`,
      headers: { cookie: teacherCookie() },
      payload: { name: '张三', classId, numberInClass: 1 },
    });
    const res = await state.app.inject({
      method: 'DELETE',
      url: `${API}/classes/${classId}`,
      headers: { cookie: teacherCookie() },
    });
    expect(res.statusCode).toBe(409);
  });
});