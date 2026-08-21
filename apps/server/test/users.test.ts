import { describe, expect, it } from 'vitest';
import { API, adminCookie, repCookie, state, teacherCookie } from './helpers.js';

describe('用户管理（仅管理员）', () => {
  it('未登录 GET /users 返回 401', async () => {
    const res = await state.app.inject({ method: 'GET', url: `${API}/users` });
    expect(res.statusCode).toBe(401);
  });

  it('教师 GET /users 返回 403', async () => {
    const res = await state.app.inject({
      method: 'GET',
      url: `${API}/users`,
      headers: { cookie: teacherCookie() },
    });
    expect(res.statusCode).toBe(403);
  });

  it('管理员 GET /users 返回 200', async () => {
    const res = await state.app.inject({
      method: 'GET',
      url: `${API}/users`,
      headers: { cookie: adminCookie() },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().users.length).toBeGreaterThanOrEqual(3);
  });

  it('管理员创建教师账号返回 201', async () => {
    const res = await state.app.inject({
      method: 'POST',
      url: `${API}/users`,
      headers: { cookie: adminCookie() },
      payload: { username: 'teacher2', password: 'pass-12345678', name: '新教师', role: 'TEACHER' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().user.role).toBe('TEACHER');
  });

  it('管理员创建管理员账号返回 201', async () => {
    const res = await state.app.inject({
      method: 'POST',
      url: `${API}/users`,
      headers: { cookie: adminCookie() },
      payload: { username: 'admin2', password: 'pass-12345678', name: '新管理员', role: 'ADMIN' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().user.role).toBe('ADMIN');
  });

  it('教师创建用户返回 403', async () => {
    const res = await state.app.inject({
      method: 'POST',
      url: `${API}/users`,
      headers: { cookie: teacherCookie() },
      payload: { username: 'someone', password: 'pass-12345678', role: 'TEACHER' },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('课代表候选列表', () => {
  it('教师 GET /users/representatives 返回仅课代表', async () => {
    const res = await state.app.inject({
      method: 'GET',
      url: `${API}/users/representatives`,
      headers: { cookie: teacherCookie() },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().users.length).toBeGreaterThanOrEqual(1);
    for (const u of res.json().users) {
      expect(u.role).toBe('REPRESENTATIVE');
    }
  });

  it('管理员 GET /users/representatives 返回 200', async () => {
    const res = await state.app.inject({
      method: 'GET',
      url: `${API}/users/representatives`,
      headers: { cookie: adminCookie() },
    });
    expect(res.statusCode).toBe(200);
  });

  it('课代表访问 representatives 返回 403', async () => {
    const res = await state.app.inject({
      method: 'GET',
      url: `${API}/users/representatives`,
      headers: { cookie: repCookie() },
    });
    expect(res.statusCode).toBe(403);
  });

  it('未登录访问 representatives 返回 401', async () => {
    const res = await state.app.inject({ method: 'GET', url: `${API}/users/representatives` });
    expect(res.statusCode).toBe(401);
  });
});