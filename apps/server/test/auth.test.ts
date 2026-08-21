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

  it('修改密码成功返回 200', async () => {
    const res = await state.app.inject({
      method: 'POST',
      url: `${API}/auth/password`,
      headers: { cookie: teacherCookie() },
      payload: { currentPassword: 'teacher-pass-123', newPassword: 'new-pass-123456' },
    });
    expect(res.statusCode).toBe(200);
  });

  it('修改密码旧密码错误返回 403', async () => {
    const res = await state.app.inject({
      method: 'POST',
      url: `${API}/auth/password`,
      headers: { cookie: teacherCookie() },
      payload: { currentPassword: 'wrong-password', newPassword: 'new-pass-123456' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('修改密码新密码过短返回 400', async () => {
    const res = await state.app.inject({
      method: 'POST',
      url: `${API}/auth/password`,
      headers: { cookie: teacherCookie() },
      payload: { currentPassword: 'teacher-pass-123', newPassword: 'short' },
    });
    expect(res.statusCode).toBe(400);
  });
});