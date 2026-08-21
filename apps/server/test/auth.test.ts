import { describe, expect, it } from 'vitest';
import { API, state, teacherCookie } from './helpers.js';

describe('认证', () => {
  it('未登录访问 /auth/me 返回 401', async () => {
    const res = await state.app.inject({ method: 'GET', url: `${API}/auth/me` });
    expect(res.statusCode).toBe(401);
  });

  it('正确账号登录返回 200 与用户信息', async () => {
    const res = await state.app.inject({
      method: 'POST',
      url: `${API}/auth/login`,
      payload: { username: 'admin', password: 'admin-pass-123' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.username).toBe('admin');
    expect(res.json().user.role).toBe('ADMIN');
    expect(res.headers['set-cookie']).toBeTruthy();
  });

  it('错误密码登录返回 401', async () => {
    const res = await state.app.inject({
      method: 'POST',
      url: `${API}/auth/login`,
      payload: { username: 'admin', password: 'wrong-password' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('带 cookie 访问 /auth/me 返回 200', async () => {
    const res = await state.app.inject({
      method: 'GET',
      url: `${API}/auth/me`,
      headers: { cookie: teacherCookie() },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.role).toBe('TEACHER');
  });
});